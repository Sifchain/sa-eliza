import {
    Action,
    IAgentRuntime,
    HandlerCallback,
    Memory,
    State,
    elizaLogger,
    composeContext,
    generateObject,
    ModelClass,
    Plugin,
} from "@elizaos/core";
import { GitHubService } from "../services/github";
import {
    AddCommentToPRContent,
    AddCommentToPRSchema,
    ClosePRActionContent,
    ClosePRActionSchema,
    GenerateCommentForASpecificPRSchema,
    GeneratePRCommentReplyContent,
    GeneratePRCommentReplySchema,
    MergePRActionContent,
    MergePRActionSchema,
    ReactToPRContent,
    ReactToPRSchema,
    ReplyToPRCommentContent,
    ReplyToPRCommentSchema,
    isAddCommentToPRContent,
    isClosePRActionContent,
    isGenerateCommentForASpecificPRSchema,
    isGeneratePRCommentReplyContent,
    isMergePRActionContent,
    isReactToPRContent,
    isReplyToPRCommentContent,
} from "../types";
import {
    getPullRequestFromMemories,
    incorporateRepositoryState,
} from "../utils";
import {
    addCommentToPRTemplate,
    closePRActionTemplate,
    generateCommentForASpecificPRTemplate,
    generatePRCommentReplyTemplate,
    mergePRActionTemplate,
    reactToPRTemplate,
    replyToPRCommentTemplate,
} from "../templates";
import fs from "fs/promises";

export const reactToPRAction: Action = {
    name: "REACT_TO_PR",
    similes: [
        "ADD_REACTION_PR",
        "REACT_TO_PR",
        "ADD_REACTION_PR",
        "POST_REACTION_PR",
    ],
    description:
        "Adds a reaction to a comment in a pull request in the GitHub repository",
    validate: async (runtime: IAgentRuntime) => {
        const token = !!runtime.getSetting("GITHUB_API_TOKEN");
        return token;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback?: HandlerCallback
    ) => {
        elizaLogger.log("[reactToPR] Composing state for message:", message);
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }
        const updatedState = await incorporateRepositoryState(
            state,
            runtime,
            message,
            [],
            false,
            true
        );
        elizaLogger.info("State:", updatedState);

        const context = composeContext({
            state: updatedState,
            template: reactToPRTemplate,
        });
        const details = await generateObject({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
            schema: ReactToPRSchema,
        });

        if (!isReactToPRContent(details.object)) {
            elizaLogger.error("Invalid content:", details.object);
            throw new Error("Invalid content");
        }

        const content = details.object as ReactToPRContent;
        const githubService = new GitHubService({
            owner: content.owner,
            repo: content.repo,
            auth: runtime.getSetting("GITHUB_API_TOKEN"),
        });
        elizaLogger.info("Adding reaction to pull request comment...");

        try {
            const reaction =
                await githubService.createReactionForPullRequestReviewComment(
                    content.owner,
                    content.repo,
                    content.pullRequest,
                    content.reaction
                );
            const pr = await githubService.getPullRequest(content.pullRequest);
            elizaLogger.info("Reaction:", JSON.stringify(reaction, null, 2));
            elizaLogger.info(
                `Added reaction to pull request #${content.pullRequest} successfully! PR: ${pr.html_url}`
            );
            if (callback) {
                callback({
                    text: `Added reaction to pull request #${content.pullRequest} successfully! PR: ${pr.html_url}`,
                    attachments: [],
                });
            }
        } catch (error) {
            elizaLogger.error(
                `Error adding reaction to pull request #${content.pullRequest} in repository ${content.owner}/${content.repo}:`,
                error
            );
            if (callback) {
                callback(
                    {
                        text: `Error adding reaction to pull request #${content.pullRequest}. Please try again.`,
                    },
                    []
                );
            }
        }
    },
    examples: [
        [
            {
                user: "{{user}}",
                content: {
                    text: "React to pull request #1 in repository user1/repo1 with a thumbs up",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Added reaction to pull request #1 successfully!",
                    action: "REACT_TO_PR",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "React to pull request #2 in repository user2/repo2 with a heart (like showing love)",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Added reaction to pull request #2 successfully! (like a charm)",
                    action: "REACT_TO_PR",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "React to pull request #3 in repository user3/repo3 with a laugh (like a burst of joy)",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Added reaction to pull request #3 successfully! (like a breeze)",
                    action: "REACT_TO_PR",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "React to pull request #4 in repository user4/repo4 with a rocket (like shooting for the stars)",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Added reaction to pull request #4 successfully! (like a rocket launch)",
                    action: "REACT_TO_PR",
                },
            },
        ],
    ],
};

export const addCommentToPRAction: Action = {
    name: "COMMENT_ON_PULL_REQUEST",
    similes: [
        "COMMENT_ON_PR",
        "REVIEW_PR",
        "REVIEW_PULL_REQUEST",
        "ADD_REVIEW_COMMENT_TO_PR",
        "ADD_REVIEW_COMMENT_TO_PULL_REQUEST",
        "ADD_COMMENT_TO_PR",
        "ADD_COMMENT_TO_PULL_REQUEST",
        "POST_COMMENT_PR",
        "ADD_COMMENT_PR",
    ],
    description:
        "Adds a comment and review to an existing pull request in the GitHub repository",
    validate: async (runtime: IAgentRuntime) => {
        const token = !!runtime.getSetting("GITHUB_API_TOKEN");
        return token;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback?: HandlerCallback
    ) => {
        elizaLogger.log(
            "[addCommentToPR] Composing state for message:",
            message
        );
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }
        const updatedState = await incorporateRepositoryState(
            state,
            runtime,
            message,
            [],
            false,
            true
        );
        elizaLogger.info("State:", updatedState);

        const context = composeContext({
            state: updatedState,
            template: addCommentToPRTemplate,
        });
        // write the context to a file for testing
        // await fs.writeFile("/tmp/context.txt", context);
        const details = await generateObject({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
            schema: AddCommentToPRSchema,
        });

        if (!isAddCommentToPRContent(details.object)) {
            elizaLogger.error("Invalid content:", details.object);
            throw new Error("Invalid content");
        }

        const content = details.object as AddCommentToPRContent;
        const githubService = new GitHubService({
            owner: content.owner,
            repo: content.repo,
            auth: runtime.getSetting("GITHUB_API_TOKEN"),
        });
        elizaLogger.info("Adding comment to pull request in the repository...");
        let pullRequest = await getPullRequestFromMemories(
            runtime,
            message,
            content.pullRequest
        );
        let pr = await githubService.getPullRequest(content.pullRequest);
        const diffText = await githubService.getPRDiffText(pr.diff_url);
        if (!pullRequest) {
            elizaLogger.error("Pull request not found in memories");
            const prData = {
                type: "pull_request",
                url: pr.html_url,
                number: pr.number,
                state: pr.state,
                created_at: pr.created_at,
                updated_at: pr.updated_at,
                comments: await githubService.getPRCommentsText(
                    pr.review_comment_url
                ),
                nonReviewComments: await githubService.getPRCommentsText(
                    pr.comments_url
                ),
                labels: pr.labels.map((label: any) =>
                    typeof label === "string" ? label : label?.name
                ),
                body: pr.body,
                diff: diffText,
                lineLevelComments: [],
            };
            updatedState.specificPullRequest = JSON.stringify(prData);
        } else {
            updatedState.specificPullRequest = JSON.stringify(
                pullRequest.content
            );
        }

        const commentContext = composeContext({
            state: updatedState,
            template: generateCommentForASpecificPRTemplate,
        });
        // await fs.writeFile("/tmp/commentContext.txt", commentContext);
        const commentDetails = await generateObject({
            runtime,
            context: commentContext,
            modelClass: ModelClass.SMALL,
            schema: GenerateCommentForASpecificPRSchema,
        });

        if (!isGenerateCommentForASpecificPRSchema(commentDetails.object)) {
            elizaLogger.error(
                "Invalid comment content:",
                commentDetails.object
            );
            throw new Error("Invalid comment content");
        }

        const comment = commentDetails.object;
        elizaLogger.info(
            "Adding comment to pull request in the repository...",
            {
                pullRequest,
                comment,
                lineLevelComments: comment.lineLevelComments,
            }
        );
        const sanitizedLineLevelComments = await Promise.all(
            comment.lineLevelComments.map(async (lineLevelComment) => {
                return await githubService.addLineLevelComment(
                    diffText,
                    lineLevelComment.path,
                    lineLevelComment.line,
                    lineLevelComment.body
                );
            })
        );
        // await fs.writeFile("/tmp/diffText.txt", diffText);
        // await fs.writeFile("/tmp/comment.txt", JSON.stringify(comment, null, 2));
        // await fs.writeFile("/tmp/sanitizedLineLevelComments.txt", JSON.stringify(sanitizedLineLevelComments, null, 2));
        try {
            const addedComment = await githubService.addPRCommentAndReview(
                content.pullRequest,
                comment.comment,
                sanitizedLineLevelComments,
                comment.approvalEvent
            );
            elizaLogger.info("Comment:", JSON.stringify(comment, null, 2));
            elizaLogger.info(
                `Added comment to pull request #${content.pullRequest} successfully! See comment at ${addedComment.html_url}. Approval status: ${comment.approvalEvent}`
            );
            if (content.emojiReaction) {
                // TODO: add emoji reaction to pull request which this library doesn't support
                // await githubService.createReactionForPullRequestReviewComment(
                //     content.owner,
                //     content.repo,
                //     content.pullRequest,
                //     content.emojiReaction
                // );
                // elizaLogger.info(
                //     `Added emoji reaction to pull request #${content.pullRequest} successfully!`
                // );
            }
            if (callback) {
                callback({
                    text: `Added comment to pull request #${content.pullRequest} successfully! See comment at ${addedComment.html_url}`,
                    attachments: [],
                });
            }
        } catch (error) {
            elizaLogger.error(
                `Error adding comment to pull request #${content.pullRequest} in repository ${content.owner}/${content.repo}:`,
                error
            );
            if (callback) {
                callback(
                    {
                        text: `Error adding comment to pull request #${content.pullRequest}. Please try again.`,
                    },
                    []
                );
            }
        }
    },
    examples: [
        [
            {
                user: "{{user}}",
                content: {
                    text: "Add a comment to pull request #1 in repository user1/repo1: 'This is fixed in the latest release'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Added comment to pull request #1 successfully!",
                    action: "ADD_COMMENT_PR",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Add a comment to pull request #2 in repository user2/repo2: 'Please review the changes'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Added comment to pull request #2 successfully!",
                    action: "ADD_COMMENT_PR",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Add a comment to pull request #3 in repository user3/repo3: 'Great work on this feature!'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Added comment to pull request #3 successfully!",
                    action: "ADD_COMMENT_PR",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Add a comment to pull request #4 in repository user4/repo4: 'Can you add more tests?'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Added comment to pull request #4 successfully!",
                    action: "ADD_COMMENT_PR",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Add a comment to pull request #5 in repository user5/repo5: 'This needs some refactoring'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Added comment to pull request #5 successfully!",
                    action: "ADD_COMMENT_PR",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Add a comment to pull request #6 in repository user6/repo6: 'Looks good to me', approve the changes",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Added comment and approved pull request #6 successfully!",
                    action: "COMMENT_ON_PULL_REQUEST",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Add a comment to pull request #7 in repository user7/repo7: 'Needs more work', request changes",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Added comment and requested changes for pull request #7 successfully!",
                    action: "COMMENT_ON_PULL_REQUEST",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Add a comment to pull request #8 in repository user8/repo8: 'I have some questions', comment only",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Added comment to pull request #8 successfully!",
                    action: "COMMENT_ON_PULL_REQUEST",
                },
            },
        ],
    ],
};

export const closePRAction: Action = {
    name: "CLOSE_PULL_REQUEST",
    similes: ["CLOSE_PR", "CLOSE_PULL_REQUEST"],
    description: "Closes a pull request in the GitHub repository",
    validate: async (runtime: IAgentRuntime) => {
        const token = !!runtime.getSetting("GITHUB_API_TOKEN");
        return token;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback?: HandlerCallback
    ) => {
        elizaLogger.log("[closePR] Composing state for message:", message);
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }
        const updatedState = await incorporateRepositoryState(
            state,
            runtime,
            message,
            [],
            false,
            true
        );
        elizaLogger.info("State:", updatedState);

        const context = composeContext({
            state: updatedState,
            template: closePRActionTemplate,
        });
        const details = await generateObject({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
            schema: ClosePRActionSchema,
        });

        if (!isClosePRActionContent(details.object)) {
            elizaLogger.error("Invalid content:", details.object);
            throw new Error("Invalid content");
        }

        const content = details.object as ClosePRActionContent;
        const githubService = new GitHubService({
            owner: content.owner,
            repo: content.repo,
            auth: runtime.getSetting("GITHUB_API_TOKEN"),
        });
        elizaLogger.info("Closing pull request...");

        try {
            const pr = await githubService.updatePullRequest(
                content.owner,
                content.repo,
                content.pullRequest,
                undefined,
                undefined,
                "closed"
            );
            elizaLogger.info("Pull request:", JSON.stringify(pr, null, 2));
            elizaLogger.info(
                `Closed pull request #${content.pullRequest} successfully!`
            );
            if (callback) {
                callback({
                    text: `Closed pull request #${content.pullRequest} successfully!`,
                    attachments: [],
                });
            }
        } catch (error) {
            elizaLogger.error(
                `Error closing pull request #${content.pullRequest} in repository ${content.owner}/${content.repo}:`,
                error
            );
            if (callback) {
                callback(
                    {
                        text: `Error closing pull request #${content.pullRequest}. Please try again.`,
                    },
                    []
                );
            }
        }
    },
    examples: [
        [
            {
                user: "{{user}}",
                content: {
                    text: "Close pull request #1 in repository user1/repo1",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Closed pull request #1 successfully!",
                    action: "CLOSE_PR",
                },
            },
        ],
    ],
};

export const mergePRAction: Action = {
    name: "MERGE_PULL_REQUEST",
    similes: [
        "MERGE_PR",
        "SQUASH_PR",
        "SQUASH_PULL_REQUEST",
        "REBASE_PR",
        "REBASE_PULL_REQUEST",
        "MERGE_PULL_REQUEST",
    ],
    description: "Merges a pull request in the GitHub repository",
    validate: async (runtime: IAgentRuntime) => {
        const token = !!runtime.getSetting("GITHUB_API_TOKEN");
        return token;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback?: HandlerCallback
    ) => {
        elizaLogger.log("[mergePR] Composing state for message:", message);
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }
        const updatedState = await incorporateRepositoryState(
            state,
            runtime,
            message,
            [],
            false,
            true
        );
        elizaLogger.info("State:", updatedState);

        const context = composeContext({
            state: updatedState,
            template: mergePRActionTemplate,
        });
        const details = await generateObject({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
            schema: MergePRActionSchema,
        });

        if (!isMergePRActionContent(details.object)) {
            elizaLogger.error("Invalid content:", details.object);
            throw new Error("Invalid content");
        }

        const content = details.object as MergePRActionContent;
        const githubService = new GitHubService({
            owner: content.owner,
            repo: content.repo,
            auth: runtime.getSetting("GITHUB_API_TOKEN"),
        });
        elizaLogger.info("Merging pull request...");

        try {
            const mergeResult = await githubService.mergePullRequest(
                content.owner,
                content.repo,
                content.pullRequest,
                content.mergeMethod
            );
            elizaLogger.info(
                "Merge result:",
                JSON.stringify(mergeResult, null, 2)
            );
            elizaLogger.info(
                `Merged pull request #${content.pullRequest} successfully!`
            );
            if (callback) {
                callback({
                    text: `Merged pull request #${content.pullRequest} successfully!`,
                    attachments: [],
                });
            }
        } catch (error) {
            elizaLogger.error(
                `Error merging pull request #${content.pullRequest} in repository ${content.owner}/${content.repo}:`,
                error
            );
            if (callback) {
                callback(
                    {
                        text: `Error merging pull request #${content.pullRequest}. Please try again.`,
                    },
                    []
                );
            }
        }
    },
    examples: [
        [
            {
                user: "{{user}}",
                content: {
                    text: "Merge pull request #1 in repository user1/repo1 using merge method 'squash'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Merged pull request #1 successfully!",
                    action: "MERGE_PULL_REQUEST",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Merge pull request #2 in repository user2/repo2 using merge method 'merge'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Merged pull request #2 successfully!",
                    action: "MERGE_PULL_REQUEST",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Merge pull request #3 in repository user3/repo3 using merge method 'rebase'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Merged pull request #3 successfully!",
                    action: "MERGE_PULL_REQUEST",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Merge pull request #4 in repository user4/repo4",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Merged pull request #4 successfully!",
                    action: "MERGE_PULL_REQUEST",
                },
            },
        ],
    ],
};

export const replyToPRCommentAction: Action = {
    name: "REPLY_TO_PR_COMMENT",
    similes: [
        "REPLY_PR_COMMENT",
        "RESPOND_TO_PR_COMMENT",
        "ANSWER_PR_COMMENT",
    ],
    description:
        "Replies to a specific comment in a pull request in the GitHub repository",
    validate: async (runtime: IAgentRuntime) => {
        const token = !!runtime.getSetting("GITHUB_API_TOKEN");
        return token;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback?: HandlerCallback
    ) => {
        elizaLogger.log("[replyToPRComment] Composing state for message:", message);
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }
        const updatedState = await incorporateRepositoryState(
            state,
            runtime,
            message,
            [],
            false,
            true
        );
        elizaLogger.info("State:", updatedState);

        const context = composeContext({
            state: updatedState,
            template: replyToPRCommentTemplate,
        });
        const details = await generateObject({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
            schema: ReplyToPRCommentSchema,
        });

        if (!isReplyToPRCommentContent(details.object)) {
            elizaLogger.error("Invalid content:", details.object);
            throw new Error("Invalid content");
        }

        const content = details.object as ReplyToPRCommentContent;

        const githubService = new GitHubService({
            owner: content.owner,
            repo: content.repo,
            auth: runtime.getSetting("GITHUB_API_TOKEN"),
        });
        // reply to all comments in the pull request
        const pullRequest = await githubService.getPullRequest(content.pullRequest);
        updatedState.specificPullRequest = JSON.stringify(pullRequest);
        elizaLogger.info("Pull request:", JSON.stringify(pullRequest, null, 2));
        const reviewCommentsUrl = pullRequest.review_comments_url;
        elizaLogger.info("Review Comments URL:", reviewCommentsUrl);
        const reviewComments = await githubService.getPRCommentsText(reviewCommentsUrl);
        elizaLogger.info("Review Comments:", JSON.stringify(reviewComments, null, 2));
        const reviewCommentsArray = JSON.parse(reviewComments);
        const nonReviewComments = await githubService.getPRCommentsText(pullRequest.comments_url);
        elizaLogger.info("Non-Review Comments:", JSON.stringify(nonReviewComments, null, 2));
        const nonReviewCommentsArray = JSON.parse(nonReviewComments);
        const allComments = [...reviewCommentsArray, ...nonReviewCommentsArray];
        for (const comment of allComments) {
            const replyContext = composeContext({
                state: updatedState,
                template: generatePRCommentReplyTemplate,
            });
            const replyDetails = await generateObject({
                runtime,
                context: replyContext,
                modelClass: ModelClass.SMALL,
                schema: GeneratePRCommentReplySchema,
            });

        if (!isGeneratePRCommentReplyContent(replyDetails.object)) {
            elizaLogger.error("Invalid reply content:", replyDetails.object);
            throw new Error("Invalid reply content");
        }

        const replyContent = replyDetails.object as GeneratePRCommentReplyContent;
        if (replyContent.comment === "") {
            elizaLogger.info("No comment to reply to, skipping...");
            continue;
        }
        elizaLogger.info("Replying to pull request comment...", JSON.stringify(replyContent, null, 2));
        try {
            const repliedMessage = await githubService.replyToPRComment(content.pullRequest, comment.id, replyContent.comment, replyContent.emojiReaction)
            elizaLogger.log("Replied message:", JSON.stringify(repliedMessage, null, 2));
            elizaLogger.info(
                `Replied to comment #${comment.id} in pull request #${content.pullRequest} successfully with emoji reaction: ${replyContent.emojiReaction}!`
            );
            if (callback) {
                callback({
                    text: `Replied to comment #${comment.id} in pull request #${content.pullRequest} successfully with emoji reaction: ${replyContent.emojiReaction}!`,
                    attachments: [],
                });
            }
        }
        catch (error) {
            elizaLogger.error(
                `Error replying to comment #${comment.id} in pull request #${content.pullRequest} in repository ${content.owner}/${content.repo}:`,
                error
            );
            if (callback) {
                callback(
                    {
                        text: `Error replying to comment #${comment.id} in pull request #${content.pullRequest}. Please try again.`,
                    },
                    []
                );
                }
            }
        }

    },
    examples: [
        [
            {
                user: "{{user}}",
                content: {
                    text: "Reply to all comments in pull request #1 in repository user1/repo1",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Replied to all comments in pull request #1 successfully!",
                    action: "REPLY_TO_ALL_PR_COMMENTS",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Reply to all comments in pull request #2 in repository user2/repo2",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Replied to all comments in pull request #2 successfully!",
                    action: "REPLY_TO_ALL_PR_COMMENTS",
                },
            },
        ],
    ],
};

export const githubInteractWithPRPlugin: Plugin = {
    name: "githubInteractWithPR",
    description:
        "Integration with GitHub for adding comments or reactions or merging, or closing pull requests",
    actions: [
        addCommentToPRAction,
        reactToPRAction,
        closePRAction,
        mergePRAction,
        replyToPRCommentAction,
    ],
    evaluators: [],
    providers: [],
};
