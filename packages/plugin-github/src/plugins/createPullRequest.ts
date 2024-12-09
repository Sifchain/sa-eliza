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
import { createPullRequestTemplate } from "../templates";
import {
    CreatePullRequestContent,
    CreatePullRequestSchema,
    isCreatePullRequestContent,
} from "../types";
import {
    checkoutBranch,
    commitAndPushChanges,
    createPullRequest,
    getRepoPath,
    writeFiles,
} from "../utils";
import { sourceCodeProvider } from "../providers/sourceCode";
import { testFilesProvider } from "../providers/testFiles";
import { workflowFilesProvider } from "../providers/workflowFiles";
import { documentationFilesProvider } from "../providers/documentationFiles";
import { releasesProvider } from "../providers/releases";

export const createPullRequestAction: Action = {
    name: "CREATE_PULL_REQUEST",
    similes: [
        "CREATE_PULL_REQUEST",
        "CREATE_PR",
        "GENERATE_PR",
        "PULL_REQUEST",
        "GITHUB_CREATE_PULL_REQUEST",
        "GITHUB_PR",
        "GITHUB_GENERATE_PR",
        "GITHUB_PULL_REQUEST",
    ],
    description: "Create a pull request",
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
            template: createPullRequestTemplate,
        });

        const details = await generateObjectV2({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
            schema: CreatePullRequestSchema,
        });

        if (!isCreatePullRequestContent(details.object)) {
            elizaLogger.error("Invalid content:", details.object);
            throw new Error("Invalid content");
        }

        const content = details.object as CreatePullRequestContent;

        elizaLogger.info("Creating a pull request...");

        const repoPath = getRepoPath(content.owner, content.repo);

        try {
            await checkoutBranch(repoPath, content.branch, true);
            await writeFiles(repoPath, content.files);
            await commitAndPushChanges(repoPath, content.title, content.branch);
            const { url } = await createPullRequest(
                runtime.getSetting("GITHUB_API_TOKEN"),
                content.owner,
                content.repo,
                content.branch,
                content.title,
                content.description,
                content.base
            );

            elizaLogger.info(`Pull request created successfully! URL: ${url}`);

            callback({
                text: `Pull request created successfully! URL: ${url}`,
                attachments: [],
            });
        } catch (error) {
            elizaLogger.error(
                `Error creating pull request on ${content.owner}/${content.repo} branch ${content.branch}:`,
                error
            );
            callback(
                {
                    text: `Error creating pull request on ${content.owner}/${content.repo} branch ${content.branch}. Please try again.`,
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
                    text: "Create a pull request on repository octocat/hello-world with branch 'fix/something', title 'fix: something' and path 'docs/'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Pull request created successfully! URL: https://github.com/octocat/hello-world/pull/1",
                    action: "CREATE_PULL_REQUEST",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Create PR on repository octocat/hello-world with branch 'feature/new-feature', title 'feat: new feature' and path 'src/'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Pull request created successfully! URL: https://github.com/octocat/hello-world/pull/2",
                    action: "CREATE_PR",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Generate PR on repository octocat/hello-world with branch 'hotfix/urgent-fix', title 'fix: urgent fix' and path 'lib/'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Pull request created successfully! URL: https://github.com/octocat/hello-world/pull/3",
                    action: "GENERATE_PR",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Create a pull request on repository octocat/hello-world with branch 'chore/update-deps', title 'chore: update dependencies' and path 'package.json'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Pull request created successfully! URL: https://github.com/octocat/hello-world/pull/4",
                    action: "PULL_REQUEST",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "GitHub create pull request on repository octocat/hello-world with branch 'docs/update-readme', title 'docs: update README' and path 'README.md'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Pull request created successfully! URL: https://github.com/octocat/hello-world/pull/5",
                    action: "GITHUB_CREATE_PULL_REQUEST",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "GitHub PR on repository octocat/hello-world with branch 'refactor/code-cleanup', title 'refactor: code cleanup' and path 'src/'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Pull request created successfully! URL: https://github.com/octocat/hello-world/pull/6",
                    action: "GITHUB_PR",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "GitHub generate PR on repository octocat/hello-world with branch 'test/add-tests', title 'test: add tests' and path 'tests/'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Pull request created successfully! URL: https://github.com/octocat/hello-world/pull/7",
                    action: "GITHUB_GENERATE_PR",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "GitHub pull request on repository octocat/hello-world with branch 'ci/update-workflow', title 'ci: update workflow' and path '.github/workflows/'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Pull request created successfully! URL: https://github.com/octocat/hello-world/pull/8",
                    action: "GITHUB_PULL_REQUEST",
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
    providers: [
        sourceCodeProvider,
        testFilesProvider,
        workflowFilesProvider,
        documentationFilesProvider,
        releasesProvider,
    ],
};
