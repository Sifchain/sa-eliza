import { Octokit } from "@octokit/rest";
import { glob } from "glob";
import simpleGit, { SimpleGit } from "simple-git";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { createHash } from "crypto";
import { composeContext, elizaLogger, generateObjectV2, Action, HandlerCallback, IAgentRuntime, Memory, ModelClass, Plugin, State } from "@ai16z/eliza";
import { createPullRequestTemplate } from "../templates";
import { CreatePullRequestContent, CreatePullRequestSchema, isCreatePullRequestContent } from "../types";

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

export async function createNewBranch(repoPath: string, branch: string) {
    try {
        // Create a new branch
        const git = simpleGit(repoPath);
        await git.checkoutLocalBranch(branch);
    } catch (error) {
        throw new Error(`Error creating new branch: ${error}`);
    }
}

export const createPullRequestAction: Action = {
    name: "CREATE_PULL_REQUEST",
    similes: ["CREATE_PR"],
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

        const repoPath = path.join(
            process.cwd(),
            ".repos",
            content.owner,
            content.repo,
        );

        try {
            await createNewBranch(repoPath, content.branch);

            // TODO: write files to the repository

            // TODO: commit and push changes

            // TODO: create a pull request

            elizaLogger.info("Pull request created successfully!");

            callback(
                {
                    text: "Pull request created successfully!",
                    attachments: [],
                }
            );
        } catch (error) {
            elizaLogger.error(`Error creating pull request on ${content.owner}/${content.repo} branch ${content.branch} path ${content.path}:`, error);
            callback(
                {
                    text: `Error creating pull request on ${content.owner}/${content.repo} branch ${content.branch} path ${content.path}. Please try again.`,
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
