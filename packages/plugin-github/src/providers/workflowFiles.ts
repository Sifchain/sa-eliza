import { Provider } from "@ai16z/eliza";
import { fetchFiles } from "../utils/githubProviderUtil";

export const workflowFilesProvider: Provider = {
    get: async (runtime, message) => {
        return fetchFiles(
            runtime,
            message,
            (githubService) => githubService.getWorkflows(),
            (workflow) => workflow.path
        );
    },
};
