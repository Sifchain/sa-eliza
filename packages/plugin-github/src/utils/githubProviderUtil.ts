import { elizaLogger, IAgentRuntime, Memory } from "@ai16z/eliza";
import { GitHubService } from "../services/github";

export async function fetchFiles(
    runtime: IAgentRuntime,
    message: Memory,
    fetchFunction: (githubService: GitHubService) => Promise<any[]>,
    formatPath: (path: any) => string,
    getContentFunction: (
        githubService: GitHubService,
        item: any
    ) => Promise<any> = (service, item) => service.getFileContents(item)
) {
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

        // Fetch file paths using the provided function
        const filePaths = await fetchFunction(githubService);

        // Get contents for each file
        const fileContents = await Promise.all(
            filePaths.map(async (path) => {
                path = formatPath(path);
                const content = await getContentFunction(githubService, path);
                return { path, content };
            })
        );

        elizaLogger.info(
            `Retrieved ${fileContents.length} files from ${owner}/${repo}`
        );

        return {
            files: fileContents,
            repository: {
                owner,
                repo,
            },
        };
    } catch (error) {
        elizaLogger.error("Error in fetchFiles:", error);
        return { files: [], repository: null };
    }
}
