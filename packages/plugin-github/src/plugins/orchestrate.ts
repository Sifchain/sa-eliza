import {
    composeContext,
    elizaLogger,
    generateObject,
    Action,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    Plugin,
    State,
} from "@elizaos/core";
import { isOrchestrationSchema, OrchestratedGithubAction, OrchestrationSchema, orchestrationTemplate, plugins } from "../index";
import fs from "fs/promises";

export const orchestrateAction: Action = {
    name: "ORCHESTRATE",
    similes: ["ORCHESTRATE", "PLAN", "SEQUENCE", "EXECUTE_PLAN", "ORCHESTRATE_ACTIONS"],
    description: "Orchestrates a sequence of actions to fulfill a complex request",
    validate: async (runtime: IAgentRuntime) => {
        const token = !!runtime.getSetting("GITHUB_API_TOKEN");
        return token;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        options?: any,
        callback?: HandlerCallback
    ) => {
        if (!state) {
            state = await runtime.composeState(message);
        } else {
            state = await runtime.composeState(message, state);
        }

        // Get the orchestration plan
        const plan = await generateOrchestrationPlan(runtime, message, state);

        for (const action of plan) {
            try {
                const result = await executeAction(runtime, action, state, callback);

                // write result to a file
                await fs.writeFile(`/tmp/orchestrate-result-${action.githubAction}.json`, JSON.stringify(result, null, 2));
            } catch (error) {
                elizaLogger.error(`Error executing action ${action.githubAction}:`, error);
                if (callback) {
                    callback({
                        text: `Error executing action ${action.githubAction}. Please try again.`,
                        action: "ORCHESTRATE",
                        source: "github",
                    });
                }
                throw error;
            }
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Plan and implement a new feature to improve user experience in user1/repo1",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Successfully executed orchestration plan for implementing new feature",
                    action: "ORCHESTRATE",
                },
            },
        ],
    ],
};

async function generateOrchestrationPlan(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
): Promise<OrchestratedGithubAction[]> {
    const context = composeContext({
        state,
        template: orchestrationTemplate,
    });

    // write the context to a file
    await fs.writeFile("/tmp/orchestration-context.txt", context);

    const details = await generateObject({
        runtime,
        context,
        modelClass: ModelClass.SMALL,
        schema: OrchestrationSchema,
    });

    if (!isOrchestrationSchema(details.object)) {
        elizaLogger.error("Invalid content:", details.object);
        throw new Error("Invalid content");
    }

    const content = details.object as OrchestrationSchema;

    // write the details to a file
    await fs.writeFile("/tmp/orchestration-details.txt", JSON.stringify(content, null, 2));

    return content.githubActions;
}

async function executeAction(
    runtime: IAgentRuntime,
    orchestratedAction: OrchestratedGithubAction,
    state?: State,
    callback?: HandlerCallback
): Promise<any> {
    // Find the action handler
    const actionHandler = findActionHandler(orchestratedAction.githubAction);
    if (!actionHandler) {
        throw new Error(`Action ${orchestratedAction.githubAction} not found`);
    }

    // Create a new memory for this action
    const actionMemory: Memory = {
        content: {
            text: orchestratedAction.user,
            action: orchestratedAction.githubAction,
            source: "github",
        },
        userId: state.userId,
        agentId: state.agentId,
        roomId: state.roomId,
    };

    // Execute the action
    const result = await actionHandler.handler(
        runtime,
        actionMemory,
        state,
        undefined,
        callback
    ) || {};

    return result;
}

function findActionHandler(actionName: string): Action | undefined {
    // Search through all plugins for the action
    for (const plugin of Object.values(plugins)) {
        const actions = plugin.actions || [];
        const action = actions.find(a =>
            a.name === actionName ||
            (a.similes && a.similes.includes(actionName))
        );
        if (action) {
            return action;
        }
    }
    return undefined;
}

export const githubOrchestratePlugin: Plugin = {
    name: "githubOrchestrate",
    description: "Integration with GitHub for orchestrating complex operations",
    actions: [orchestrateAction],
};