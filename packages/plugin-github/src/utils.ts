import fs from "fs/promises";
import path from "path";
import { glob } from "glob";
import { existsSync } from "fs";
import simpleGit from "simple-git";
import { Octokit } from "@octokit/rest";
import { elizaLogger } from "@ai16z/eliza";

export function getRepoPath(owner: string, repo: string) {
    return path.join(
        process.cwd(),
        ".repos",
        owner,
        repo,
    );
}

export async function createReposDirectory(owner: string) {
    try {
        // Create repos directory if it doesn't exist
        await fs.mkdir(path.join(process.cwd(), ".repos", owner), {
            recursive: true,
        });
    } catch (error) {
        elizaLogger.error("Error creating repos directory:", error);
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
        elizaLogger.error(`Error cloning or pulling repository ${owner}/${repo}:`, error);
        throw new Error(`Error cloning or pulling repository: ${error}`);
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
        elizaLogger.error("Error writing files:", error);
        throw new Error(`Error writing files: ${error}`);
    }
}

interface CommitAndPushChangesResponse {
    hash: string;
}

export async function commitAndPushChanges(repoPath: string, message: string, branch?: string) {
    try {
        const git = simpleGit(repoPath);
        await git.add(".");
        const commit = await git.commit(message);
        if (branch) {
            await git.push("origin", branch);
        } else {
            await git.push();
        }
        return {
            hash: commit.commit,
        } as CommitAndPushChangesResponse;
    } catch (error) {
        elizaLogger.error("Error committing and pushing changes:", error);
        throw new Error(`Error committing and pushing changes: ${error}`);
    }
}

export async function checkoutBranch(repoPath: string, branch?: string, create: boolean = false) {
    if (!branch) {
        return;
    }

    try {
        // Checkout specified branch
        const git = simpleGit(repoPath);
        if (create) {
            // create a new branch if it doesn't exist
            await git.checkoutLocalBranch(branch);
        } else {
            // checkout an existing branch
            await git.checkout(branch);
        }
    } catch (error) {
        elizaLogger.error("Error checking out branch:", error);
        throw new Error(`Error checking out branch: ${error}`);
    }
}

interface CreatePullRequestResponse {
    url: string;
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

        return {
            url: pr.data.html_url,
        } as CreatePullRequestResponse;
    } catch (error) {
        elizaLogger.error("Error creating pull request:", error);
        throw new Error(`Error creating pull request: ${error}`);
    }
}

export async function retrieveFiles(repoPath: string, gitPath: string) {
    const searchPath = gitPath
        ? path.join(repoPath, gitPath, "**/*")
        : path.join(repoPath, "**/*");

    const files = await glob(searchPath, { nodir: true });

    return files
}