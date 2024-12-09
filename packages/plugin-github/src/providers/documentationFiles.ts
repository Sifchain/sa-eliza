import { Provider } from "@ai16z/eliza";
import { fetchFiles } from "../utils/githubProviderUtil";

export const documentationFilesProvider: Provider = {
    get: async (runtime, message) => {
        return fetchFiles(runtime, message, (githubService) =>
            githubService.getDocumentation()
        );
    },
};
