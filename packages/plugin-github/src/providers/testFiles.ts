import { elizaLogger, IAgentRuntime, Memory, Provider } from "@ai16z/eliza";
import { GitHubService } from "../services/github";

export const testFilesProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory) => {
        try {
            // Extract repository details from state
            const state = await runtime.composeState(message);
            const owner = state?.owner as string;
            const repo = state?.repo as string;
            const testPath = (state?.testPath as string) || ""; // Optional test directory path

            if (!owner || !repo) {
                elizaLogger.warn("Missing repository details in state");
                return { files: [], content: {} };
            }

            // Initialize GitHub service
            const githubService = new GitHubService({
                auth: runtime.getSetting("GITHUB_API_TOKEN"),
                owner,
                repo,
            });

            // Get test files paths
            const testFilePaths = await githubService.getTestFiles(testPath);

            // Get contents for each test file
            const testFiles = await Promise.all(
                testFilePaths.map(async (path) => {
                    const content = await githubService.getFileContents(path);
                    return { path, content };
                })
            );

            elizaLogger.info(
                `Retrieved ${testFiles.length} test files from ${owner}/${repo}`
            );

            return {
                files: testFiles,
                repository: {
                    owner,
                    repo,
                },
            };
        } catch (error) {
            elizaLogger.error("Error in testFilesProvider:", error);
            return { files: [], repository: null };
        }
    },
};
