[@elizaos/core v0.1.9](../index.md) / ModelSettings

# Type Alias: ModelSettings

> **ModelSettings**: `object`

Model settings

## Type declaration

### name

> **name**: `string`

Model name

### maxInputTokens

> **maxInputTokens**: `number`

Maximum input tokens

### maxOutputTokens

> **maxOutputTokens**: `number`

Maximum output tokens

### frequency\_penalty?

> `optional` **frequency\_penalty**: `number`

Optional frequency penalty

### presence\_penalty?

> `optional` **presence\_penalty**: `number`

Optional presence penalty

### repetition\_penalty?

> `optional` **repetition\_penalty**: `number`

Optional repetition penalty

### stop

> **stop**: `string`[]

Stop sequences

### temperature

> **temperature**: `number`

Temperature setting

### experimental\_telemetry?

> `optional` **experimental\_telemetry**: [`TelemetrySettings`](TelemetrySettings.md)

Optional telemetry configuration (experimental)

## Defined in

[packages/core/src/types.ts:142](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/types.ts#L142)
