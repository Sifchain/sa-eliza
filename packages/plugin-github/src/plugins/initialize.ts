import { composeContext, elizaLogger, generateObjectV2, Action, HandlerCallback, IAgentRuntime, Memory, ModelClass, Plugin, State } from "@ai16z/eliza";
import { initializeTemplate } from "../templates";
import { InitializeContent, InitializeSchema, isInitializeContent } from "../types";
import { checkoutBranch, cloneOrPullRepository, createReposDirectory, getRepoPath } from "../utils";

export const initializeRepositoryAction: Action = {
    name: "INITIALIZE_REPOSITORY",
    similes: ["INITIALIZE_REPO", "INIT_REPO"],
    description: "Initialize the repository",
    validate: async (runtime: IAgentRuntime) => {
        // Check if all required environment variables are set
        const token = !!runtime.getSetting("GITHUB_API_TOKEN");

        return token;
    },
    handler: async (runtime: IAgentRuntime, message: Memory, state: State, options: any, callback: HandlerCallback) => {
        elizaLogger.log("Composing state for message:", message);
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        const context = composeContext({
            state,
            template: initializeTemplate,
        });

        const details = await generateObjectV2({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
            schema: InitializeSchema,
        });

        if (!isInitializeContent(details.object)) {
            throw new Error("Invalid initialize content");
        }

        const content = details.object as InitializeContent;

        elizaLogger.info("Initializing repository...");

        const repoPath = getRepoPath(content.owner, content.repo);

        try {
            await createReposDirectory(content.owner);
            await cloneOrPullRepository(
                content.owner,
                content.repo,
                repoPath,
            );
            await checkoutBranch(repoPath, content.branch);

            elizaLogger.info("Repository initialized successfully!");

            callback(
                {
                    text: "Repository initialized successfully!",
                    attachments: [],
                }
            );
        } catch (error) {
            elizaLogger.error(`Error initializing repository ${content.owner}/${content.repo} branch ${content.branch}:`, error);
            callback(
                {
                    text: `Error initializing repository ${content.owner}/${content.repo} branch ${content.branch}. Please try again.`,
                },
                [],
            )
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Initialize the repository for user1/repo1 on main branch",
                }
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Repository initialized successfully!",
                    action: "INITIALIZE_REPOSITORY",
                },
            },
        ],
    ],
};

export const githubInitializePlugin: Plugin = {
    name: "githubInitialize",
    description: "Integration with GitHub for initializing the repository",
    actions: [initializeRepositoryAction],
    evaluators: [],
    providers: [],
};
