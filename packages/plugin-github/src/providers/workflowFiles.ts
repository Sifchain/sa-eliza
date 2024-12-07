import { elizaLogger, IAgentRuntime, Memory, Provider } from "@ai16z/eliza";
import { GitHubService } from "../services/github";

export const workflowFilesProvider: Provider = {
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

            // Get all workflow files
            const workflows = await githubService.getWorkflows();

            // Get contents for each workflow file
            const workflowContents = await Promise.all(
                workflows.map(async (workflow) => {
                    const content = await githubService.getFileContents(
                        workflow.path
                    );
                    return { path: workflow.path, content };
                })
            );

            elizaLogger.info(
                `Retrieved ${workflowContents.length} workflow files from ${owner}/${repo}`
            );

            return {
                files: workflowContents,
                repository: {
                    owner,
                    repo,
                },
            };
        } catch (error) {
            elizaLogger.error("Error in workflowFilesProvider:", error);
            return { files: [], repository: null };
        }
    },
};
