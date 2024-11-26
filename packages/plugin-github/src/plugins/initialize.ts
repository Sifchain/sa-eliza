import simpleGit from "simple-git";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { composeContext, elizaLogger, generateObjectV2, Action, HandlerCallback, IAgentRuntime, Memory, ModelClass, Plugin, State } from "@ai16z/eliza";
import { initializeTemplate } from "../templates";
import { InitializeContent, InitializeSchema, isInitializeContent } from "../types";

export async function createReposDirectory(owner: string) {
    try {
        // Create repos directory if it doesn't exist
        await fs.mkdir(path.join(process.cwd(), ".repos", owner), {
            recursive: true,
        });
    } catch (error) {
        throw new Error(`Error creating repos directory: ${error}`);
    }
}

export async function cloneOrPullRepository(owner: string, repo: string, repoPath: string) {
    try {
        // Clone or pull repository
        if (!existsSync(repoPath)) {
            await this.git.clone(
                `https://github.com/${owner}/${repo}.git`,
                repoPath
            );
        } else {
            const git = simpleGit(repoPath);
            await git.pull();
        }
    } catch (error) {
        throw new Error(`Error cloning or pulling repository: ${error}`);
    }
}

export async function checkoutBranch(repoPath: string, branch: string) {
    try {
        // Checkout specified branch if provided
        if (branch) {
            const git = simpleGit(repoPath);
            await git.checkout(branch);
        }
    } catch (error) {
        throw new Error(`Error checking out branch: ${error}`);
    }
}

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
        if (!content.owner) {
            callback(
                {
                    text: "Missing github owner. Please provide the owner of the GitHub repository.",
                },
                [],
            );
            return;
        }
        if (!content.repo) {
            callback(
                {
                    text: "Missing github repo. Please provide the name of the GitHub repository.",
                },
                [],
            );
            return;
        }
        if (!content.branch) {
            callback(
                {
                    text: "Missing github branch. Please provide the branch of the GitHub repository.",
                },
                [],
            );
            return;
        }

        elizaLogger.info("Initializing repository...");

        const repoPath = path.join(
            process.cwd(),
            ".repos",
            content.owner,
            content.repo,
        );

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
    },
    examples: [
        [
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
