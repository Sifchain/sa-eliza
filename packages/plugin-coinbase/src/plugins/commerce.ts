import {
    composeContext,
    elizaLogger,
    generateObject,
    ModelClass,
    type Provider,
} from "@elizaos/core";
import type {
    Action,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    Plugin,
    State,
} from "@elizaos/core";
import { type ChargeContent, ChargeSchema, isChargeContent } from "../types";
import { chargeTemplate, getChargeTemplate } from "../templates";
import { getWalletDetails } from "../utils";
import { Coinbase } from "@coinbase/coinbase-sdk";
import { EmailClientInterface, SendEmailOptions } from "@elizaos/plugin-email";
import { EmailClient } from "../../../plugin-email/src/clients/emailClient";

const url = "https://api.commerce.coinbase.com/charges";
interface ChargeRequest {
    name: string;
    description: string;
    pricing_type: string;
    local_price: {
        amount: string;
        currency: string;
    };
}

export function sanitizeInvoices(data) {
    return data.map(invoice => {
        return {
            type: invoice.pricing_type,
            currency: invoice.pricing.local.currency,
            name: invoice.name,
            description: invoice.description,
            amount: invoice.pricing.local.amount,
            url: invoice.hosted_url,
        };
    });
}


export async function createCharge(apiKey: string, params: ChargeRequest) {
    elizaLogger.debug("Starting createCharge function");
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CC-Api-Key": apiKey,
            },
            body: JSON.stringify(params),
        });

        if (!response.ok) {
            throw new Error(`Failed to create charge: ${response.statusText}`);
        }

        const data = await response.json();
        return data.data;
    } catch (error) {
        elizaLogger.error("Error creating charge:", error.message);
        throw error;
    }
}

// Function to fetch all charges
export async function getAllCharges(apiKey: string) {
    elizaLogger.debug("Starting getAllCharges function");
    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "X-CC-Api-Key": apiKey,
            },
        });

        if (!response.ok) {
            throw new Error(
                `Failed to fetch all charges: ${response.statusText}`
            );
        }

        const data = await response.json();
        return data.data;
    } catch (error) {
        elizaLogger.error("Error fetching charges:", error.message);
        throw error;
    }
}

// Function to fetch details of a specific charge
export async function getChargeDetails(apiKey: string, chargeId: string) {
    elizaLogger.debug("Starting getChargeDetails function");
    const getUrl = `${url}/${chargeId}`;

    try {
        const response = await fetch(getUrl, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "X-CC-Api-Key": apiKey,
            },
        });

        if (!response.ok) {
            throw new Error(
                `Failed to fetch charge details: ${response.statusText}`
            );
        }

        const data = await response.json();
        return data;
    } catch (error) {
        elizaLogger.error(
            `Error fetching charge details for ID ${chargeId}:`,
            error.message
        );
        throw error;
    }
}

export const createCoinbaseChargeAction: Action = {
    name: "CREATE_CHARGE",
    similes: [
        "MAKE_CHARGE",
        "INITIATE_CHARGE",
        "GENERATE_CHARGE",
        "CREATE_TRANSACTION",
        "COINBASE_CHARGE",
        "GENERATE_INVOICE",
        "CREATE_PAYMENT",
        "SETUP_BILLING",
        "REQUEST_PAYMENT",
        "CREATE_CHECKOUT",
        "GET_CHARGE_STATUS",
        "LIST_CHARGES",
    ],
    description:
        "Create and manage payment charges using Coinbase Commerce. Supports fixed and dynamic pricing, multiple currencies (USD, EUR, USDC), and provides charge status tracking and management features.",
    validate: async (runtime: IAgentRuntime, _message: Memory) => {
        const coinbaseCommerceKeyOk = !!runtime.getSetting(
            "COINBASE_COMMERCE_KEY"
        );

        // Ensure Coinbase Commerce API key is available
        return coinbaseCommerceKeyOk;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback: HandlerCallback
    ) => {
        elizaLogger.info("Composing state for message:", message);
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        const context = composeContext({
            state,
            template: chargeTemplate,
        });

        const chargeDetails = await generateObject({
            runtime,
            context,
            modelClass: ModelClass.LARGE,
            schema: ChargeSchema,
        });
        if (!isChargeContent(chargeDetails.object)) {
            throw new Error("Invalid content");
        }
        const charge = chargeDetails.object as ChargeContent;
        if (!charge || !charge.price || !charge.type) {
            callback(
                {
                    text: "Invalid charge details provided.",
                },
                []
            );
            return;
        }

        elizaLogger.info("Charge details received:", chargeDetails);

        // Initialize Coinbase Commerce client
        elizaLogger.debug("Starting Coinbase Commerce client initialization");
        try {
            // Create a charge
            const chargeResponse = await createCharge(
                runtime.getSetting("COINBASE_COMMERCE_KEY"),
                {
                    local_price: {
                        amount: charge.price.toString(),
                        currency: charge.currency,
                    },
                    pricing_type: charge.type,
                    name: charge.name,
                    description: charge.description,
                }
            );

            elizaLogger.info(
                "Coinbase Commerce charge created:",
                chargeResponse
            );
            let text = `Charge created successfully: ${chargeResponse.hosted_url} `;
            if (charge.email != null && charge.email != "") {
                elizaLogger.info("Sending email to:", charge.email);
                // Send email with charge details
                const emailOptions: SendEmailOptions = {
                    from: "realityspiralagents@gmail.com", // Replace with your sender email
                    to: charge.email, // Replace with recipient email
                    subject: "You Just Received a Coinbase Commerce Charge",
                    text: `Hello,\n\nYou just received a Coinbase Commerce Charge.\n\nDetails:\n\nAmount: ${charge.price} ${charge.currency}\nName: ${charge.name}\nDescription: ${charge.description}\n\nIf it looks correct, please resolve the charge here:\n\n${chargeResponse.hosted_url}\n\nThank you for using Coinbase Commerce! Generated using agents.realityspiral.com.\n\n🌀🌀🌀\n\nRegards,\n\nReality Spiral`,
                };

                try {
                    // Initialize EmailClient
                    const emailClient = (
                        await EmailClientInterface.start(runtime)
                    ) as EmailClient;
                    const emailResponse = await emailClient.send(emailOptions);
                    elizaLogger.info(
                        "Email response:",
                        JSON.stringify(emailResponse, null, 2)
                    );
                    if ((emailResponse as any).accepted.length > 0) {
                        text = `${text}. Email sent successfully to ${charge.email}!`;
                    } else {
                        text = `${text}. Email failed to send to ${charge.email}!`;
                    }
                } catch (error) {
                    elizaLogger.error("Error sending email:", error.message);
                }
            }
            callback(
                {
                    text: text,
                },
                []
            );
        } catch (error) {
            elizaLogger.error(
                "Error creating Coinbase Commerce charge:",
                error.message
            );
            callback(
                {
                    text: `Failed to create a charge: ${error.message}`,
                },
                []
            );
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Create a charge for $100 USD for Digital Art NFT with description 'Exclusive digital artwork collection'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Charge created successfully:\n- Amount: $100 USD\n- Name: Digital Art NFT\n- Description: Exclusive digital artwork collection\n- Type: fixed_price\n- Charge URL: https://commerce.coinbase.com/charges/...",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Set up a dynamic price charge for Premium Membership named 'VIP Access Pass'",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Charge created successfully:\n- Type: dynamic_price\n- Name: VIP Access Pass\n- Description: Premium Membership\n- Charge URL: https://commerce.coinbase.com/charges/...",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Generate a payment request for 50 EUR for Workshop Registration",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Charge created successfully:\n- Amount: 50 EUR\n- Name: Workshop Registration\n- Type: fixed_price\n- Charge URL: https://commerce.coinbase.com/charges/...",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Create an invoice for 1000 USDC for Consulting Services",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Charge created successfully:\n- Amount: 1000 USDC\n- Name: Consulting Services\n- Type: fixed_price\n- Charge URL: https://commerce.coinbase.com/charges/...",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Check the status of charge abc-123-def",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Charge details retrieved:\n- ID: abc-123-def\n- Status: COMPLETED\n- Amount: 100 USD\n- Created: 2024-01-20T10:00:00Z\n- Expires: 2024-01-21T10:00:00Z",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "List all active charges",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Active charges retrieved:\n1. ID: abc-123 - $100 USD - Digital Art NFT\n2. ID: def-456 - 50 EUR - Workshop\n3. ID: ghi-789 - 1000 USDC - Consulting\n\nTotal active charges: 3",
                },
            },
        ],
    ],
} as Action;

export const getAllChargesAction: Action = {
    name: "GET_ALL_CHARGES",
    similes: ["FETCH_ALL_CHARGES", "RETRIEVE_ALL_CHARGES", "LIST_ALL_CHARGES"],
    description: "Fetch all charges using Coinbase Commerce.",
    validate: async (runtime: IAgentRuntime) => {
        const coinbaseCommerceKeyOk = !!runtime.getSetting(
            "COINBASE_COMMERCE_KEY"
        );

        // Ensure Coinbase Commerce API key is available
        return coinbaseCommerceKeyOk;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback: HandlerCallback
    ) => {
        try {
            elizaLogger.info("Composing state for message:", message);
            if (!state) {
                state = (await runtime.composeState(message)) as State;
            } else {
                state = await runtime.updateRecentMessageState(state);
            }
            const charges = await getAllCharges(
                runtime.getSetting("COINBASE_COMMERCE_KEY")
            );

            elizaLogger.info("Fetched all charges:", charges);
            const sanitizedCharges = sanitizeInvoices(charges);
            callback(
                {
                    text: `Successfully fetched all charges. Total charges: ${charges.length}.\nSee Details:\n${sanitizedCharges.map((charge) => `\nName: ${charge.name} Description: ${charge.description} Amount: ${charge.amount} Currency: ${charge.currency} Url: ${charge.url}`).join(",\n")}`,
                },
                []
            );
        } catch (error) {
            elizaLogger.error("Error fetching all charges:", error.message);
            callback(
                {
                    text: `Failed to fetch all charges: ${error.message}`,
                },
                []
            );
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Fetch all charges" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Successfully fetched all charges.",
                    action: "GET_ALL_CHARGES",
                },
            },
        ],
    ],
} as Action;

export const getChargeDetailsAction: Action = {
    name: "GET_CHARGE_DETAILS",
    similes: ["FETCH_CHARGE_DETAILS", "RETRIEVE_CHARGE_DETAILS", "GET_CHARGE"],
    description: "Fetch details of a specific charge using Coinbase Commerce.",
    validate: async (runtime: IAgentRuntime) => {
        const coinbaseCommerceKeyOk = !!runtime.getSetting(
            "COINBASE_COMMERCE_KEY"
        );

        // Ensure Coinbase Commerce API key is available
        return coinbaseCommerceKeyOk;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback: HandlerCallback
    ) => {
        elizaLogger.info("Composing state for message:", message);
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        const context = composeContext({
            state,
            template: getChargeTemplate,
        });
        const chargeDetails = await generateObject({
            runtime,
            context,
            modelClass: ModelClass.LARGE,
            schema: ChargeSchema,
        });
        if (!isChargeContent(chargeDetails.object)) {
            throw new Error("Invalid content");
        }
        const charge = chargeDetails.object as ChargeContent;
        if (!charge.id) {
            callback(
                {
                    text: "Missing charge ID. Please provide a valid charge ID.",
                },
                []
            );
            return;
        }

        try {
            const chargeDetails = await getChargeDetails(
                runtime.getSetting("COINBASE_COMMERCE_KEY"),
                charge.id
            );

            elizaLogger.info("Fetched charge details:", chargeDetails);

            const chargeData = chargeDetails.data;

            callback(
                {
                    text: `Successfully fetched charge details for ID: ${charge.id}`,
                    attachments: [
                        {
                            id: chargeData.id,
                            url: chargeData.hosted_url,
                            title: `Charge Details for ${charge.id}`,
                            source: "coinbase",
                            description: JSON.stringify(chargeDetails, null, 2),
                            text: `Pay here: ${chargeData.hosted_url}`,
                            contentType: "application/json",
                        },
                    ],
                },
                []
            );
        } catch (error) {
            elizaLogger.error(
                `Error fetching details for charge ID ${charge.id}:`,
                error.message
            );
            callback(
                {
                    text: `Failed to fetch details for charge ID: ${charge.id}. ${error.message}`,
                },
                []
            );
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Fetch details of charge ID: 123456",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Successfully fetched charge details. {{charge.id}} for {{charge.amount}} {{charge.currency}} to {{charge.name}} for {{charge.description}}",
                    action: "GET_CHARGE_DETAILS",
                },
            },
        ],
    ],
};

export const chargeProvider: Provider = {
    get: async (runtime: IAgentRuntime, _message: Memory) => {
        elizaLogger.debug("Starting chargeProvider.get function");
        const charges = await getAllCharges(
            runtime.getSetting("COINBASE_COMMERCE_KEY")
        );
        // Ensure API key is available
        const coinbaseAPIKey =
            runtime.getSetting("COINBASE_API_KEY") ??
            process.env.COINBASE_API_KEY;
        const coinbasePrivateKey =
            runtime.getSetting("COINBASE_PRIVATE_KEY") ??
            process.env.COINBASE_PRIVATE_KEY;
        const balances = [];
        const transactions = [];
        if (coinbaseAPIKey && coinbasePrivateKey) {
            Coinbase.configure({
                apiKeyName: coinbaseAPIKey,
                privateKey: coinbasePrivateKey,
            });
            const { balances, transactions } = await getWalletDetails(runtime);
            elizaLogger.info("Current Balances:", balances);
            elizaLogger.info("Last Transactions:", transactions);
        }
        const formattedCharges = charges.map((charge) => ({
            id: charge.id,
            name: charge.name,
            description: charge.description,
            pricing: charge.pricing,
        }));
        elizaLogger.info("Charges:", formattedCharges);
        return { charges: formattedCharges, balances, transactions };
    },
};

export const coinbaseCommercePlugin: Plugin = {
    name: "coinbaseCommerce",
    description:
        "Integration with Coinbase Commerce for creating and managing charges.",
    actions: [
        createCoinbaseChargeAction,
        getAllChargesAction,
        getChargeDetailsAction,
    ],
    evaluators: [],
    providers: [],
};
