[@elizaos/core v0.1.9](../index.md) / DBSpanProcessor

# Class: DBSpanProcessor

## Implements

- `SpanProcessor`

## Constructors

### new DBSpanProcessor()

> **new DBSpanProcessor**(): [`DBSpanProcessor`](DBSpanProcessor.md)

#### Returns

[`DBSpanProcessor`](DBSpanProcessor.md)

## Methods

### onStart()

> **onStart**(`span`): `void`

Called when a Span is started, if the `span.isRecording()`
returns true.

#### Parameters

• **span**: `ReadableSpan`

the Span that just started.

#### Returns

`void`

#### Implementation of

`SpanProcessor.onStart`

#### Defined in

[packages/core/src/dbSpanProcessor.ts:81](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/dbSpanProcessor.ts#L81)

***

### onEnd()

> **onEnd**(`span`): `Promise`\<`void`\>

Called when a ReadableSpan is ended, if the `span.isRecording()`
returns true.

#### Parameters

• **span**: `ReadableSpan`

the Span that just ended.

#### Returns

`Promise`\<`void`\>

#### Implementation of

`SpanProcessor.onEnd`

#### Defined in

[packages/core/src/dbSpanProcessor.ts:86](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/dbSpanProcessor.ts#L86)

***

### shutdown()

> **shutdown**(): `Promise`\<`void`\>

Shuts down the processor. Called when SDK is shut down. This is an
opportunity for processor to do any cleanup required.

#### Returns

`Promise`\<`void`\>

#### Implementation of

`SpanProcessor.shutdown`

#### Defined in

[packages/core/src/dbSpanProcessor.ts:123](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/dbSpanProcessor.ts#L123)

***

### forceFlush()

> **forceFlush**(): `Promise`\<`void`\>

Forces to export all finished spans

#### Returns

`Promise`\<`void`\>

#### Implementation of

`SpanProcessor.forceFlush`

#### Defined in

[packages/core/src/dbSpanProcessor.ts:127](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/dbSpanProcessor.ts#L127)
