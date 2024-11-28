import { composeContext, elizaLogger, generateObjectV2, Action, HandlerCallback, IAgentRuntime, Memory, ModelClass, Plugin, State } from "@ai16z/eliza";
import { createPullRequestTemplate } from "../templates";
import { CreatePullRequestContent, CreatePullRequestSchema, isCreatePullRequestContent } from "../types";
import { checkoutBranch, commitAndPushChanges, createPullRequest, getRepoPath, writeFiles } from "../utils";

export const createPullRequestAction: Action = {
    name: "CREATE_PULL_REQUEST",
    similes: ["CREATE_PR", "GENERATE_PR"],
    description: "Create a pull request",
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
            template: createPullRequestTemplate,
        });

        const details = await generateObjectV2({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
            schema: CreatePullRequestSchema,
        });

        if (!isCreatePullRequestContent(details.object)) {
            throw new Error("Invalid content");
        }

        const content = details.object as CreatePullRequestContent;

        elizaLogger.info("Creating a pull request...");

        const repoPath = getRepoPath(content.owner, content.repo);

        try {
            await checkoutBranch(repoPath, content.branch, true);
            await writeFiles(repoPath, content.files);
            await commitAndPushChanges(repoPath, content.title, content.branch);
            await createPullRequest(
                runtime.getSetting("GITHUB_API_TOKEN"),
                content.owner,
                content.repo,
                content.branch,
                content.title,
                content.description,
                content.base,
            );

            elizaLogger.info("Pull request created successfully!");

            callback(
                {
                    text: "Pull request created successfully!",
                    attachments: [],
                }
            );
        } catch (error) {
            elizaLogger.error(`Error creating pull request on ${content.owner}/${content.repo} branch ${content.branch}:`, error);
            callback(
                {
                    text: `Error creating pull request on ${content.owner}/${content.repo} branch ${content.branch}. Please try again.`,
                },
                [],
            );
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Create a pull request on repository octocat/hello-world with branch main and path docs/",
                }
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Pull request created successfully!",
                    action: "INITIALIZE_REPOSITORY",
                },
            },
        ],
    ],
};

export const githubCreatePullRequestPlugin: Plugin = {
    name: "githubCreatePullRequest",
    description: "Integration with GitHub for creating a pull request",
    actions: [createPullRequestAction],
    evaluators: [],
    providers: [],
};
