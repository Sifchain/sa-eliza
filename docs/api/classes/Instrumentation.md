[@elizaos/core v0.1.9](../index.md) / Instrumentation

# Class: Instrumentation

## Methods

### getInstance()

> `static` **getInstance**(): [`Instrumentation`](Instrumentation.md)

#### Returns

[`Instrumentation`](Instrumentation.md)

#### Defined in

[packages/core/src/instrumentation.ts:44](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/instrumentation.ts#L44)

***

### logEvent()

> **logEvent**(`event`): `void`

Log a tracing event. This method creates a new span, adds the event attributes,
outputs the event as a JSON string to console, and ends the span.

#### Parameters

• **event**: [`InstrumentationEvent`](../interfaces/InstrumentationEvent.md)

#### Returns

`void`

#### Defined in

[packages/core/src/instrumentation.ts:55](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/instrumentation.ts#L55)

***

### sessionStart()

> **sessionStart**(`data`): `void`

Concise helper methods for common instrumentation events:

#### Parameters

• **data**: `Record`\<`string`, `any`\>

#### Returns

`void`

#### Defined in

[packages/core/src/instrumentation.ts:75](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/instrumentation.ts#L75)

***

### contextLoaded()

> **contextLoaded**(`data`): `void`

#### Parameters

• **data**: `Record`\<`string`, `any`\>

#### Returns

`void`

#### Defined in

[packages/core/src/instrumentation.ts:83](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/instrumentation.ts#L83)

***

### messageReceived()

> **messageReceived**(`data`): `void`

#### Parameters

• **data**: `Record`\<`string`, `any`\>

#### Returns

`void`

#### Defined in

[packages/core/src/instrumentation.ts:91](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/instrumentation.ts#L91)

***

### modelSelected()

> **modelSelected**(`data`): `void`

#### Parameters

• **data**: `Record`\<`string`, `any`\>

#### Returns

`void`

#### Defined in

[packages/core/src/instrumentation.ts:104](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/instrumentation.ts#L104)

***

### generationStarted()

> **generationStarted**(`data`): `void`

#### Parameters

• **data**: `Record`\<`string`, `any`\>

#### Returns

`void`

#### Defined in

[packages/core/src/instrumentation.ts:112](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/instrumentation.ts#L112)

***

### actionTriggered()

> **actionTriggered**(`data`): `void`

#### Parameters

• **data**: `Record`\<`string`, `any`\>

#### Returns

`void`

#### Defined in

[packages/core/src/instrumentation.ts:120](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/instrumentation.ts#L120)

***

### memoryPersisted()

> **memoryPersisted**(`data`): `void`

#### Parameters

• **data**: `Record`\<`string`, `any`\>

#### Returns

`void`

#### Defined in

[packages/core/src/instrumentation.ts:128](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/instrumentation.ts#L128)
