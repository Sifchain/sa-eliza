import { IAgentRuntime } from "@elizaos/core";
import { z } from "zod";

export const coinbaseEnvSchema = z.object({
    COINBASE_API_KEY: z.string().min(1, "Coinbase API key is required"),
    COINBASE_API_SECRET: z.string().min(1, "Coinbase API secret is required"),
    COINBASE_WEBHOOK_PORT: z.string().optional(),
    COINBASE_NOTIFICATION_URI: z.string().min(1, "Coinbase notification URI is required"),
    COINBASE_POSITION_SIZE: z.string()
        .transform(val => Number(val))
        .pipe(z.number().min(0.01).max(1))
        .optional()
        .default("0.1"),
});

export type CoinbaseConfig = z.infer<typeof coinbaseEnvSchema>;

export async function validateCoinbaseConfig(
    runtime: IAgentRuntime
): Promise<CoinbaseConfig> {
    try {
        const config = {
            COINBASE_API_KEY: runtime.getSetting("COINBASE_API_KEY"),
            COINBASE_API_SECRET: runtime.getSetting("COINBASE_API_SECRET"),
            COINBASE_WEBHOOK_PORT: runtime.getSetting("COINBASE_WEBHOOK_PORT"),
            COINBASE_NOTIFICATION_URI: runtime.getSetting("COINBASE_NOTIFICATION_URI"),
            COINBASE_POSITION_SIZE: runtime.getSetting("COINBASE_POSITION_SIZE"),
        };

        return coinbaseEnvSchema.parse(config);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            throw new Error(
                `Coinbase configuration validation failed:\n${errorMessages}`
            );
        }
        throw error;
    }
}