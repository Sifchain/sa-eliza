import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    outDir: "dist",
    sourcemap: true,
    clean: true,
    format: ["esm"],
    dts: true,
    splitting: false,
    bundle: true,
    minify: false,
    external: [
        "@coinbase/coinbase-sdk",
        "@elizaos/core",
        "@elizaos/plugin-coinbase",
        "express",
        "body-parser",
        "node-fetch",
        "form-data",
        "combined-stream",
        "axios",
        "util",
        "stream",
        "http",
        "https",
        "events",
        "crypto",
        "buffer",
        "url",
        "zlib",
        "querystring",
        "os",
        "@reflink/reflink",
        "@node-llama-cpp",
        "agentkeepalive",
        "fs/promises",
        "csv-writer",
        "csv-parse/sync",
        "dotenv",
        "coinbase-advanced-sdk",
        "advanced-sdk-ts",
        "jsonwebtoken",
        "whatwg-url"
    ],
    platform: 'node',
    target: 'node23',
    esbuildOptions(options) {
        options.mainFields = ["module", "main"];
        options.conditions = ["import", "module", "require", "default"];
        options.platform = "node";
    }
});