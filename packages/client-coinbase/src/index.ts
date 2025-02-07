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
    State,
    UUID,
    Provider,
} from "@elizaos/core";
import { postTweet } from "@elizaos/plugin-twitter";
import express from "express";
import {
    blockExplorerBaseAddressUrl,
    blockExplorerBaseTxUrl,
    WebhookEvent,
} from "./types";
import { Coinbase, Wallet } from "@coinbase/coinbase-sdk";
import {
    initializeWallet,
    readContractWrapper,
    type CoinbaseWallet,
} from "@elizaos/plugin-coinbase";
import { tokenSwap } from "@elizaos/plugin-0x";
import { createWalletClient, erc20Abi, http, publicActions } from "viem";
import { getPriceInquiry } from "../../plugin-0x/src/actions/getIndicativePrice";
import { getQuoteObj } from "../../plugin-0x/src/actions/getQuote";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import axios from 'axios';

export type WalletType =
    | "short_term_trading"
    | "long_term_trading"
    | "dry_powder"
    | "operational_capital";

export class CoinbaseClient implements Client {
    private runtime: IAgentRuntime;
    private server: express.Application;
    private port: number;
    private wallets: CoinbaseWallet[];
    private initialBalanceETH: number;

    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;
        // add providers to runtime
        this.runtime.providers.push(pnlProvider);
        this.runtime.providers.push(balanceProvider);
        this.runtime.providers.push(addressProvider);
        this.runtime.providers.push(tradingSignalBackTestProvider)
        this.server = express();
        this.port = Number(runtime.getSetting("COINBASE_WEBHOOK_PORT")) || 3001;
        this.wallets = [];
        this.initialBalanceETH = 1;
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
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Methods", "POST");
            res.header("Access-Control-Allow-Headers", "Content-Type");
            if (req.method === "OPTIONS") {
                return res.sendStatus(200);
            }
            next();
        });

        // Add webhook validation middleware
        const validateWebhook = (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            const event = req.body as WebhookEvent;
            elizaLogger.info("event ", JSON.stringify(event));
            if (
                !event.event ||
                !event.ticker ||
                !event.timestamp ||
                !event.price
            ) {
                res.status(400).json({ error: "Invalid webhook payload" });
                return;
            }
            if (event.event !== "buy" && event.event !== "sell") {
                res.status(400).json({ error: "Invalid event type" });
                return;
            }
            next();
        };

        // Add health check endpoint
        this.server.get("/health", (req, res) => {
            res.status(200).json({ status: "ok" });
        });

        this.server.get("/webhook/coinbase/health", (req, res) => {
            elizaLogger.info("Health check received");
            res.status(200).json({ status: "ok" });
        });

        this.server.post("/webhook/coinbase/:agentId", async (req, res) => {
            elizaLogger.info("Webhook received for agent:", req.params.agentId);
            const runtime = this.runtime;

            if (!runtime) {
                res.status(404).json({ error: "Agent not found" });
                return;
            }

            // Validate the webhook payload
            const event = req.body as WebhookEvent;
            if (
                !event.event ||
                !event.ticker ||
                !event.timestamp ||
                !event.price
            ) {
                res.status(400).json({ error: "Invalid webhook payload" });
                return;
            }
            if (event.event !== "buy" && event.event !== "sell") {
                res.status(400).json({ error: "Invalid event type" });
                return;
            }

            try {
                // Forward the webhook event to the client's handleWebhookEvent method
                await this.handleWebhookEvent(event);
                res.status(200).json({ status: "success" });
            } catch (error) {
                elizaLogger.error(
                    "Error processing Coinbase webhook:",
                    error.message
                );
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        return new Promise<void>((resolve, reject) => {
            try {
                this.server.listen(this.port, "0.0.0.0", () => {
                    elizaLogger.info(
                        `Webhook server listening on port ${this.port}`
                    );
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
        const walletTypes: WalletType[] = [
            "short_term_trading",
            "long_term_trading",
            "dry_powder",
            "operational_capital",
        ];
        const networkId = Coinbase.networks.BaseMainnet;
        for (const walletType of walletTypes) {
            elizaLogger.info("walletType ", walletType);
            const wallet = await initializeWallet(
                this.runtime,
                networkId,
                walletType
            );
            elizaLogger.info(
                "Successfully loaded wallet ",
                wallet.wallet.getId()
            );
            this.wallets.push(wallet);
        }
    }

    private async generateTweetContent(
        event: WebhookEvent,
        amountInCurrency: number,
        pnl: string,
        formattedTimestamp: string,
        state: State,
        hash: string | null
    ): Promise<string> {
        try {
            const tradeTweetTemplate = `
# Task
Craft a compelling and concise tweet to announce a Coinbase trade. Aim for creativity and professionalism.

Trade specifics:
- ${event.event.toUpperCase()} order for ${event.ticker}
- Amount traded: $${amountInCurrency.toFixed(2)}
- Price at trade: $${Number(event.price).toFixed(2)}
- Timestamp: ${formattedTimestamp}
- Txn: ${blockExplorerBaseTxUrl(hash)}
- PNL: ${pnl}
Guidelines:
1. Keep it under 180 characters
2. Include 1-2 relevant emojis
3. Avoid hashtags
4. Use varied wording for freshness
5. Mention market conditions, timing, or strategy if applicable
6. Maintain a professional yet conversational tone
7. Ensure key details are present: action, amount, ticker, and price

Sample buy tweets:
"📈 Added $${amountInCurrency.toFixed(2)} of ${event.ticker} at $${Number(
                event.price
            ).toFixed(2)}. Overall PNL: ${pnl} ${blockExplorerBaseTxUrl(hash)}"
"🎯 Strategic ${event.ticker} buy: $${amountInCurrency.toFixed(2)} at $${Number(
                event.price
            ).toFixed(2)}. Overall PNL: ${pnl} ${blockExplorerBaseTxUrl(hash)}"

Sample sell tweets:
"💫 Sold ${event.ticker}: $${amountInCurrency.toFixed(2)} at $${Number(
                event.price
            ).toFixed(2)}. Overall PNL: ${pnl} ${blockExplorerBaseTxUrl(hash)}"
"📊 Sold $${amountInCurrency.toFixed(2)} of ${event.ticker} at $${Number(
                event.price
            ).toFixed(2)}. Overall PNL: ${pnl} ${blockExplorerBaseTxUrl(hash)}"

Generate only the tweet text, no commentary or markdown.`;
            const context = composeContext({
                template: tradeTweetTemplate,
                state,
            });

            const tweetContent = await generateText({
                runtime: this.runtime,
                context,
                modelClass: ModelClass.LARGE,
            });

            const trimmedContent = tweetContent.trim();
            return trimmedContent.length > 180
                ? trimmedContent.substring(0, 177) + "..."
                : trimmedContent;
        } catch (error) {
            elizaLogger.error("Error generating tweet content:", error);
            const amount =
                Number(this.runtime.getSetting("COINBASE_TRADING_AMOUNT")) ?? 1;
            const fallbackTweet = `🚀 ${event.event.toUpperCase()}: $${amount.toFixed(
                2
            )} of ${event.ticker} at $${Number(event.price).toFixed(2)}`;
            return fallbackTweet;
        }
    }

    private async handleWebhookEvent(event: WebhookEvent) {
        // for now just support ETH
        if (event.ticker !== "ETH" && event.ticker !== "WETH") {
            elizaLogger.info("Unsupported ticker:", event.ticker);
            return;
        }
        // Set up room and ensure participation
        const roomId = stringToUuid("coinbase-trading");
        await this.setupRoom(roomId);

        // Get trading amount from settings
        const amount =
            Number(this.runtime.getSetting("COINBASE_TRADING_AMOUNT")) ?? 1;
        elizaLogger.info("amount ", amount);

        // Create and store memory of trade
        const memory = this.createTradeMemory(event, amount, roomId);
        elizaLogger.info("memory ", memory);
        await this.runtime.messageManager.createMemory(memory);

        // Generate state and format timestamp
        const state = await this.runtime.composeState(memory);
        const formattedTimestamp = this.getFormattedTimestamp();
        elizaLogger.info("formattedTimestamp ", formattedTimestamp);

        // Execute token swap
        const buy = event.event.toUpperCase() === "BUY";
        const amountInCurrency = buy ? amount : amount / Number(event.price);
        const txHash = await this.executeTokenSwap(
            event,
            amountInCurrency,
            buy
        );
        if (txHash == null) {
            elizaLogger.error("txHash is null");
            return;
        }
        elizaLogger.info("txHash ", txHash);

        const pnl = await calculateOverallPNL(
            this.runtime,
            this.runtime.getSetting("WALLET_PUBLIC_KEY") as `0x${string}`,
            1000
        );
        elizaLogger.info("pnl ", pnl);

        // Generate and post tweet
        await this.handleTweetPosting(
            event,
            amount,
            pnl,
            formattedTimestamp,
            state,
            txHash
        );
    }

    private async setupRoom(roomId: UUID) {
        await this.runtime.ensureRoomExists(roomId);
        await this.runtime.ensureParticipantInRoom(
            this.runtime.agentId,
            roomId
        );
    }

    private createTradeMemory(
        event: WebhookEvent,
        amount: number,
        roomId: UUID
    ): Memory {
        return {
            id: stringToUuid(`coinbase-${event.timestamp}`),
            userId: this.runtime.agentId,
            agentId: this.runtime.agentId,
            roomId,
            content: {
                text: `${event.event.toUpperCase()} $${amount} worth of ${
                    event.ticker
                }`,
                action: "SWAP",
                source: "coinbase",
                metadata: {
                    ticker: event.ticker,
                    side: event.event.toUpperCase(),
                    price: event.price,
                    amount: amount,
                    timestamp: event.timestamp,
                    walletType: "short_term_trading",
                },
            },
            createdAt: Date.now(),
        };
    }

    private getFormattedTimestamp(): string {
        return new Intl.DateTimeFormat("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            timeZoneName: "short",
        }).format(new Date());
    }

    private async executeTokenSwap(
        event: WebhookEvent,
        amount: number,
        buy: boolean
    ): Promise<string | null> {
        return await tokenSwap(
            this.runtime,
            amount,
            buy ? "USDC" : event.ticker,
            buy ? event.ticker : "USDC",
            this.runtime.getSetting("WALLET_PUBLIC_KEY"),
            this.runtime.getSetting("WALLET_PRIVATE_KEY"),
            "base"
        );
    }

    private async handleTweetPosting(
        event: WebhookEvent,
        amount: number,
        pnl: string,
        formattedTimestamp: string,
        state: State,
        txHash: string
    ) {
        try {
            const tweetContent = await this.generateTweetContent(
                event,
                amount,
                pnl,
                formattedTimestamp,
                state,
                txHash
            );
            elizaLogger.info("Generated tweet content:", tweetContent);

            if (
                this.runtime.getSetting("TWITTER_DRY_RUN").toLowerCase() ===
                "true"
            ) {
                elizaLogger.info(
                    "Dry run mode enabled. Skipping tweet posting."
                );
                return;
            }

            const response = await postTweet(this.runtime, tweetContent);
            elizaLogger.info("Tweet response:", response);
        } catch (error) {
            elizaLogger.error("Failed to post tweet:", error);
        }
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
        elizaLogger.info(
            "Starting Coinbase client with agent ID:",
            runtime.agentId
        );
        const client = new CoinbaseClient(runtime);
        await client.start();
        return client;
    },
    stop: async (runtime: IAgentRuntime) => {
        try {
            elizaLogger.info("Stopping Coinbase client");
            await runtime.clients.coinbase.stop();
        } catch (e) {
            elizaLogger.error("Coinbase client stop error:", e);
        }
    },
};

export const calculateOverallPNL = async (
    runtime: IAgentRuntime,
    publicKey: `0x${string}`,
    initialBalance: number
): Promise<string> => {
    elizaLogger.info(`initialBalance ${initialBalance}`);
    const totalBalanceUSD = await getTotalBalanceUSD(runtime, publicKey);
    elizaLogger.info(`totalBalanceUSD ${totalBalanceUSD}`);
    const pnlUSD = totalBalanceUSD - initialBalance;
    elizaLogger.info(`pnlUSD ${pnlUSD}`);
    const absoluteValuePNL = Math.abs(pnlUSD);
    elizaLogger.info(`absoluteValuePNL ${absoluteValuePNL}`);
    const formattedPNL = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(absoluteValuePNL);
    elizaLogger.info("formattedPNL ", formattedPNL);
    const formattedPNLUSD = `${pnlUSD < 0 ? "-" : ""}${formattedPNL}`;
    elizaLogger.info("formattedPNLUSD ", formattedPNLUSD);
    return formattedPNLUSD;
};

export async function getTotalBalanceUSD(
    runtime: IAgentRuntime,
    publicKey: `0x${string}`
): Promise<number> {
    const client = createWalletClient({
        account: privateKeyToAccount(
            ("0x" + runtime.getSetting("WALLET_PRIVATE_KEY")) as `0x${string}`
        ),
        chain: base,
        transport: http(runtime.getSetting("ALCHEMY_HTTP_TRANSPORT_URL")),
    }).extend(publicActions);
    const ethBalanceBaseUnits = await client.getBalance({
        address: publicKey,
    });
    const ethBalance = Number(ethBalanceBaseUnits) / 1e18;
    elizaLogger.info(`ethBalance ${ethBalance}`);
    const priceInquiry = await getPriceInquiry(
        runtime,
        "ETH",
        ethBalance,
        "USDC",
        "base"
    );
    // get latest quote
    elizaLogger.info("Getting quote for swap", JSON.stringify(priceInquiry));
    const quote = await getQuoteObj(runtime, priceInquiry, publicKey);
    elizaLogger.info("quote ", JSON.stringify(quote));
    const ethBalanceUSD = Number(quote.buyAmount) / 1e6;
    elizaLogger.info(`ethBalanceUSD ${ethBalanceUSD}`);
    const usdcBalanceBaseUnits = await readContractWrapper(
        runtime,
        "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        "balanceOf",
        {
            account: publicKey,
        },
        "base-mainnet",
        erc20Abi
    );
    const usdcBalance = Number(usdcBalanceBaseUnits) / 1e6;
    elizaLogger.info(`usdcBalance ${usdcBalance}`);
    return ethBalanceUSD + usdcBalance;
}

export const pnlProvider: Provider = {
    get: async (runtime: IAgentRuntime, _message: Memory) => {
        elizaLogger.debug("Starting pnlProvider.get function");
        try {
            const pnl = await calculateOverallPNL(
                runtime,
                runtime.getSetting("WALLET_PUBLIC_KEY") as `0x${string}`,
                1000
            );
            elizaLogger.info("pnl ", pnl);
            return `PNL: ${pnl}`;
        } catch (error) {
            elizaLogger.error("Error in pnlProvider: ", error.message);
            return [];
        }
    },
};

export const balanceProvider: Provider = {
    get: async (runtime: IAgentRuntime, _message: Memory) => {
        const totalBalanceUSD = await getTotalBalanceUSD(
            runtime,
            runtime.getSetting("WALLET_PUBLIC_KEY") as `0x${string}`
        );
        return `Total balance: $${totalBalanceUSD.toFixed(2)}`;
    },
};

export const addressProvider: Provider = {
    get: async (runtime: IAgentRuntime, _message: Memory) => {
        return `Address: ${runtime.getSetting("WALLET_PUBLIC_KEY")}`;
    },
};

export const tradingSignalBackTestProvider: Provider = {
    get: async (runtime: IAgentRuntime, _message: Memory) => {
        const timeFrames = {
            '1D': {
                netProfit: 1000,
                totalTradesClosed: 50,
                percentageProfitable: 60,
                profitFactor: 1.5,
                maxDrawdown: 10,
                averageTrade: 20,
                numberOfBarsPerTrade: 5,
                winRate: 55,
                timePeriod: '1D'
            },
            '5D': {
                netProfit: 2000,
                totalTradesClosed: 45,
                percentageProfitable: 65,
                profitFactor: 1.6,
                maxDrawdown: 12,
                averageTrade: 25,
                numberOfBarsPerTrade: 6,
                winRate: 60,
                timePeriod: '5D'
            },
            '1W': {
                netProfit: 3000,
                totalTradesClosed: 40,
                percentageProfitable: 70,
                profitFactor: 1.7,
                maxDrawdown: 15,
                averageTrade: 30,
                numberOfBarsPerTrade: 7,
                winRate: 65,
                timePeriod: '1W'
            },
            '1M': {
                netProfit: 4000,
                totalTradesClosed: 35,
                percentageProfitable: 75,
                profitFactor: 1.8,
                maxDrawdown: 18,
                averageTrade: 35,
                numberOfBarsPerTrade: 8,
                winRate: 70,
                timePeriod: '1M'
            },
            '3M': {
                netProfit: 5000,
                totalTradesClosed: 30,
                percentageProfitable: 80,
                profitFactor: 1.9,
                maxDrawdown: 20,
                averageTrade: 40,
                numberOfBarsPerTrade: 9,
                winRate: 75,
                timePeriod: '3M'
            },
            '6M': {
                netProfit: 6000,
                totalTradesClosed: 25,
                percentageProfitable: 85,
                profitFactor: 2.0,
                maxDrawdown: 22,
                averageTrade: 45,
                numberOfBarsPerTrade: 10,
                winRate: 80,
                timePeriod: '6M'
            },
            'YTD': {
                netProfit: 7000,
                totalTradesClosed: 20,
                percentageProfitable: 90,
                profitFactor: 2.1,
                maxDrawdown: 25,
                averageTrade: 50,
                numberOfBarsPerTrade: 11,
                winRate: 85,
                timePeriod: 'YTD'
            }
        };

        const backtestResults = Object.entries(timeFrames).map(([timeFrame, data]) => {
            return `
            ETH ${timeFrame}: Net Profit: ${data.netProfit}, Total Trades Closed: ${data.totalTradesClosed}, Percentage Profitable: ${data.percentageProfitable}, Profit Factor: ${data.profitFactor}, Max Drawdown: ${data.maxDrawdown}, Average Trade: ${data.averageTrade}, Number of Bars per Trade: ${data.numberOfBarsPerTrade}, Win Rate: ${data.winRate}, Time Period: ${data.timePeriod}
            `;
        }).join('\n');

        return `
        BACKTEST RESULTS:
        TICKER: ETH DIRECTION: LONG 
        ${backtestResults}
        `;
    },
};

export default CoinbaseClientInterface;
