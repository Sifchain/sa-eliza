import { Octokit, RestEndpointMethodTypes } from "@octokit/rest";
import { elizaLogger } from "@ai16z/eliza";

interface GitHubConfig {
    owner: string;
    repo: string;
    auth: string;
}

export class GitHubService {
    private octokit: Octokit;
    private config: GitHubConfig;

    constructor(config: GitHubConfig) {
        this.config = config;
        this.octokit = new Octokit({ auth: config.auth });
    }

    // Scenario 1 & 2: Get file contents for code analysis
    async getFileContents(path: string): Promise<string> {
        try {
            const response = await this.octokit.repos.getContent({
                owner: this.config.owner,
                repo: this.config.repo,
                path,
            });

            // GitHub API returns content as base64
            if ("content" in response.data && !Array.isArray(response.data)) {
                return Buffer.from(response.data.content, "base64").toString();
            }
            throw new Error("Unable to get file contents");
        } catch (error) {
            elizaLogger.error(`Error getting file contents: ${error}`);
            throw error;
        }
    }

    // Scenario 3: Get test files
    async getTestFiles(testPath: string): Promise<string[]> {
        try {
            const response = await this.octokit.repos.getContent({
                owner: this.config.owner,
                repo: this.config.repo,
                path: testPath,
            });

            if (Array.isArray(response.data)) {
                return response.data
                    .filter(
                        (file) =>
                            file.type === "file" && file.name.includes("test")
                    )
                    .map((file) => file.path);
            }
            return [];
        } catch (error) {
            elizaLogger.error(`Error getting test files: ${error}`);
            throw error;
        }
    }

    // Scenario 4: Get workflow files
    async getWorkflows(): Promise<
        RestEndpointMethodTypes["actions"]["listRepoWorkflows"]["response"]["data"]["workflows"]
    > {
        try {
            const response = await this.octokit.actions.listRepoWorkflows({
                owner: this.config.owner,
                repo: this.config.repo,
            });

            return response.data.workflows;
        } catch (error) {
            elizaLogger.error(`Error getting workflows: ${error}`);
            throw error;
        }
    }

    // Scenario 5: Get documentation files
    async getDocumentation(docPath: string = ""): Promise<string[]> {
        try {
            const response = await this.octokit.repos.getContent({
                owner: this.config.owner,
                repo: this.config.repo,
                path: docPath,
            });

            if (Array.isArray(response.data)) {
                return response.data
                    .filter(
                        (file) =>
                            file.type === "file" &&
                            (file.name.toLowerCase().includes("readme") ||
                                file.name.toLowerCase().includes("docs") ||
                                file.path.includes(".md"))
                    )
                    .map((file) => file.path);
            }
            return [];
        } catch (error) {
            elizaLogger.error(`Error getting documentation: ${error}`);
            throw error;
        }
    }

    // Scenario 6: Get releases and changelogs
    async getReleases(): Promise<
        RestEndpointMethodTypes["repos"]["listReleases"]["response"]["data"]
    > {
        try {
            const response = await this.octokit.repos.listReleases({
                owner: this.config.owner,
                repo: this.config.repo,
            });

            return response.data;
        } catch (error) {
            elizaLogger.error(`Error getting releases: ${error}`);
            throw error;
        }
    }

    // Scenario 7: Get source files for refactoring analysis
    async getSourceFiles(sourcePath: string): Promise<string[]> {
        try {
            const response = await this.octokit.repos.getContent({
                owner: this.config.owner,
                repo: this.config.repo,
                path: sourcePath,
            });

            if (Array.isArray(response.data)) {
                return response.data
                    .filter(
                        (file) =>
                            file.type === "file" &&
                            !file.name.toLowerCase().includes("test")
                    )
                    .map((file) => file.path);
            }
            return [];
        } catch (error) {
            elizaLogger.error(`Error getting source files: ${error}`);
            throw error;
        }
    }
}

export { GitHubConfig };
