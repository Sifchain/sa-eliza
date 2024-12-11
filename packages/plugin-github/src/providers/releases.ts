import { Provider } from "@ai16z/eliza";
import { fetchFiles } from "../utils/githubProviderUtil";
import { GitHubService } from "../services/github";

export const releasesProvider: Provider = {
    get: async (runtime, message, state) => {
        return fetchFiles(
            runtime,
            message,
            state,
            "releases",
            (githubService) => githubService.getReleases(),
            (release) => release,
            async (githubService, path) => path
        );
    },
};
