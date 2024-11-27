import { githubInitializePlugin } from "./plugins/initialize";
import { githubCreateMemorizeFromFilesPlugin } from "./plugins/createMemoriesFromFiles";
import { githubCreatePullRequestPlugin } from "./plugins/createPullRequest";
import { githubCreateCommitPlugin } from "./plugins/createCommit";

export const plugins = {
    githubInitializePlugin,
    githubCreateMemorizeFromFilesPlugin,
    githubCreatePullRequestPlugin,
    githubCreateCommitPlugin,
}

export * from "./plugins/initialize";
export * from "./plugins/createMemoriesFromFiles";
export * from "./plugins/createPullRequest";
export * from "./plugins/createCommit";