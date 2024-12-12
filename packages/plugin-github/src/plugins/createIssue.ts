import {
    composeContext,
    elizaLogger,
    generateObjectV2,
    Action,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    Plugin,
    State,
} from "@ai16z/eliza";
import { GitHubService } from "../services/github";
import { createIssueTemplate } from "../templates";
import {
    CreateIssueContent,
    CreateIssueSchema,
    isCreateIssueContent,
} from "../types";

export const createIssueAction: Action = {
    name: "CREATE_ISSUE",
    similes: ["CREATE_ISSUE", "GITHUB_CREATE_ISSUE", "OPEN_ISSUE"],
    description: "Creates a new issue in the GitHub repository",
    validate: async (runtime: IAgentRuntime) => {
        const token = !!runtime.getSetting("GITHUB_API_TOKEN");
        return token;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback: HandlerCallback
    ) => {
        elizaLogger.log("Composing state for message:", message);
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        const context = composeContext({
            state,
            template: createIssueTemplate,
        });

        const details = await generateObjectV2({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
            schema: CreateIssueSchema,
        });

        if (!isCreateIssueContent(details.object)) {
            elizaLogger.error("Invalid content:", details.object);
            throw new Error("Invalid content");
        }

        const content = details.object as CreateIssueContent;

        elizaLogger.info("Creating issue in the repository...");

        const githubService = new GitHubService({
            owner: content.owner,
            repo: content.repo,
            auth: runtime.getSetting("GITHUB_API_TOKEN"),
        });

        try {
            const issue = await githubService.createIssue(
                content.title,
                content.body,
                content.labels
            );

            elizaLogger.info(
                `Created issue successfully! Issue number: ${issue.number}`
            );

            callback({
                text: `Created issue #${issue.number} successfully!`,
                attachments: [],
            });
        } catch (error) {
            elizaLogger.error(
                `Error creating issue in repository ${content.owner}/${content.repo}:`,
                error
            );
            callback(
                {
                    text: `Error creating issue in repository ${content.owner}/${content.repo}. Please try again.`,
                },
                []
            );
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Create an issue in repository user1/repo1 titled 'Bug: Application crashes on startup'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Created issue #1 successfully!",
                    action: "CREATE_ISSUE",
                },
            },
        ],
    ],
};

export const githubCreateIssuePlugin: Plugin = {
    name: "githubCreateIssue",
    description: "Integration with GitHub for creating issues in repositories",
    actions: [createIssueAction],
    evaluators: [],
    providers: [],
};
