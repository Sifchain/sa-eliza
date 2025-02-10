[@elizaos/core v0.1.9](../index.md) / normalizeJsonString

# Function: normalizeJsonString()

> **normalizeJsonString**(`str`): `string`

Normalizes a JSON-like string by correcting formatting issues:
- Removes extra spaces after '{' and before '}'.
- Wraps unquoted values in double quotes.
- Converts single-quoted values to double-quoted.
- Ensures consistency in key-value formatting.
- Normalizes mixed adjacent quote pairs.

This is useful for cleaning up improperly formatted JSON strings
before parsing them into valid JSON.

## Parameters

• **str**: `string`

The JSON-like string to normalize.

## Returns

`string`

A properly formatted JSON string.

## Defined in

[packages/core/src/parsing.ts:234](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/parsing.ts#L234)
