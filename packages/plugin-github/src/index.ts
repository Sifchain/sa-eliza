import { githubInitializePlugin } from "./plugins/initializeRepository";
import { githubCreateMemorizeFromFilesPlugin } from "./plugins/createMemoriesFromFiles";
import { githubCreatePullRequestPlugin } from "./plugins/createPullRequest";
import { githubCreateCommitPlugin } from "./plugins/createCommit";

export const plugins = {
    githubInitializePlugin,
    githubCreateMemorizeFromFilesPlugin,
    githubCreatePullRequestPlugin,
    githubCreateCommitPlugin,
}

export * from "./plugins/initializeRepository";
export * from "./plugins/createMemoriesFromFiles";
export * from "./plugins/createPullRequest";
export * from "./plugins/createCommit";