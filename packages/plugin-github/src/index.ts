import { githubInitializePlugin } from "./plugins/initializeRepository";
import { githubCreateMemorizeFromFilesPlugin } from "./plugins/createMemoriesFromFiles";
import { githubCreatePullRequestPlugin } from "./plugins/createPullRequest";
import { githubCreateCommitPlugin } from "./plugins/createCommit";
import { githubCreateIssuePlugin } from "./plugins/createIssue";
import { githubModifyIssuePlugin } from "./plugins/modifyIssue";
import { githubAddCommentToIssuePlugin } from "./plugins/addCommentToIssue";

export const plugins = {
    githubInitializePlugin,
    githubCreateMemorizeFromFilesPlugin,
    githubCreatePullRequestPlugin,
    githubCreateCommitPlugin,
    githubCreateIssuePlugin,
    githubModifyIssuePlugin,
    githubAddCommentToIssuePlugin,
};

export * from "./plugins/initializeRepository";
export * from "./plugins/createMemoriesFromFiles";
export * from "./plugins/createPullRequest";
export * from "./plugins/createCommit";
export * from "./plugins/createIssue";
export * from "./plugins/modifyIssue";
export * from "./plugins/addCommentToIssue";
