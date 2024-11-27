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

export const isInitializeContent = (object: any): object is InitializeContent => {
    if (InitializeSchema.safeParse(object).success) {
        return true;
    }
    console.error("Invalid content: ", object);
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

export const isCreateMemoriesFromFilesContent = (object: any): object is CreateMemoriesFromFilesContent => {
    if (CreateMemoriesFromFilesSchema.safeParse(object).success) {
        return true;
    }
    console.error("Invalid content: ", object);
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

export const isCreatePullRequestContent = (object: any): object is CreatePullRequestContent => {
    if (CreatePullRequestSchema.safeParse(object).success) {
        return true;
    }
    console.error("Invalid content: ", object);
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

export const isCreateCommitContent = (object: any): object is CreateCommitContent => {
    if (CreateCommitSchema.safeParse(object).success) {
        return true;
    }
    console.error("Invalid content: ", object);
    return false;
};