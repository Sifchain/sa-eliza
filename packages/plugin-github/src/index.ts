import { githubCreateMemorizeFromFilesPlugin } from "./plugins/createMemoriesFromFiles";
import { githubCreatePullRequestPlugin } from "./plugins/createPullRequest";
import { githubInitializePlugin } from "./plugins/initialize";

export const plugins = {
    githubInitializePlugin,
    githubCreateMemorizeFromFilesPlugin,
    githubCreatePullRequestPlugin,
}

export * from "./plugins/initialize";
export * from "./plugins/createMemoriesFromFiles";
export * from "./plugins/createPullRequest";