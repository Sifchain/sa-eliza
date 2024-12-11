import { Provider } from "@ai16z/eliza";
import { fetchFiles } from "../utils/githubProviderUtil";

export const sourceCodeProvider: Provider = {
    get: async (runtime, message, state) => {
        return fetchFiles(
            runtime,
            message,
            state,
            "source code",
            (githubService) => githubService.getSourceFiles("")
        );
    },
};
