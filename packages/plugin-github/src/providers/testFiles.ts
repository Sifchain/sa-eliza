import { Provider } from "@ai16z/eliza";
import { fetchFiles } from "../utils/githubProviderUtil";

export const testFilesProvider: Provider = {
    get: async (runtime, message, state) => {
        const testPath = (state?.testPath as string) || ""; // Optional test directory path
        return fetchFiles(
            runtime,
            message,
            state,
            "test files",
            (githubService) => githubService.getTestFiles(testPath)
        );
    },
};
