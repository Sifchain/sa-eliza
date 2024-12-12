import { elizaLogger } from "@ai16z/eliza";
import { z } from "zod";

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
    path: z.string().min(1, "GitHub path is required"),
});

export interface CreateMemoriesFromFilesContent {
    owner: string;
    repo: string;
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
    base: z.string().optional(),
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
    message: z.string().min(1, "Commit message is required"),
    files: z.array(z.object({ path: z.string(), content: z.string() })),
});

export interface CreateCommitContent {
    owner: string;
    repo: string;
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

export const CreateIssueSchema = z.object({
    owner: z.string().min(1, "GitHub owner is required"),
    repo: z.string().min(1, "GitHub repo is required"),
    title: z.string().min(1, "Issue title is required"),
    body: z.string().min(1, "Issue body is required"),
    labels: z.array(z.string()).optional(),
});

export interface CreateIssueContent {
    owner: string;
    repo: string;
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
    issue: z.number().min(1, "Issue number is required"),
    title: z.string().optional(),
    body: z.string().optional(),
    state: z.string().optional(),
    labels: z.array(z.string()).optional(),
});

export interface ModifyIssueContent {
    owner: string;
    repo: string;
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
    issue: z.number().min(1, "Issue number is required"),
    comment: z.string().min(1, "Comment is required"),
});

export interface AddCommentToIssueContent {
    owner: string;
    repo: string;
    issue: number;
    comment: string;
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
