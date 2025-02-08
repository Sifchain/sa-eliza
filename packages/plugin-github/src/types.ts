import { elizaLogger } from "@elizaos/core";
import { z } from "zod";
import { githubReactions } from "./constants";

export const InitializeSchema = z.object({
    owner: z.string().min(1, "GitHub owner is required"),
    repo: z.string().min(1, "GitHub repo is required"),
    branch: z.string().min(1, "GitHub branch is required"),
});

export interface InitializeContent {
    owner: string;
    repo: string;
    branch: string;
}

export const isInitializeContent = (
    object: any
): object is InitializeContent => {
    if (InitializeSchema.safeParse(object).success) {
        return true;
    }
    elizaLogger.error("Invalid content: ", object);
    return false;
};

export const CreateMemoriesFromFilesSchema = z.object({
    owner: z.string().min(1, "GitHub owner is required"),
    repo: z.string().min(1, "GitHub repo is required"),
    branch: z.string().min(1, "GitHub branch is required"),
    path: z.string().min(1, "GitHub path is required"),
});

export interface CreateMemoriesFromFilesContent {
    owner: string;
    repo: string;
    branch: string;
    path: string;
}

export const isCreateMemoriesFromFilesContent = (
    object: any
): object is CreateMemoriesFromFilesContent => {
    if (CreateMemoriesFromFilesSchema.safeParse(object).success) {
        return true;
    }
    elizaLogger.error("Invalid content: ", object);
    return false;
};


export const CreatePullRequestSchema = z.object({
    owner: z.string().min(1, "GitHub owner is required"),
    repo: z.string().min(1, "GitHub repo is required"),
    base: z.string().optional().default("main"),
    branch: z.string().min(1, "GitHub pull request branch is required"),
    title: z.string().min(1, "Pull request title is required"),
    description: z.string().optional(),
    files: z.array(z.object({ path: z.string(), content: z.string() })),
});

export interface CreatePullRequestContent {
    owner: string;
    repo: string;
    base?: string;
    branch: string;
    title: string;
    description?: string;
    files: Array<{ path: string; content: string }>;
}

export const isCreatePullRequestContent = (
    object: any
): object is CreatePullRequestContent => {
    if (CreatePullRequestSchema.safeParse(object).success) {
        return true;
    }
    elizaLogger.error("Invalid content: ", object);
    return false;
};

export const CreateCommitSchema = z.object({
    owner: z.string().min(1, "GitHub owner is required"),
    repo: z.string().min(1, "GitHub repo is required"),
    branch: z.string().min(1, "GitHub branch is required"),
    message: z.string().min(1, "Commit message is required"),
    files: z.array(z.object({ path: z.string(), content: z.string() })),
});

export interface CreateCommitContent {
    owner: string;
    repo: string;
    branch: string;
    message: string;
    files: Array<{ path: string; content: string }>;
}

export const isCreateCommitContent = (
    object: any
): object is CreateCommitContent => {
    if (CreateCommitSchema.safeParse(object).success) {
        return true;
    }
    elizaLogger.error("Invalid content: ", object);
    return false;
};

export const FetchFilesSchema = z.object({
    owner: z.string().min(1, "GitHub owner is required"),
    repo: z.string().min(1, "GitHub repo is required"),
    branch: z.string().min(1, "GitHub branch is required"),
});

export interface FetchFilesContent {
    owner: string;
    repo: string;
    branch: string;
}

export const isFetchFilesContent = (
    object: any
): object is FetchFilesContent => {
    if (FetchFilesSchema.safeParse(object).success) {
        return true;
    }
    elizaLogger.error("Invalid content: ", object);
    return false;
};

export const SimilarityIssueCheckSchema = z.object({
    issue: z.number().optional(),
    created: z.boolean().optional(),
});

export interface SimilarityIssueCheckContent {
    issue: number;
    created: boolean;
}

export const isSimilarityIssueCheckContent = (
    object: any
): object is SimilarityIssueCheckContent => {
    return SimilarityIssueCheckSchema.safeParse(object).success;
};

export const CreateIssueSchema = z.object({
    owner: z.string().min(1, "GitHub owner is required"),
    repo: z.string().min(1, "GitHub repo is required"),
    branch: z.string().min(1, "GitHub branch is required"),
    title: z.string().min(1, "Issue title is required"),
    body: z.string().min(1, "Issue body is required"),
    labels: z.array(z.string()).optional(),
});

export interface CreateIssueContent {
    owner: string;
    repo: string;
    branch: string;
    title: string;
    body: string;
    labels?: string[];
}

export const isCreateIssueContent = (
    object: any
): object is CreateIssueContent => {
    if (CreateIssueSchema.safeParse(object).success) {
        return true;
    }
    elizaLogger.error("Invalid content: ", object);
    return false;
};

export const ModifyIssueSchema = z.object({
    owner: z.string().min(1, "GitHub owner is required"),
    repo: z.string().min(1, "GitHub repo is required"),
    branch: z.string().min(1, "GitHub branch is required"),
    issue: z.number().min(1, "Issue number is required"),
    title: z.string().optional(),
    body: z.string().optional(),
    state: z.string().optional(),
    labels: z.array(z.string()).optional(),
});

export interface ModifyIssueContent {
    owner: string;
    repo: string;
    branch: string;
    issue: number;
    title?: string;
    body?: string;
    state?: string;
    labels?: string[];
}

export const isModifyIssueContent = (
    object: any
): object is ModifyIssueContent => {
    if (ModifyIssueSchema.safeParse(object).success) {
        return true;
    }
    elizaLogger.error("Invalid content: ", object);
    return false;
};

export const AddCommentToIssueSchema = z.object({
    owner: z.string().min(1, "GitHub owner is required"),
    repo: z.string().min(1, "GitHub repo is required"),
    branch: z.string().min(1, "GitHub branch is required"),
    issue: z.number().min(1, "Issue number is required"),
    reaction: z.enum(["+1", "-1", "laugh", "confused", "heart", "hooray", "rocket", "eyes"]).optional(),
});

export interface AddCommentToIssueContent {
    owner: string;
    repo: string;
    branch: string;
    issue: number;
    reaction?: "+1" | "-1" | "laugh" | "confused" | "heart" | "hooray" | "rocket" | "eyes";
}

export const isAddCommentToIssueContent = (
    object: any
): object is AddCommentToIssueContent => {
    if (AddCommentToIssueSchema.safeParse(object).success) {
        return true;
    }
    elizaLogger.error("Invalid content: ", object);
    return false;
};

export const IdeationSchema = z.object({
    response: z.string().min(1, "Response is required"),
});

export interface IdeationContent {
    response: string;
}

export const isIdeationContent = (object: any): object is IdeationContent => {
    return IdeationSchema.safeParse(object).success;
};

export const AddCommentToPRSchema = z.object({
    owner: z.string().min(1, "GitHub owner is required"),
    repo: z.string().min(1, "GitHub repo is required"),
    branch: z.string().min(1, "GitHub branch is required"),
    pullRequest: z.number().min(1, "Pull request number is required"),
    emojiReaction: z.enum(githubReactions as [string, ...string[]]).optional(),
});

export interface AddCommentToPRContent {
    owner: string;
    repo: string;
    branch: string;
    pullRequest: number;
    emojiReaction?: GithubReaction;
}

export const isAddCommentToPRContent = (
    object: any
): object is AddCommentToPRContent => {
    if (AddCommentToPRSchema.safeParse(object).success) {
        return true;
    }
    elizaLogger.error("Invalid content: ", object);
    return false;
};

export const GenerateCommentForASpecificPRSchema = z.object({
    comment: z.string().min(1, "Comment is required"),
    action: z.enum(["COMMENT", "APPROVE", "REQUEST_CHANGES"]).optional(),
    lineLevelComments: z.array(z.object({
        path: z.string().optional(),
        body: z.string().optional(),
        position: z.number().optional(),
        line: z.number().optional(),
    })).optional(),
    approvalEvent: z.enum(["COMMENT", "APPROVE", "REQUEST_CHANGES"]).optional(),
    emojiReaction: z.enum(githubReactions as [string, ...string[]]).optional(),
});

export interface GenerateCommentForASpecificPRSchema {
    comment: string;
    action?: "COMMENT" | "APPROVE" | "REQUEST_CHANGES";
    lineLevelComments?: Array<{
        path: string;
        body: string;
        position?: number;
        line?: number;
    }>;
    approvalEvent?: "COMMENT" | "APPROVE" | "REQUEST_CHANGES";
    emojiReaction?: GithubReaction;
}

export const isGenerateCommentForASpecificPRSchema = (
    object: any
): object is GenerateCommentForASpecificPRSchema => {
    return GenerateCommentForASpecificPRSchema.safeParse(object).success;
};

export const ReactToIssueSchema = z.object({
    owner: z.string().min(1, "GitHub owner is required"),
    repo: z.string().min(1, "GitHub repo is required"),
    branch: z.string().min(1, "GitHub branch is required"),
    issue: z.number().min(1, "Issue number is required"),
    reaction: z.enum(githubReactions as [string, ...string[]]),
});

export interface ReactToIssueContent {
    owner: string;
    repo: string;
    branch: string;
    issue: number;
    reaction: GithubReaction;
}

export const isReactToIssueContent = (
    object: any
): object is ReactToIssueContent => {
    if (ReactToIssueSchema.safeParse(object).success) {
        return true;
    }
    elizaLogger.error("Invalid content: ", object);
    return false;
};

export const ReactToPRSchema = z.object({
    owner: z.string().min(1, "GitHub owner is required"),
    repo: z.string().min(1, "GitHub repo is required"),
    branch: z.string().min(1, "GitHub branch is required"),
    pullRequest: z.number().min(1, "Pull request number is required"),
    reaction: z.enum(githubReactions as [string, ...string[]]),
});

export interface ReactToPRContent {
    owner: string;
    repo: string;
    branch: string;
    pullRequest: number;
    reaction: GithubReaction;
}

export const isReactToPRContent = (
    object: any
): object is ReactToPRContent => {
    if (ReactToPRSchema.safeParse(object).success) {
        return true;
    }
    elizaLogger.error("Invalid content: ", object);
    return false;
};

export type GithubReaction = "+1" | "-1" | "laugh" | "confused" | "heart" | "hooray" | "rocket" | "eyes";

export const ClosePRActionSchema = z.object({
    owner: z.string().min(1, "GitHub owner is required"),
    repo: z.string().min(1, "GitHub repo is required"),
    branch: z.string().min(1, "GitHub branch is required"),
    pullRequest: z.number().min(1, "Pull request number is required"),
});

export interface ClosePRActionContent {
    owner: string;
    repo: string;
    branch: string;
    pullRequest: number;
}

export const isClosePRActionContent = (
    object: any
): object is ClosePRActionContent => {
    if (ClosePRActionSchema.safeParse(object).success) {
        return true;
    }
    elizaLogger.error("Invalid content: ", object);
    return false;
};

export const CloseIssueActionSchema = z.object({
    owner: z.string().min(1, "GitHub owner is required"),
    repo: z.string().min(1, "GitHub repo is required"),
    branch: z.string().min(1, "GitHub branch is required"),
    issue: z.number().min(1, "Issue number is required"),
});

export interface CloseIssueActionContent {
    owner: string;
    repo: string;
    branch: string;
    issue: number;
}

export const isCloseIssueActionContent = (
    object: any
): object is CloseIssueActionContent => {
    if (CloseIssueActionSchema.safeParse(object).success) {
        return true;
    }
    elizaLogger.error("Invalid content: ", object);
    return false;
};

export const MergePRActionSchema = z.object({
    owner: z.string().min(1, "GitHub owner is required"),
    repo: z.string().min(1, "GitHub repo is required"),
    branch: z.string().min(1, "GitHub branch is required"),
    pullRequest: z.number().min(1, "Pull request number is required"),
    mergeMethod: z.enum(["merge", "squash", "rebase"]).optional().default("merge"),
});

export interface MergePRActionContent {
    owner: string;
    repo: string;
    branch: string;
    pullRequest: number;
    mergeMethod?: "merge" | "squash" | "rebase";
}

export const isMergePRActionContent = (
    object: any
): object is MergePRActionContent => {
    if (MergePRActionSchema.safeParse(object).success) {
        return true;
    }
    elizaLogger.error("Invalid content: ", object);
    return false;
};

export const ReplyToPRCommentSchema = z.object({
    owner: z.string().min(1, "GitHub owner is required"),
    repo: z.string().min(1, "GitHub repo is required"),
    pullRequest: z.number().min(1, "Pull request number is required"),
    body: z.string().min(1, "Reply body is required"),
});

export interface ReplyToPRCommentContent {
    owner: string;
    repo: string;
    pullRequest: number;
    body: string;
}

export const isReplyToPRCommentContent = (
    object: any
): object is ReplyToPRCommentContent => {
    if (ReplyToPRCommentSchema.safeParse(object).success) {
        return true;
    }
    elizaLogger.error("Invalid content: ", object);
    return false;
};

export const GeneratePRCommentReplySchema = z.object({
    comment: z.string(),
    emojiReaction: z.enum(githubReactions as [string, ...string[]]).optional().default('+1'),
});

export interface GeneratePRCommentReplyContent {
    comment: string;
    emojiReaction: GithubReaction;
}

export const isGeneratePRCommentReplyContent = (
    object: any
): object is GeneratePRCommentReplyContent => {
    return GeneratePRCommentReplySchema.safeParse(object).success;
};
export const ImplementFeatureSchema = z.object({
    owner: z.string().min(1, "GitHub owner is required"),
    repo: z.string().min(1, "GitHub repo is required"),
    branch: z.string().min(1, "GitHub branch is required"),
    feature: z.string().nullable().optional(),
    issue: z.number().nullable().optional(),
    base: z.string().default("main"),
});

export interface ImplementFeatureContent {
    owner: string;
    repo: string;
    branch: string;
    feature?: string;
    issue?: number;
    base?: string;
}

export const isImplementFeatureContent = (
    object: any
): object is ImplementFeatureContent => {
    if (ImplementFeatureSchema.safeParse(object).success) {
        return true;
    }
    elizaLogger.error("Invalid content: ", object);
    return false;
};

export const GenerateCodeFileChangesSchema = z.object({
    owner: z.string().min(1, "GitHub owner is required"),
    repo: z.string().min(1, "GitHub repo is required"),
    branch: z.string().min(1, "GitHub branch is required"),
    feature: z.string().min(1, "Feature is required"),
    base: z.string().default("develop"),
    files: z.array(
        z.object({
            path: z.string().min(1, "File path is required"),
            content: z.string().min(1, "File content is required"),
        })
    ).nonempty("At least one file change is required"),
});

export interface GenerateCodeFileChangesContent {
    owner: string;
    repo: string;
    branch: string;
    feature: string;
    base?: string;
    files: Array<{
        path: string;
        content: string;
    }>;
}

export const isGenerateCodeFileChangesContent = (
    object: any
): object is GenerateCodeFileChangesContent => {
    if (GenerateCodeFileChangesSchema.safeParse(object).success) {
        return true;
    }
    elizaLogger.error("Invalid content: ", object);
    return false;
};

// Schema for a single orchestrated action
export const OrchestratedGithubActionSchema = z.object({
    githubAction: z.string(),
    user: z.string(),
    system: z.string(),
});

// Type for a single orchestrated action
export interface OrchestratedGithubAction {
    githubAction: string;
    user: string;
    system: string;
}

// Schema for the orchestration response
export const OrchestrationSchema = z.object({
    githubActions: z.array(OrchestratedGithubActionSchema),
});

export interface OrchestrationSchema {
    githubActions: OrchestratedGithubAction[];
}

export const isOrchestrationSchema = (object: any): object is OrchestrationSchema => {
    return OrchestrationSchema.safeParse(object).success;
};