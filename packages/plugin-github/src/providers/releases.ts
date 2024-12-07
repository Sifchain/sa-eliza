import { elizaLogger, IAgentRuntime, Memory, Provider } from "@ai16z/eliza";
import { GitHubService } from "../services/github";

export const releasesProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory) => {
        try {
            // Extract repository details from state
            const state = await runtime.composeState(message);
            const owner = state?.owner as string;
            const repo = state?.repo as string;

            if (!owner || !repo) {
                elizaLogger.warn("Missing repository details in state");
                return { releases: [], repository: null };
            }

            // Initialize GitHub service
            const githubService = new GitHubService({
                auth: runtime.getSetting("GITHUB_API_TOKEN"),
                owner,
                repo,
            });

            // Get all releases
            const releases = await githubService.getReleases();

            elizaLogger.info(
                `Retrieved ${releases.length} releases from ${owner}/${repo}`
            );

            return {
                releases,
                repository: {
                    owner,
                    repo,
                },
            };
        } catch (error) {
            elizaLogger.error("Error in releasesProvider:", error);
            return { releases: [], repository: null };
        }
    },
};
