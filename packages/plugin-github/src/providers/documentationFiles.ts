import { elizaLogger, IAgentRuntime, Memory, Provider } from "@ai16z/eliza";
import { GitHubService } from "../services/github";

export const documentationFilesProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory) => {
        try {
            // Extract repository details from state
            const state = await runtime.composeState(message);
            const owner = state?.owner as string;
            const repo = state?.repo as string;

            if (!owner || !repo) {
                elizaLogger.warn("Missing repository details in state");
                return { files: [], repository: null };
            }

            // Initialize GitHub service
            const githubService = new GitHubService({
                auth: runtime.getSetting("GITHUB_API_TOKEN"),
                owner,
                repo,
            });

            // Get all documentation files
            const docFiles = await githubService.getDocumentation();

            // Get contents for each documentation file
            const docContents = await Promise.all(
                docFiles.map(async (path) => {
                    const content = await githubService.getFileContents(path);
                    return { path: path, content };
                })
            );

            elizaLogger.info(
                `Retrieved ${docContents.length} documentation files from ${owner}/${repo}`
            );

            return {
                files: docContents,
                repository: {
                    owner,
                    repo,
                },
            };
        } catch (error) {
            elizaLogger.error("Error in documentationFilesProvider:", error);
            return { files: [], repository: null };
        }
    },
};
