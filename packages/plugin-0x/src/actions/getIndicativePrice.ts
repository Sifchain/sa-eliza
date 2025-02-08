import {
    type Action,
    type IAgentRuntime,
    type Memory,
    type State,
    type HandlerCallback,
    elizaLogger,
    composeContext,
    ModelClass,
    generateObject,
    MemoryManager,
} from "@elizaos/core";
import { createClientV2 } from "@0x/swap-ts-sdk";
import { getIndicativePriceTemplate } from "../templates";
import { z } from "zod";
import { Chains, type GetIndicativePriceResponse, type PriceInquiry } from "../types";
import { CHAIN_NAMES, ZX_MEMORY } from "../constants";
import { EVMTokenRegistry } from "../EVMtokenRegistry";
import { TOKENS } from "../utils";
import {
    createWalletClient,
    http,
    getContract,
    erc20Abi,
    parseUnits,
    maxUint256,
    publicActions,
  } from "viem";
  import { privateKeyToAccount } from "viem/accounts";
  import { base } from "viem/chains";
export const IndicativePriceSchema = z.object({
    sellTokenSymbol: z.string().nullable(),
    sellAmount: z.number().nullable(),
    buyTokenSymbol: z.string().nullable(),
    chain: z.string().nullable(),
});

export interface IndicativePriceContent {
    sellTokenSymbol: string;
    sellAmount: number;
    buyTokenSymbol: string;
    chain: string;
}

export const getIndicativePrice: Action = {
    name: "GET_INDICATIVE_PRICE_0X",
    similes: [],
    suppressInitialMessage: true,
    description:
        "Get indicative price for a swap from 0x when user wants to convert their tokens",
    validate: async (runtime: IAgentRuntime) => {
        return !!runtime.getSetting("ZERO_EX_API_KEY");
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: Record<string, unknown>,
        callback: HandlerCallback
    ) => {
        const supportedChains = Object.keys(Chains).join(" | ");

        const localState = !state
            ? await runtime.composeState(message, { supportedChains })
            : await runtime.updateRecentMessageState(state);

        const context = composeContext({
            state: localState,
            template: getIndicativePriceTemplate,
        });

        const content = await generateObject({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
            schema: IndicativePriceSchema,
        });

        if (!isIndicativePriceContent(content.object)) {
            const missingFields = getMissingIndicativePriceContent(
                content.object
            );
            callback({
                text: `Need more information about the swap. Please provide me ${missingFields}`,
            });
            return;
        }

        const { sellTokenSymbol, sellAmount, buyTokenSymbol, chain } =
            content.object;

        // Convert chain string to chainId
        const chainId = Chains[chain.toLowerCase() as keyof typeof Chains];
        if (!chainId) {
            callback({
                text: `Unsupported chain: ${chain}. Supported chains are: ${Object.keys(
                    Chains
                )
                    .filter((k) => !Number.isNaN(Number(k)))
                    .join(", ")}`,
            });
            return;
        }

        const evmTokenRegistry = EVMTokenRegistry.getInstance();
        if (evmTokenRegistry.isChainSupported(chainId)) {
            await evmTokenRegistry.initializeChain(chainId);
        } else {
            callback({
                text: `Chain ${chain} is not supported for token swaps.`,
            });
            return;
        }

        const sellTokenMetadata = evmTokenRegistry.getTokenBySymbol(
            sellTokenSymbol,
            chainId
        );
        const buyTokenMetadata = evmTokenRegistry.getTokenBySymbol(
            buyTokenSymbol,
            chainId
        );

        if (!sellTokenMetadata || !buyTokenMetadata) {
            const missingTokens = [];
            if (!sellTokenMetadata) missingTokens.push(`'${sellTokenSymbol}'`);
            if (!buyTokenMetadata) missingTokens.push(`'${buyTokenSymbol}'`);

            callback({
                text: `Token${missingTokens.length > 1 ? 's' : ''} ${missingTokens.join(' and ')} not found on ${chain}. Please check the token symbols and chain.`,
            });
            return;
        }

        elizaLogger.info("Getting indicative price for:", {
            sellToken: sellTokenMetadata,
            buyToken: buyTokenMetadata,
            amount: sellAmount,
        });

        const zxClient = createClientV2({
            apiKey: runtime.getSetting("ZERO_EX_API_KEY"),
        });

        const sellAmountBaseUnits = parseUnits(
            sellAmount.toString(),
            sellTokenMetadata.decimals
        ).toString();

        try {
            const price = (await zxClient.swap.permit2.getPrice.query({
                sellAmount: sellAmountBaseUnits,
                sellToken: sellTokenMetadata.address,
                buyToken: buyTokenMetadata.address,
                chainId,
            })) as GetIndicativePriceResponse;

            // Format amounts to human-readable numbers
            const buyAmount =
                Number(price.buyAmount) /
                (10 ** buyTokenMetadata.decimals);
            const sellAmount =
                Number(price.sellAmount) /
                (10 ** sellTokenMetadata.decimals);

            await storePriceInquiryToMemory(runtime, message, {
                sellTokenObject: sellTokenMetadata,
                buyTokenObject: buyTokenMetadata,
                sellAmountBaseUnits,
                chainId,
                timestamp: new Date().toISOString(),
            });

            // Updated formatted response to include chain
            const formattedResponse = [
                "💱 Swap Details:",
                "────────────────",
                `📤 Sell: ${sellAmount.toFixed(4)} ${sellTokenMetadata.symbol}`,
                `📥 Buy: ${buyAmount.toFixed(4)} ${buyTokenMetadata.symbol}`,
                `📊 Rate: 1 ${sellTokenMetadata.symbol} = ${(buyAmount / sellAmount).toFixed(4)} ${buyTokenMetadata.symbol}`,
                `🔗 Chain: ${CHAIN_NAMES[chainId]}`,
                "────────────────",
                `💫 Happy with the price? Type 'quote' to continue`,
            ].join("\n");

            callback({ text: formattedResponse });
            return true;
        } catch (error) {
            elizaLogger.error("Error getting price:", error);
            callback({
                text: `Error getting price: ${error.message || error}`,
                content: { error: error.message || String(error) },
            });
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What's the price of 2 ETH in USDC on Optimism?",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Let me check the current exchange rate for ETH/USDC on Optimism.",
                    action: "GET_INDICATIVE_PRICE_0X",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "I want to swap WETH for USDT on Arbitrum",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll help you check the price. How much WETH would you like to swap?",
                    action: "GET_INDICATIVE_PRICE_0X",
                },
            },
            {
                user: "{{user1}}",
                content: {
                    text: "5 WETH",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Let me get the indicative price for 5 WETH to USDT on Arbitrum.",
                    action: "GET_INDICATIVE_PRICE_0X",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Price check for 1000 USDC to WETH on Base",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll check the current exchange rate for 1000 USDC to WETH on Base network.",
                    action: "GET_INDICATIVE_PRICE_0X",
                },
            },
        ],
    ],
};

export const isIndicativePriceContent = (
    object: any
): object is IndicativePriceContent => {
    if (IndicativePriceSchema.safeParse(object).success) {
        return true;
    }
    return false;
};

export const getMissingIndicativePriceContent = (
    content: Partial<IndicativePriceContent>
): string => {
    const missingFields = [];

    if (typeof content.sellTokenSymbol !== "string")
        missingFields.push("sell token");
    if (typeof content.buyTokenSymbol !== "string")
        missingFields.push("buy token");
    if (typeof content.sellAmount !== "number")
        missingFields.push("sell amount");

    return missingFields.join(" and ");
};

export const storePriceInquiryToMemory = async (
    runtime: IAgentRuntime,
    message: Memory,
    priceInquiry: PriceInquiry
) => {
    const memory: Memory = {
        roomId: message.roomId,
        userId: message.userId,
        agentId: runtime.agentId,
        content: {
            text: JSON.stringify(priceInquiry),
            type: ZX_MEMORY.price.type,
        },
    };

    const memoryManager = new MemoryManager({
        runtime,
        tableName: ZX_MEMORY.price.tableName,
    });

    await memoryManager.createMemory(memory);
};


const getTokenMetadata = (tokenSymbol: string) => {
    switch (tokenSymbol) {
        case 'ETH':
            return TOKENS.ETH;
        case 'WETH':
            return TOKENS.WETH;
        case 'USDC':
            return TOKENS.USDC;
        case 'CBBTC':
        case 'BTC':
        case 'WBTC':
            return TOKENS.cbBTC;
        case 'DAI':
            return TOKENS.DAI;
        default:
            elizaLogger.error(`${tokenSymbol} is not supported`);
            return null;
    }
};

export const getPriceInquiry = async (
    runtime: IAgentRuntime,
    sellTokenSymbol: string,
    sellAmount: number,
    buyTokenSymbol: string,
    chain: string
): Promise<PriceInquiry | null> => {
    if (sellAmount < 0.000000000000000001) {
        elizaLogger.error(`sellAmount ${sellAmount} is too small`);
        return null;
    }
    try {
        // Hardcoded chainId for Base network
        const chainId = 8453;
        
        // Get token metadata
        const buyTokenMetadata = getTokenMetadata(buyTokenSymbol);
        const sellTokenMetadata = getTokenMetadata(sellTokenSymbol);

        if (!sellTokenMetadata || !buyTokenMetadata) {
            elizaLogger.error('Invalid token metadata');
            return null;
        }

        // Initialize 0x client
        const zxClient = createClientV2({
            apiKey: runtime.getSetting("ZERO_EX_API_KEY"),
        });

        // Convert sell amount to base units
        const sellAmountBaseUnits = parseUnits(
            sellAmount.toString(),
            sellTokenMetadata.decimals
        ).toString();

        // Setup wallet client
        const client = createWalletClient({
            account: privateKeyToAccount(("0x" + runtime.getSetting("WALLET_PRIVATE_KEY")) as `0x${string}`),
            chain: base,
            transport: http(runtime.getSetting("ALCHEMY_HTTP_TRANSPORT_URL")),
        }).extend(publicActions);

        // Get price quote
        const price = await getPrice(zxClient, {
            sellAmount: sellAmountBaseUnits,
            sellToken: sellTokenMetadata.address,
            buyToken: buyTokenMetadata.address,
            chainId,
        });

        if (!price) return null;

        // Handle token approvals
        const approved = await handleTokenApprovals(client, price, sellTokenMetadata.address);
        if (!approved) return null;

        // Format response
        const formattedAmounts = formatAmounts(price, buyTokenMetadata, sellTokenMetadata);
        logFormattedResponse(formattedAmounts, chainId);

        return {
            sellTokenObject: sellTokenMetadata,
            buyTokenObject: buyTokenMetadata,
            sellAmountBaseUnits,
            chainId,
            timestamp: new Date().toISOString(),
        };

    } catch (error) {
        elizaLogger.error("Error in getPriceInquiry:", error.message);
        return null;
    }
};

// Helper functions
const getPrice = async (zxClient: any, params: any): Promise<GetIndicativePriceResponse | null> => {
    try {
        const price = await zxClient.swap.allowanceHolder.getPrice.query(params) as GetIndicativePriceResponse;
        return price;
    } catch (error) {
        elizaLogger.error("Error getting price:", error.message);
        return null;
    }
};

const handleTokenApprovals = async (client: any, price: GetIndicativePriceResponse, sellTokenAddress: string = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'): Promise<boolean> => {
    try {
        const sellTokenContract = getContract({
            address: sellTokenAddress,
            abi: erc20Abi,
            client: client as any,
        });

        if (price.issues.allowance !== null) {
            const { request } = await (sellTokenContract as any).simulate.approve([
                (price as any).issues.allowance.spender,
                maxUint256,
            ]);

            const hash = await (sellTokenContract as any).write.approve(request.args);
            await client.waitForTransactionReceipt({ hash });
            elizaLogger.info("Token approval successful");
        }

        return true;
    } catch (error) {
        elizaLogger.error("Error handling token approvals:", error);
        return false;
    }
};

const formatAmounts = (price: GetIndicativePriceResponse, buyTokenMetadata: any, sellTokenMetadata: any) => {
    const buyAmount = Number(price.buyAmount) / Math.pow(10, buyTokenMetadata.decimals);
    const sellAmount = Number(price.sellAmount) / Math.pow(10, sellTokenMetadata.decimals);
    
    return {
        buyAmount,
        sellAmount,
        rate: buyAmount / sellAmount,
        buySymbol: buyTokenMetadata.symbol,
        sellSymbol: sellTokenMetadata.symbol
    };
};

const logFormattedResponse = (amounts: any, chainId: number) => {
    const response = [
        `💱 Swap Details:`,
        `────────────────`,
        `📤 Sell: ${amounts.sellAmount.toFixed(4)} ${amounts.sellSymbol}`,
        `📥 Buy: ${amounts.buyAmount.toFixed(4)} ${amounts.buySymbol}`,
        `📊 Rate: 1 ${amounts.sellSymbol} = ${amounts.rate.toFixed(4)} ${amounts.buySymbol}`,
        `🔗 Chain: ${CHAIN_NAMES[chainId]}`,
        `────────────────`,
    ].join("\n");
    
    elizaLogger.info('Formatted response:', response);
};
