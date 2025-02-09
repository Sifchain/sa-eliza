import { formatUnits, Hash } from "viem";
import { EVMTokenRegistry } from "./EVMtokenRegistry";
import { IAgentRuntime } from "@elizaos/core";

/**
 * Formats a token amount with its symbol
 * @param amount The amount in base units (e.g., wei)
 * @param address The token address
 * @param chainId The chain ID (defaults to 1 for Ethereum mainnet)
 * @returns Formatted string like "1.234567 USDC"
 */
export function formatTokenAmount(
    amount: string,
    address: string,
    chainId: number = 1
): string {
    if (!amount) return "0";

    const tokenRegistry = EVMTokenRegistry.getInstance();
    const token = tokenRegistry.getTokenByAddress(address, chainId);

    if (!token) throw new Error(`Token not found for address: ${address}`);

    const parsedAmount = formatUnits(BigInt(amount), token.decimals);
    return `${Number(parsedAmount).toFixed(4)} ${token.symbol}`;
}

export const TOKENS = {
    ETH: {
        chainId: 8453,
        name: "Ethereum",
        symbol: "ETH",
        decimals: 18,
        address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        type: "NATIVE",
        logoURI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png"
    },
    WETH: {
        chainId: 8453,
        name: "Wrapped Ether",
        symbol: "WETH",
        decimals: 18,
        address: "0x4200000000000000000000000000000000000006",
        type: "ERC20",
        logoURI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png"
    },
    USDC: {
        chainId: 8453,
        name: "USD coin",
        symbol: "USDC",
        decimals: 6,
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        type: "ERC20",
        logoURI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png"
    },
    axlUSDC: {
        chainId: 8453,
        asset: "c8453_t0xEB466342C4d449BC9f53A865D5Cb90586f405215",
        type: "BASE",
        address: "0xEB466342C4d449BC9f53A865D5Cb90586f405215",
        name: "Axelar Wrapped USDC",
        symbol: "axlUSDC",
        decimals: 6,
        logoURI: "https://assets-cdn.trustwallet.com/blockchains/base/assets/0xEB466342C4d449BC9f53A865D5Cb90586f405215/logo.png",
        pairs: []
    },
    cbBTC: {
        chainId: 8453,
        name: "Coinbase Wrapped BTC",
        symbol: "cbBTC",
        decimals: 8,
        address: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
        type: "ERC20",
        logoURI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png"
    },
    DAI: {
        chainId: 8453,
        asset: "c8453_t0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
        type: "BASE",
        address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
        name: "Dai",
        symbol: "DAI",
        decimals: 18,
        logoURI: "https://assets-cdn.trustwallet.com/blockchains/base/assets/0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb/logo.png",
        pairs: []
    },
};

