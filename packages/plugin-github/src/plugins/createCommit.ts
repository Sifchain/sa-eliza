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
import { createCommitTemplate } from "../templates";
import {
    CreateCommitContent,
    CreateCommitSchema,
    isCreateCommitContent,
} from "../types";
import { commitAndPushChanges, getRepoPath, writeFiles } from "../utils";
import { sourceCodeProvider } from "../providers/sourceCode";
import { testFilesProvider } from "../providers/testFiles";
import { workflowFilesProvider } from "../providers/workflowFiles";
import { documentationFilesProvider } from "../providers/documentationFiles";
import { releasesProvider } from "../providers/releases";

export const createCommitAction: Action = {
    name: "CREATE_COMMIT",
    similes: [
        "COMMIT",
        "COMMIT_CHANGES",
        "CREATE_COMMIT",
        "GITHUB_COMMIT",
        "GITHUB_CREATE_COMMIT",
        "GITHUB_COMMIT_CHANGES",
    ],
    description: "Commit changes to the repository",
    validate: async (runtime: IAgentRuntime) => {
        // Check if all required environment variables are set
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
            template: createCommitTemplate,
        });

        const details = await generateObjectV2({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
            schema: CreateCommitSchema,
        });

        if (!isCreateCommitContent(details.object)) {
            elizaLogger.error("Invalid content:", details.object);
            throw new Error("Invalid content");
        }

        const content = details.object as CreateCommitContent;

        elizaLogger.info("Committing changes to the repository...");

        const repoPath = getRepoPath(content.owner, content.repo);

        try {
            await writeFiles(repoPath, content.files);
            const { hash } = await commitAndPushChanges(
                repoPath,
                content.message
            );

            elizaLogger.info(
                `Commited changes to the repository successfully! commit hash: ${hash}`
            );

            callback({
                text: `Changes commited successfully! commit hash: ${hash}`,
                attachments: [],
            });
        } catch (error) {
            elizaLogger.error(
                `Error committing to the repository ${content.owner}/${content.repo} message ${content.message}:`,
                error
            );
            callback(
                {
                    text: `Error committing to the repository ${content.owner}/${content.repo} message ${content.message}. Please try again.`,
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
                    text: "Commit changes to the repository user1/repo1 with the commit message: 'Initial commit'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Changes commited successfully! commit hash: abcdef1",
                    action: "COMMIT",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Commit changes to the repository user1/repo1 with the commit message: 'Update README'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Changes commited successfully! commit hash: abcdef2",
                    action: "COMMIT_CHANGES",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Create a commit in the repository user1/repo1 with the commit message: 'Fix bug'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Changes commited successfully! commit hash: abcdef3",
                    action: "CREATE_COMMIT",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Commit changes to the GitHub repository user1/repo1 with the commit message: 'Add new feature'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Changes commited successfully! commit hash: abcdef4",
                    action: "GITHUB_COMMIT",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Create a commit in the GitHub repository user1/repo1 with the commit message: 'Refactor code'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Changes commited successfully! commit hash: abcdef5",
                    action: "GITHUB_CREATE_COMMIT",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Commit changes to the GitHub repository user1/repo1 with the commit message: 'Improve performance'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Changes commited successfully! commit hash: abcdef6",
                    action: "GITHUB_COMMIT_CHANGES",
                },
            },
        ],
    ],
};

export const githubCreateCommitPlugin: Plugin = {
    name: "githubCreateCommit",
    description:
        "Integration with GitHub for committing changes to the repository",
    actions: [createCommitAction],
    evaluators: [],
    providers: [
        sourceCodeProvider,
        testFilesProvider,
        workflowFilesProvider,
        documentationFilesProvider,
        releasesProvider,
    ],
};
