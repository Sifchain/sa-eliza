import { Provider } from "@ai16z/eliza";
import { fetchFiles } from "../utils/githubProviderUtil";

export const testFilesProvider: Provider = {
    get: async (runtime, message) => {
        const state = await runtime.composeState(message);
        const testPath = (state?.testPath as string) || ""; // Optional test directory path
        return fetchFiles(runtime, message, (githubService) =>
            githubService.getTestFiles(testPath)
        );
    },
};
