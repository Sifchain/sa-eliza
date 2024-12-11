import { Provider } from "@ai16z/eliza";
import { fetchFiles } from "../utils/githubProviderUtil";

export const workflowFilesProvider: Provider = {
    get: async (runtime, message, state) => {
        return fetchFiles(
            runtime,
            message,
            state,
            "workflow files",
            (githubService) => githubService.getWorkflows(),
            (workflow) => workflow.path
        );
    },
};
