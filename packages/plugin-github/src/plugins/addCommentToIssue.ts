import {
    composeContext,
    elizaLogger,
    generateObjectV2,
    Action,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    Plugin,
    State,
} from "@ai16z/eliza";
import { GitHubService } from "../services/github";
import {
    AddCommentToIssueContent,
    AddCommentToIssueSchema,
    isAddCommentToIssueContent,
} from "../types";
import { addCommentToIssueTemplate } from "../templates";

export const addCommentToIssueAction: Action = {
    name: "ADD_COMMENT_TO_ISSUE",
    similes: [
        "ADD_COMMENT_TO_ISSUE",
        "COMMENT_ON_ISSUE",
        "POST_COMMENT",
        "ADD_COMMENT",
    ],
    description: "Adds a comment to an existing issue in the GitHub repository",
    validate: async (runtime: IAgentRuntime) => {
        const token = !!runtime.getSetting("GITHUB_API_TOKEN");
        return token;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback: HandlerCallback
    ) => {
        elizaLogger.log("Composing state for message:", message);
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        const context = composeContext({
            state,
            template: addCommentToIssueTemplate,
        });

        const details = await generateObjectV2({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
            schema: AddCommentToIssueSchema,
        });

        if (!isAddCommentToIssueContent(details.object)) {
            elizaLogger.error("Invalid content:", details.object);
            throw new Error("Invalid content");
        }

        const content = details.object as AddCommentToIssueContent;

        elizaLogger.info("Adding comment to issue in the repository...");

        const githubService = new GitHubService({
            owner: content.owner,
            repo: content.repo,
            auth: runtime.getSetting("GITHUB_API_TOKEN"),
        });

        try {
            const comment = await githubService.addIssueComment(
                content.issue,
                content.comment
            );

            elizaLogger.info(
                `Added comment to issue #${content.issue} successfully!`
            );

            callback({
                text: `Added comment to issue #${content.issue} successfully!`,
                attachments: [],
            });
        } catch (error) {
            elizaLogger.error(
                `Error adding comment to issue #${content.issue} in repository ${content.owner}/${content.repo}:`,
                error
            );
            callback(
                {
                    text: `Error adding comment to issue #${content.issue}. Please try again.`,
                },
                []
            );
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Add a comment to issue #1 in repository user1/repo1: 'This is fixed in the latest release'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Added comment to issue #1 successfully!",
                    action: "ADD_COMMENT",
                },
            },
        ],
    ],
};

export const githubAddCommentToIssuePlugin: Plugin = {
    name: "githubAddCommentToIssue",
    description: "Integration with GitHub for adding comments to issues",
    actions: [addCommentToIssueAction],
    evaluators: [],
    providers: [],
};
