import { glob } from "glob";
import path from "path";
import fs from "fs/promises";
import { createHash } from "crypto";
import { composeContext, elizaLogger, generateObjectV2, knowledge, stringToUuid, Action, HandlerCallback, IAgentRuntime, Memory, ModelClass, Plugin, State } from "@ai16z/eliza";
import { createMemoriesFromFilesTemplate } from "../templates";
import { CreateMemoriesFromFilesContent, CreateMemoriesFromFilesSchema, isCreateMemoriesFromFilesContent } from "../types";

export async function retrieveFiles(repoPath: string, gitPath: string) {
    const searchPath = gitPath
        ? path.join(repoPath, gitPath, "**/*")
        : path.join(repoPath, "**/*");

    const files = await glob(searchPath, { nodir: true });

    return files
}

export async function addFilesToMemory(runtime: IAgentRuntime, files: string[], repoPath: string, owner: string, repo: string) {
    for (const file of files) {
        const relativePath = path.relative(repoPath, file);
        const content = await fs.readFile(file, "utf-8");
        const contentHash = createHash("sha256")
            .update(content)
            .digest("hex");
        const knowledgeId = stringToUuid(
            `github-${owner}-${repo}-${relativePath}`
        );

        const existingDocument =
            await runtime.documentsManager.getMemoryById(knowledgeId);

        if (
            existingDocument &&
            existingDocument.content["hash"] == contentHash
        ) {
            continue;
        }

        elizaLogger.log(
            "Processing knowledge for ",
            runtime.character.name,
            " - ",
            relativePath
        );

        await knowledge.set(runtime, {
            id: knowledgeId,
            content: {
                text: content,
                hash: contentHash,
                source: "github",
                attachments: [],
                metadata: {
                    path: relativePath,
                    repo,
                    owner,
                },
            },
        });
    }
}

export const createMemoriesFromFilesAction: Action = {
    name: "CREATE_MEMORIES_FROM_FILES",
    similes: ["CREATE_MEMORIES", "CREATE_MEMORIES_FROM_FILE"],
    description: "Create memories from files in the repository",
    validate: async (runtime: IAgentRuntime) => {
        // Check if all required environment variables are set
        const token = !!runtime.getSetting("GITHUB_API_TOKEN");

        return token;
    },
    handler: async (runtime: IAgentRuntime, message: Memory, state: State, options: any, callback: HandlerCallback) => {
        elizaLogger.log("Composing state for message:", message);
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        const context = composeContext({
            state,
            template: createMemoriesFromFilesTemplate,
        });

        const details = await generateObjectV2({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
            schema: CreateMemoriesFromFilesSchema,
        });

        if (!isCreateMemoriesFromFilesContent(details.object)) {
            throw new Error("Invalid content");
        }

        const content = details.object as CreateMemoriesFromFilesContent;

        elizaLogger.info("Creating memories from files...");

        const repoPath = path.join(
            process.cwd(),
            ".repos",
            content.owner,
            content.repo,
        );

        try {
            const files = await retrieveFiles(repoPath, content.path);

            await addFilesToMemory(
                runtime,
                files,
                repoPath,
                content.owner,
                content.repo,
            );

            elizaLogger.info("Memories created successfully!");

            callback(
                {
                    text: "Memories created successfully!",
                    attachments: [],
                }
            );
        } catch (error) {
            elizaLogger.error(`Error creating memories from files on ${content.owner}/${content.repo} path ${content.path}:`, error);
            callback(
                {
                    text: `Error creating memories from files on ${content.owner}/${content.repo} path ${content.path}. Please try again.`,
                },
                [],
            );
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Create memories from files on repository octocat/hello-world at path docs/",
                }
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Memories created successfully!",
                    action: "CREATE_MEMORIES_FROM_FILES",
                },
            },
        ],
    ],
};

export const githubCreateMemorizeFromFilesPlugin: Plugin = {
    name: "githubCreateMemorizeFromFiles",
    description: "Integration with GitHub for creating memories from files",
    actions: [createMemoriesFromFilesAction],
    evaluators: [],
    providers: [],
};
