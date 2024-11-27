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

export async function createNewBranch(repoPath: string, branch: string) {
    try {
        // Create a new branch
        const git = simpleGit(repoPath);
        await git.checkoutLocalBranch(branch);
    } catch (error) {
        throw new Error(`Error creating new branch: ${error}`);
    }
}

export async function writeFiles(repoPath: string, files: Array<{ path: string; content: string }>) {
    try {
        for (const file of files) {
            const filePath = path.join(repoPath, file.path);
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, file.content);
        }
    } catch (error) {
        throw new Error(`Error writing files: ${error}`);
    }
}

export async function commitAndPushChanges(repoPath: string, branch: string, title: string) {
    try {
        const git = simpleGit(repoPath);
        await git.add(".");
        await git.commit(title);
        await git.push("origin", branch);
    } catch (error) {
        throw new Error(`Error committing and pushing changes: ${error}`);
    }
}

export async function createPullRequest(token: string, owner: string, repo: string, branch: string, title: string, description?: string, base?: string) {
    try {
        const octokit = new Octokit({
            auth: token,
        });

        const pr = await octokit.pulls.create({
            owner,
            repo,
            title,
            body: description || title,
            head: branch,
            base: base || "main",
        });

        return pr.data;
    } catch (error) {
        throw new Error(`Error creating pull request: ${error}`);
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
            await writeFiles(repoPath, content.files);
            await commitAndPushChanges(repoPath, content.branch, content.title);
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
