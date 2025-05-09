import { elizaLogger } from "@elizaos/core";
import { githubReactions } from "@elizaos/plugin-github";
import { z } from "zod";

export const ConfigGithubInfoSchema = z.object({
    owner: z.string().min(1, "GitHub owner is required"),
    repo: z.string().min(1, "GitHub repo is required"),
    branch: z.string().min(1, "GitHub branch is required"),
});

export interface ConfigGithubInfoContent {
    owner: string;
    repo: string;
    branch: string;
}

export const isConfigGithubInfoContent = (
    object: any,
): object is ConfigGithubInfoContent => {
    if (ConfigGithubInfoSchema.safeParse(object).success) {
        return true;
    }
    elizaLogger.error("Invalid content: ", object);
    return false;
};

export const StopSchema = z.object({
    action: z.literal("STOP"),
});

export interface StopContent {}

export const isStopContent = (object: any): object is StopContent => {
    if (StopSchema.safeParse(object).success) {
        return true;
    }
    elizaLogger.error("Invalid content:", object);
    return false;
};

export const OODASchema = z.object({
    action: z.enum([
        "CREATE_ISSUE",
        "CREATE_PULL_REQUEST",
        "COMMENT_ON_PULL_REQUEST",
        "COMMENT_ON_ISSUE",
        "REACT_TO_ISSUE",
        "REACT_TO_PR",
        "REPLY_TO_PR_COMMENT",
        "IMPLEMENT_FEATURE",
        "CLOSE_ISSUE",
        "CLOSE_PULL_REQUEST",
        "MERGE_PULL_REQUEST",
        "NOTHING",
        "STOP",
    ]),
    owner: z.string().nullable().optional(),
    repo: z.string().nullable().optional(),
    path: z.string().nullable().optional(),
    branch: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    files: z
        .array(z.object({ path: z.string(), content: z.string() }))
        .nullable()
        .optional(),
    message: z.string().nullable().optional(),
    labels: z.array(z.string()).nullable().optional(),
    issue: z.number().nullable().optional(),
    reasoning: z.string().nullable().optional(),
    reaction: z
        .enum(githubReactions as [string, ...string[]])
        .nullable()
        .optional(),
});

export interface OODAContent {
    action: string;
    owner?: string;
    repo?: string;
    path?: string;
    branch?: string;
    title?: string;
    description?: string;
    files: { path: string; content: string }[];
    message?: string;
    labels?: string[];
    issue?: number;
    reasoning: string;
    reaction?: string;
}

export const isOODAContent = (object: any): object is OODAContent => {
    return OODASchema.safeParse(object).success;
};
