[@elizaos/core v0.1.9](../index.md) / extractAttributes

# Function: extractAttributes()

> **extractAttributes**(`response`, `attributesToExtract`?): `object`

Extracts specific attributes (e.g., user, text, action) from a JSON-like string using regex.

## Parameters

• **response**: `string`

The cleaned string response to extract attributes from.

• **attributesToExtract?**: `string`[]

An array of attribute names to extract.

## Returns

`object`

An object containing the extracted attributes.

## Defined in

[packages/core/src/parsing.ts:192](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/parsing.ts#L192)
