import {
    elizaLogger,
    Client,
    IAgentRuntime,
    Character,
    ModelClass,
    composeContext,
    Memory,
    Content,
    HandlerCallback,
    UUID,
    generateObject,
    stringToUuid,
} from "@elizaos/core";
import { validateGithubConfig } from "./environment";
import { EventEmitter } from "events";
import {
    incorporateRepositoryState,
    getRepositoryRoomId,
    saveIssuesToMemory,
    GitHubService,
    savePullRequestsToMemory,
} from "@elizaos/plugin-github";
import { isOODAContent, OODAContent, OODASchema } from "./types";
import { oodaTemplate } from "./templates";
import fs from "fs/promises";
import { HumanloopClient } from "humanloop"

const humanloop = new HumanloopClient({
  apiKey: process.env.HUMANLOOP_API_KEY,
})


export class GitHubClient extends EventEmitter {
    apiToken: string;
    runtime: IAgentRuntime;
    character: Character;

    constructor(runtime: IAgentRuntime) {
        super();

        this.apiToken = runtime.getSetting("GITHUB_API_TOKEN") as string;

        this.runtime = runtime;
        this.character = runtime.character;

        // Start the OODA loop after initialization
        this.startOodaLoop();
    }

    async stop() {
        try {
            elizaLogger.log("GitHubClient stopped successfully.");
        } catch (e) {
            elizaLogger.error("GitHubClient stop error:", e);
        }
    }

    private startOodaLoop() {
        this.processOodaCycle();
        const interval =
            Number(this.runtime.getSetting("GITHUB_OODA_INTERVAL_MS")) ||
            300000; // Default to 1 minute
        elizaLogger.log("Starting OODA loop with interval:", interval);
        setInterval(() => {
            this.processOodaCycle();
        }, interval);
    }

    private async processOodaCycle() {
        elizaLogger.log("Starting OODA cycle...");
        const res = await humanloop.prompts.call({
            id: "pr_u6XAbbQM1hsB4elRkpoAc",
            inputs: {},
            messages: [{ role: "user", content: "Tell a joke" }],
            providerApiKeys: {
              "openai": process.env.OPENAI_API_KEY
            },
            environment: "production"
          })


          await fs.writeFile('f',res.logs[0].output);
        //
        // 1) retrieve github information
        //
        const { owner, repository, branch } = getRepositorySettings(
            this.runtime
        );
        // const client = new GitHubService({
        //     owner,
        //     repo: repository,
        //     branch,
        //     auth: this.apiToken,
        // });
        // const issue = await client.getIssue(1);
        // await fs.writeFile("/tmp/client-github-issue.txt", JSON.stringify(issue, null, 2));
        // const res = await client.addLabelsToLabelable(issue.node_id, ["agent-commented"]);
        // await fs.writeFile("/tmp/client-github-response.txt", JSON.stringify(res, null, 2));

        //
        // 2) prepare the room id
        //
        // TODO: We generate this, we want the default one that gets generated
        const roomId = getRepositoryRoomId(this.runtime);
        elizaLogger.log("Repository room ID:", roomId);

        // Observe: Gather relevant memories related to the repository
        await this.runtime.ensureRoomExists(roomId);
        elizaLogger.log("Room exists for roomId:", roomId);
        await this.runtime.ensureParticipantInRoom(
            this.runtime.agentId,
            roomId
        );
        elizaLogger.log("Agent is a participant in roomId:", roomId);

        //
        // 3) retrieve memories
        //
        const memories = await this.runtime.messageManager.getMemories({
            roomId,
        });
        await fs.writeFile(
            "/tmp/client-github-memories.txt",
            JSON.stringify(memories, null, 2)
        );
        const fileMemories = memories.filter(
            (memory) => (memory.content.metadata as any)?.path
        );
        await fs.writeFile(
            "/tmp/client-github-fileMemories.txt",
            JSON.stringify(fileMemories, null, 2)
        );
        if (fileMemories.length === 0) {
            await this.initializeRepositoryAndCreateMemories(
                owner,
                repository,
                branch,
                roomId
            );
        }

        //
        // 4) compose the state with original memory and incorporate repository state
        //
        elizaLogger.log("Before composeState");
        const originalMemory = {
            userId: this.runtime.agentId, // TODO: this should be the user id
            roomId: roomId,
            agentId: this.runtime.agentId,
            content: {
                text: "Initializing repository and creating memories",
                action: "NOTHING",
                source: "github",
            },
        } as Memory;
        let originalState = await this.runtime.composeState(originalMemory, {});
        originalState = await incorporateRepositoryState(
            originalState,
            this.runtime,
            originalMemory,
            [],
            true,
            true
        );
        // elizaLogger.log("Original state:", originalState);
        // await fs.writeFile(
        //     "/tmp/client-github-originalState.txt",
        //     JSON.stringify(originalState, null, 2)
        // );

        //
        // 5) compose the context
        //
        const context = composeContext({
            state: originalState,
            template: oodaTemplate,
        });
        // elizaLogger.log("Composed context for OODA cycle:", context);
        // write the context to a file for testing
        await fs.writeFile("/tmp/client-github-context.txt", context);

        //
        // 6) retrieve the content
        //
        const response = await generateObject({
            runtime: this.runtime,
            context,
            modelClass: ModelClass.SMALL,
            schema: OODASchema,
        });
        if (!isOODAContent(response.object)) {
            elizaLogger.error("Invalid content in response:", response.object);
            throw new Error("Invalid content");
        }

        const content = response.object as OODAContent;
        elizaLogger.log("OODA content:", content);
        if (content.action === "NOTHING") {
            elizaLogger.log("Skipping OODA cycle as action is NOTHING");
            return;
        }

        //
        // 7) create new memory with retry logic
        //

        // Generate IDs with timestamp to ensure uniqueness
        const timestamp = Date.now();
        const userIdUUID = stringToUuid(`${this.runtime.agentId}-${timestamp}`);
        const memoryUUID = stringToUuid(
            `${roomId}-${this.runtime.agentId}-${timestamp}`
        );
        elizaLogger.log("Generated memory UUID:", memoryUUID);

        const newMemory: Memory = {
            id: memoryUUID,
            userId: userIdUUID,
            agentId: this.runtime.agentId,
            content: {
                text: content.action,
                action: content.action,
                source: "github",
                inReplyTo: stringToUuid(`${roomId}-${this.runtime.agentId}`),
            },
            roomId,
            createdAt: timestamp,
        };
        // elizaLogger.log("New memory to be created:", newMemory);

        try {
            await this.runtime.messageManager.createMemory(newMemory);
            elizaLogger.debug("Memory created successfully:", {
                memoryId: memoryUUID,
                action: content.action,
                userId: this.runtime.agentId,
            });
        } catch (error) {
            if (error.code === "23505") {
                // Duplicate key error
                elizaLogger.warn("Duplicate memory, skipping:", {
                    memoryId: memoryUUID,
                });
                return;
            }
            elizaLogger.error("Error creating memory:", error);
            throw error; // Re-throw other errors
        }

        const callback: HandlerCallback = async (
            content: Content,
            files: any[]
        ) => {
            elizaLogger.log("Callback called with content:", content);
            return [];
        };

        //
        // 8) update the state with the new memory
        //
        const state = await this.runtime.composeState(newMemory);

        // write state to file
        await fs.writeFile(
            "/tmp/client-github-state.txt",
            JSON.stringify(state, null, 2)
        );

        const newState = await this.runtime.updateRecentMessageState(state);

        // write new state to file
        await fs.writeFile(
            "/tmp/client-github-newState.txt",
            JSON.stringify(newState, null, 2)
        );

        //
        // 9) process the actions with the new memory and state
        //
        elizaLogger.log("Processing actions for action:", content.action);
        await this.runtime.processActions(
            newMemory,
            [newMemory],
            newState,
            callback
        );

        elizaLogger.log("OODA cycle completed.");
    }

    private async initializeRepositoryAndCreateMemories(
        owner: string,
        repository: string,
        branch: string,
        roomId: UUID
    ) {
        //
        // 0) function to initialize repository and create memories if no memories are found
        //
        elizaLogger.log("No memories found, skipping OODA cycle.");

        //
        // 1) initialize timestamp and userIdUUID
        //
        const timestamp = Date.now();
        const userIdUUID = stringToUuid(`${this.runtime.agentId}-${timestamp}`);

        //
        // 2) create the memory to acknowledge that no memories are found and trigger NOTHING action
        //
        const originalMemory: Memory = {
            id: stringToUuid(
                `${roomId}-${this.runtime.agentId}-${timestamp}-original`
            ),
            userId: userIdUUID,
            agentId: this.runtime.agentId,
            content: {
                text: `No memories found, starting to initialize repository and create memories.`,
                action: "NOTHING",
                source: "github",
                inReplyTo: stringToUuid(`${roomId}-${this.runtime.agentId}`),
            },
            roomId,
            createdAt: timestamp,
        };
        let originalState = await this.runtime.composeState(originalMemory);
        originalState = await incorporateRepositoryState(
            originalState,
            this.runtime,
            originalMemory,
            [],
            true,
            true
        );

        //
        // 3) create the memory to trigger initialize repository action
        //
        const initializeRepositoryMemory: Memory = {
            id: stringToUuid(
                `${roomId}-${this.runtime.agentId}-${timestamp}-initialize-repository`
            ),
            userId: userIdUUID,
            agentId: this.runtime.agentId,
            content: {
                text: `Initialize the repository ${owner}/${repository} on ${branch} branch`,
                action: "INITIALIZE_REPOSITORY",
                source: "github",
                inReplyTo: stringToUuid(`${roomId}-${this.runtime.agentId}`),
            },
            roomId,
            createdAt: timestamp,
        };
        await this.runtime.messageManager.createMemory(
            initializeRepositoryMemory
        );
        elizaLogger.debug("Memory created successfully:", {
            memoryId: initializeRepositoryMemory.id,
            action: initializeRepositoryMemory.content.action,
            userId: this.runtime.agentId,
        });

        //
        // 4) create the memory to trigger create memories from files action
        //
        const createMemoriesFromFilesMemory = {
            id: stringToUuid(
                `${roomId}-${this.runtime.agentId}-${timestamp}-create-memories-from-files`
            ),
            userId: userIdUUID,
            agentId: this.runtime.agentId,
            content: {
                text: `Create memories from files for the repository ${owner}/${repository} @ branch ${branch} and path '/packages/plugin-coinbase/src'`,
                action: "CREATE_MEMORIES_FROM_FILES",
                source: "github",
                inReplyTo: stringToUuid(`${roomId}-${this.runtime.agentId}`),
            },
            roomId,
            createdAt: timestamp,
        };
        await this.runtime.messageManager.createMemory(
            createMemoriesFromFilesMemory
        );
        elizaLogger.debug("Memory created successfully:", {
            memoryId: createMemoriesFromFilesMemory.id,
            action: createMemoriesFromFilesMemory.content.action,
            userId: this.runtime.agentId,
        });

        const issuesLimit =
            Number(this.runtime.getSetting("GITHUB_ISSUES_LIMIT")) || 10;
        const pullRequestsLimit =
            Number(this.runtime.getSetting("GITHUB_PULL_REQUESTS_LIMIT")) || 10;

        // This returns nothing no issue memories or pull request memories
        const issuesMemories = await saveIssuesToMemory(
            this.runtime,
            owner,
            repository,
            branch,
            this.apiToken,
            issuesLimit
        );
        // elizaLogger.log("Issues memories:", issuesMemories);
        await fs.writeFile(
            "/tmp/client-github-issuesMemories.txt",
            JSON.stringify(issuesMemories, null, 2)
        );
        const pullRequestsMemories = await savePullRequestsToMemory(
            this.runtime,
            owner,
            repository,
            branch,
            this.apiToken,
            pullRequestsLimit
        );
        // elizaLogger.log("Pull requests memories:", pullRequestsMemories);
        await fs.writeFile(
            "/tmp/client-github-pullRequestsMemories.txt",
            JSON.stringify(pullRequestsMemories, null, 2)
        );

        await this.runtime.processActions(
            originalMemory,
            [initializeRepositoryMemory, createMemoriesFromFilesMemory],
            originalState,
            undefined
        );
    }
}

const getRepositorySettings = (runtime: IAgentRuntime) => {
    const owner = runtime.getSetting("GITHUB_OWNER") ?? ("" as string);
    const repository = runtime.getSetting("GITHUB_REPO") ?? ("" as string);
    const branch = runtime.getSetting("GITHUB_BRANCH") ?? ("main" as string);
    if (owner === "" || repository === "") {
        elizaLogger.error(
            "GITHUB_OWNER or GITHUB_REPO is not set, skipping OODA cycle."
        );
        throw new Error("GITHUB_OWNER or GITHUB_REPO is not set");
    }
    return { owner, repository, branch };
};

export const GitHubClientInterface: Client = {
    start: async (runtime: IAgentRuntime) => {
        await validateGithubConfig(runtime);
        elizaLogger.log(
            "Starting GitHub client with agent ID:",
            runtime.agentId
        );

        const client = new GitHubClient(runtime);
        return client;
    },
    stop: async (runtime: IAgentRuntime) => {
        try {
            elizaLogger.log("Stopping GitHub client");
            await runtime.clients.github.stop();
        } catch (e) {
            elizaLogger.error("GitHub client stop error:", e);
        }
    },
};

export default GitHubClientInterface;
