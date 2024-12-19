import { elizaLogger, Client, IAgentRuntime, Character, generateShouldRespond, ModelClass, composeContext, State, Memory, generateMessageResponse, getEmbeddingZeroVector, Content, HandlerCallback, UUID, generateObjectV2, stringToUuid } from "@ai16z/eliza";
import { validateGithubConfig } from "./environment";
import { EventEmitter } from "events";
import {
    initializeRepositoryAction,
    createCommitAction,
    createMemoriesFromFilesAction,
    createPullRequestAction,
    createIssueAction,
    modifyIssueAction,
    addCommentToIssueAction,
    sourceCodeProvider,
    testFilesProvider,
    workflowFilesProvider,
    documentationFilesProvider,
    releasesProvider,
} from "@ai16z/plugin-github";
import { z } from "zod";
import { isOODAContent, OODAContent, OODASchema } from "./types";
import { oodaTemplate } from "./templates";

export class GitHubClient extends EventEmitter {
    apiToken: string;
    runtime: IAgentRuntime;
    character: Character;
    client: GitHubClient;

    constructor(runtime: IAgentRuntime) {
        super();

        this.apiToken = runtime.getSetting("GITHUB_API_TOKEN") as string;

        this.runtime = runtime;
        this.character = runtime.character;
        this.client = new GitHubClient(runtime)

        this.setupEventListeners();
        this.runtime.registerAction(initializeRepositoryAction);
        this.runtime.registerAction(createCommitAction);
        this.runtime.registerAction(createMemoriesFromFilesAction);
        this.runtime.registerAction(createPullRequestAction);
        this.runtime.registerAction(createIssueAction);
        this.runtime.registerAction(modifyIssueAction);
        this.runtime.registerAction(addCommentToIssueAction);

        this.runtime.providers.push(sourceCodeProvider);
        this.runtime.providers.push(testFilesProvider);
        this.runtime.providers.push(workflowFilesProvider);
        this.runtime.providers.push(documentationFilesProvider);
        this.runtime.providers.push(releasesProvider);

        // Initialize repository and create memories on first run
        // this.runtime.processAction("INITIALIZE_REPOSITORY", {
        //     owner: "user1",
        //     repo: "repo1",
        //     branch: "main",
        // });

        // await this.runtime.processAction("CREATE_MEMORIES_FROM_FILES", {
        //     owner: "user1",
        //     repo: "repo1",
        //     path: "/", // Root path of the repository
        // });

        // Start the OODA loop after initialization
        this.startOodaLoop();
    }
/**
 *     private setupEventListeners() {
        // When joining to a new server
        this.client.on("guildCreate", this.handleGuildCreate.bind(this));

        this.client.on(
            Events.MessageReactionAdd,
            this.handleReactionAdd.bind(this)
        );
        this.client.on(
            Events.MessageReactionRemove,
            this.handleReactionRemove.bind(this)
        );

        // Handle voice events with the voice manager
        this.client.on(
            "voiceStateUpdate",
            this.voiceManager.handleVoiceStateUpdate.bind(this.voiceManager)
        );
        this.client.on(
            "userStream",
            this.voiceManager.handleUserStream.bind(this.voiceManager)
        );

        // Handle a new message with the message manager
        this.client.on(
            Events.MessageCreate,
            this.messageManager.handleMessage.bind(this.messageManager)
        );

        // Handle a new interaction
        this.client.on(
            Events.InteractionCreate,
            this.handleInteractionCreate.bind(this)
        );
    }
 */
    private setupEventListeners() {
        this.client
    }

    async stop() {
        try {
            await this.client.stop()
          } catch(e) {
            elizaLogger.error('client-github instance stop err', e);
          }
    }

    private async onReady() {
        // TBD
    }

    /**
     * Initializes the OODA loop to continuously monitor and act upon repository state.
     */
    private startOodaLoop() {
        const interval = Number(this.runtime.getSetting("GITHUB_OODA_INTERVAL_MS")) || 300000; // Default to 5 minutes
        setInterval(() => {
            this.processOodaCycle();
        }, interval);
    }

    /**
     * Processes a single cycle of the OODA loop: Observe, Orient, Decide, Act.
     */
    private async processOodaCycle() {
        elizaLogger.log("Starting OODA cycle...");

        // Observe: Gather relevant memories related to the repository
        const memories = await this.runtime.messageManager.getMemories({
            roomId: this.getRepositoryRoomId(), // Function to retrieve the specific room ID
        });

        // Orient: Analyze the memories to determine if logging improvements are needed
        const context = composeContext({
            state: await this.runtime.composeState({
                userId: this.runtime.agentId,
                roomId: this.getRepositoryRoomId(),
                agentId: this.runtime.agentId,
                content: { text: "", action: "NOTHING", source: "github" },

            } as Memory, {

            }),
            template: oodaTemplate,
        });
        const response = await generateObjectV2({
            runtime: this.runtime,
            context,
            modelClass: ModelClass.LARGE,
            schema: OODASchema,
        });
        elizaLogger.log("response", response);
        if (!isOODAContent(response.object)) {
            elizaLogger.error("Invalid content", response.object);
            throw new Error("Invalid content");
        }

        const content = response.object as OODAContent;

        if (content.action === "CREATE_ISSUE") {
            elizaLogger.log("Decided to create an issue for logging improvement.");

            // Act: Execute the action to create an issue
            // We shoudldn't be directly calling the action handler here we should be
            // messaging the llm to create the issue via a template
            // createIssueAction.handler(this.runtime, message, state, issueContent);
        } else if (content.action === "COMMENT_ISSUE") {
            // We shoudldn't be directly calling the action handler here we should be
            // messaging the llm to create the issue via a template
            // addCommentToIssueAction.handler(this.runtime, message, state, issueContent);
        } else if (content.action === "NOTHING") {
            elizaLogger.log("No action needed.");
        }
        // now create a new memory with the new state
        // Generate IDs with timestamp to ensure uniqueness
        const timestamp = Date.now();
        const roomId = stringToUuid(`${this.getRepositoryRoomId()}-${this.runtime.agentId}`);
        const userIdUUID = stringToUuid(`${this.runtime.agentId}-${timestamp}`);
        const memoryUUID = stringToUuid(`${this.getRepositoryRoomId()}-${this.runtime.agentId}-${timestamp}`);

        // Create memory with retry logic
        const newMemory = {
            id: memoryUUID,
            userId: userIdUUID,
            agentId: this.runtime.agentId,
            content: {
                text: "TBD",
                action: content.action,
                source: "github",
                inReplyTo: stringToUuid(`${this.getRepositoryRoomId()}-${this.runtime.agentId}`)
            },
            roomId,
            createdAt: timestamp,
            embedding: getEmbeddingZeroVector(),
        };
        this.runtime
        try {
            await this.runtime.messageManager.createMemory(newMemory);
            elizaLogger.debug("Memory created", {
                memoryId: memoryUUID,
                action: content.action,
                userId: this.runtime.agentId,
            });
        } catch (error) {
            if (error.code === "23505") {
                // Duplicate key error
                elizaLogger.warn("Duplicate memory, skipping", {
                    memoryId: memoryUUID,
                });
                return;
            }
            throw error; // Re-throw other errors
        }

        // update the state with the new memory
        const state = await this.runtime.composeState(newMemory, {
            userId: this.runtime.agentId,
            roomId: this.getRepositoryRoomId(),
            agentId: this.runtime.agentId,
            content: {
                text: "content.message",
            },
        });
        await this.runtime.updateRecentMessageState(state);


        elizaLogger.log("OODA cycle completed.");
    }

    /**
     * Retrieves the specific room ID for the repository.
     * Replace this with the actual logic to obtain the room ID.
     */
    private getRepositoryRoomId(): UUID {
        return "repository-room-id-f-f";
    }
}

export const GitHubClientInterface: Client = {
    start: async (runtime: IAgentRuntime) => {
        await validateGithubConfig(runtime);

        elizaLogger.log("starting github client", runtime.agentId);

        const client = new GitHubClient(runtime);

        return client;
    },
    stop: async (runtime: IAgentRuntime) => {
        try {
            elizaLogger.log("stopping github client");
            await runtime.clients.github.stop();
        } catch (e) {
            elizaLogger.error("github client stop error", e);
        }
    },
};

export default GitHubClientInterface;

export const handleOODALoop = async (runtime: IAgentRuntime, client: Client, context: string, memory: Memory) => {
    let state = await runtime.composeState(memory, {
        githubClient: client,
        githubMessage: '',
        agentName: runtime.character.name,
    });
    const shouldRespond = await generateShouldRespond(
        {
            runtime,
            context,
            modelClass: ModelClass.LARGE
        }
    )
    if (shouldRespond === "RESPOND") {
        const context = composeContext({
            state,
            template:'',
        });

        const responseContent = await generateResponse(
            runtime,
            memory,
            state,
            context
        );
        const callback: HandlerCallback = async (
            content: Content,
            files: any[]
        ) => {
            return []
        };

        const responseMessages = await callback(responseContent);

        state = await runtime.updateRecentMessageState(state);

        await runtime.processActions(
            memory,
            responseMessages,
            state,
            callback
        );
    await runtime.evaluate(memory, state, shouldRespond === 'RESPOND');
    } else if (shouldRespond === 'IGNORE') {

    } else if (shouldRespond === 'STOP') {

    }
}

const generateResponse = async (runtime: IAgentRuntime, memory: Memory, state: State, context: string) => {
    const { userId, roomId } = memory;

    const response = await generateMessageResponse({
        runtime: runtime,
        context,
        modelClass: ModelClass.LARGE,
    });

    if (!response) {
        elizaLogger.error("No response from generateMessageResponse");
        return;
    }

    await runtime.databaseAdapter.log({
        body: { message: memory, context, response },
        userId: userId,
        roomId,
        type: "response",
    });

    return response;

}
