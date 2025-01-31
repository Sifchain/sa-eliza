import {
    elizaLogger,
    Client,
    IAgentRuntime,
    Memory,
    Content,
    HandlerCallback,
    stringToUuid,
    composeContext,
    generateText,
    ModelClass,
    State
} from "@elizaos/core";
import { postTweet } from "@elizaos/plugin-twitter";
import express from "express";
import { blockExplorerBaseAddressUrl, blockExplorerBaseTxUrl, WebhookEvent } from "./types";
import { Coinbase, Wallet } from "@coinbase/coinbase-sdk";
import { initializeWallet } from "@elizaos/plugin-coinbase";
import { calculateOverallPNL, tokenSwap } from "@elizaos/plugin-0x";

export type WalletType = 'short_term_trading' | 'long_term_trading' | 'dry_powder' | 'operational_capital';
export type CoinbaseWallet = { wallet: Wallet, walletType: WalletType };

export class CoinbaseClient implements Client {
    private runtime: IAgentRuntime;
    private server: express.Application;
    private port: number;
    private wallets: CoinbaseWallet[];
    private initialBalanceETH: number;

    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;
        this.server = express();
        this.port = Number(runtime.getSetting("COINBASE_WEBHOOK_PORT")) || 3001;
        this.wallets = [];
        this.initialBalanceETH = 1
    }

    async initialize(): Promise<void> {
        elizaLogger.info("Initializing Coinbase client");
        try {
            elizaLogger.info("Coinbase client initialized successfully");
            // await this.initializeWallets();
            elizaLogger.info("Wallets initialized successfully");
            await this.setupWebhookEndpoint();
            elizaLogger.info("Webhook endpoint setup successfully");
        } catch (error) {
            elizaLogger.error("Failed to initialize Coinbase client:", error);
            throw error;
        }
    }

    private setupWebhookEndpoint() {
        this.server.use(express.json());

        // Add CORS middleware to allow external requests
        this.server.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'POST');
            res.header('Access-Control-Allow-Headers', 'Content-Type');
            if (req.method === 'OPTIONS') {
                return res.sendStatus(200);
            }
            next();
        });

        // Add webhook validation middleware
        const validateWebhook = (req: express.Request, res: express.Response, next: express.NextFunction) => {
            const event = req.body as WebhookEvent;
            if (!event.event || !event.ticker || !event.timestamp || !event.price) {
                res.status(400).json({ error: "Invalid webhook payload" });
                return;
            }
            if (event.event !== 'buy' && event.event !== 'sell') {
                res.status(400).json({ error: "Invalid event type" });
                return;
            }
            next();
        };

        // Add health check endpoint
        this.server.get('/health', (req, res) => {
            res.status(200).json({ status: 'ok' });
        });

        // Main webhook endpoint
        this.server.post("/webhook", validateWebhook, async (req, res) => {
            try {
                const event = req.body as WebhookEvent;
                await this.handleWebhookEvent(event);
                res.status(200).json({ status: "success" });
            } catch (error) {
                elizaLogger.error("Error processing webhook:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        return new Promise<void>((resolve, reject) => {
            try {
                this.server.listen(this.port, '0.0.0.0', () => {
                    elizaLogger.info(`Webhook server listening on port ${this.port}`);
                    resolve();
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    private async initializeWallets() {
        Coinbase.configure({
            apiKeyName:
                this.runtime.getSetting("COINBASE_API_KEY") ??
                process.env.COINBASE_API_KEY,
            privateKey:
                this.runtime.getSetting("COINBASE_PRIVATE_KEY") ??
                process.env.COINBASE_PRIVATE_KEY,
        });
        const walletTypes: WalletType[] = ['short_term_trading', 'long_term_trading', 'dry_powder', 'operational_capital'];
        const networkId = Coinbase.networks.BaseMainnet;
        for (const walletType of walletTypes) {
            elizaLogger.log('walletType ', walletType);
            const wallet = await initializeWallet(this.runtime, networkId, walletType);
            elizaLogger.log('Successfully loaded wallet ', wallet.wallet.getId());
            this.wallets.push(wallet);
        }
    }

    private async generateTweetContent(event: WebhookEvent, amountInCurrency: number, pnlText: string, formattedTimestamp: string, state: State, address:string, hash: string | null): Promise<string> {
        try {
            const tradeTweetTemplate = `
# Task
Craft a compelling and concise tweet to announce a Coinbase trade. Aim for creativity and professionalism.

Trade specifics:
- ${event.event.toUpperCase()} order for ${event.ticker}
- Amount traded: $${amountInCurrency.toFixed(2)}
- Price at trade: $${Number(event.price).toFixed(2)}
- Unrealized PNL: $${pnlText}
- Timestamp: ${formattedTimestamp}
- Txn: ${blockExplorerBaseTxUrl(hash)}
- Address: ${blockExplorerBaseAddressUrl(address)}
Guidelines:
1. Keep it under 180 characters
2. Include 1-2 relevant emojis
3. Avoid hashtags
4. Use varied wording for freshness
5. Mention market conditions, timing, or strategy if applicable
6. Maintain a professional yet conversational tone
7. Ensure key details are present: action, amount, ticker, and price

Sample buy tweets:
"📈 Added $1,000 of BTC at $50,000.00. Unrealized PNL: $${pnlText} Txn: ${blockExplorerBaseTxUrl(hash)} Address: ${blockExplorerBaseAddressUrl(address)}"
"🎯 Strategic BTC buy: $1,000 at $50,000.00. Unrealized PNL: $${pnlText} Txn: ${blockExplorerBaseTxUrl(hash)} Address: ${blockExplorerBaseAddressUrl(address)}"

Sample sell tweets:
"💫 Sold BTC: $1,000 at $52,000.00. Unrealized PNL: $${pnlText}. Txn: ${blockExplorerBaseTxUrl(hash)}"
"📊 Sold $1,000 of BTC at $52,000.00. Unrealized PNL: $${pnlText}. Txn: ${blockExplorerBaseTxUrl(hash)}"

Generate only the tweet text, no commentary or markdown.`;
            const context = composeContext({
                template: tradeTweetTemplate,
                state
            });

            const tweetContent = await generateText({
                runtime: this.runtime,
                context,
                modelClass: ModelClass.LARGE,
            });

            const trimmedContent = tweetContent.trim();
            return trimmedContent.length > 180 ? trimmedContent.substring(0, 177) + "..." : trimmedContent;

        } catch (error) {
            elizaLogger.error("Error generating tweet content:", error);
            const amount = Number(this.runtime.getSetting('COINBASE_TRADING_AMOUNT')) ?? 1;
            const fallbackTweet = `🚀 ${event.event.toUpperCase()}: $${amount.toFixed(2)} of ${event.ticker} at $${Number(event.price).toFixed(2)}`;
            return fallbackTweet;
        }
    }

    private async handleWebhookEvent(event: WebhookEvent) {
        const roomId = stringToUuid("coinbase-trading");
        await this.runtime.ensureRoomExists(roomId);
        await this.runtime.ensureParticipantInRoom(this.runtime.agentId, roomId);
        // TODO: based off of the signal decide which wallet to use
        // const wallet = this.wallets.find(wallet => wallet.walletType === 'short_term_trading');
        // if (!wallet) {
        //     elizaLogger.error("Short term trading wallet not found");
        //     return;
        // }

        const amount = Number(this.runtime.getSetting('COINBASE_TRADING_AMOUNT')) ?? 1;
        const memory: Memory = {
            id: stringToUuid(`coinbase-${event.timestamp}`),
            userId: this.runtime.agentId,
            agentId: this.runtime.agentId,
            roomId,
            content: {
                text: `${event.event.toUpperCase()} $${amount} worth of ${event.ticker}`,
                action: "SWAP",
                source: "coinbase",
                metadata: {
                    ticker: event.ticker,
                    side: event.event.toUpperCase(),
                    price: event.price,
                    amount: amount,
                    timestamp: event.timestamp,
                    walletType: 'short_term_trading',
                }
            },
            createdAt: Date.now()
        };
        // get short term trading wallet
        await this.runtime.messageManager.createMemory(memory);
        const state = await this.runtime.composeState(memory);
        const callback: HandlerCallback = async (content: Content) => {
            if (!content.text.includes("Trade executed successfully")) {
                return [];
            }
        // Generate tweet content
        const formattedTimestamp = new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        }).format(new Date(event.timestamp));
        // const defaultAddress = await wallet.wallet.getDefaultAddress();
        const buy =  event.event.toUpperCase() === 'BUY'
        const txHash = await tokenSwap(this.runtime, amount, buy ? event.ticker : 'USDC', buy ? event.ticker : 'USDC', this.runtime.getSetting('WALLET_PUBLIC_KEY'), this.runtime.getSetting('WALLET_PRIVATE_KEY'), 8453);
        const pnl = await calculateOverallPNL(this.runtime, this.runtime.getSetting('WALLET_PRIVATE_KEY'), this.runtime.getSetting('WALLET_PUBLIC_KEY'), 8453, this.initialBalanceETH);
        const pnlText = `Overall PNL: ${pnl}`;
        elizaLogger.log('pnlText ', pnlText)

            try {
                const tweetContent = await this.generateTweetContent(event, amount, pnlText, formattedTimestamp, state, this.runtime.getSetting('WALLET_PUBLIC_KEY'), txHash);
                elizaLogger.info("Generated tweet content:", tweetContent);
                if (this.runtime.getSetting('TWITTER_DRY_RUN')) {
                    elizaLogger.info("Dry run mode enabled. Skipping tweet posting.",);
                    return;
                }
                const response = await postTweet(this.runtime, tweetContent);
                elizaLogger.info("Tweet response:", response);
            } catch (error) {
                elizaLogger.error("Failed to post tweet:", error);
            }
        };
    }

    async stop(): Promise<void> {
        try {
            if (this.server?.listen) {
                await new Promise<void>((resolve, reject) => {
                    this.server.listen().close((err: Error | undefined) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }
            elizaLogger.info("Coinbase client stopped successfully");
        } catch (error) {
            elizaLogger.error("Error stopping Coinbase client:", error);
            throw error;
        }
    }

    getType(): string {
        return "coinbase";
    }

    getName(): string {
        return "coinbase";
    }

    async start(): Promise<void> {
        await this.initialize();
    }

}

export const CoinbaseClientInterface: Client = {
    start: async (runtime: IAgentRuntime) => {
        elizaLogger.log("Starting Coinbase client with agent ID:", runtime.agentId);
        const client = new CoinbaseClient(runtime);
        await client.start();
        return client;
    },
    stop: async (runtime: IAgentRuntime) => {
        try {
            elizaLogger.log("Stopping Coinbase client");
            await runtime.clients.coinbase.stop();
        } catch (e) {
            elizaLogger.error("Coinbase client stop error:", e);
        }
    },
};

export default CoinbaseClientInterface;