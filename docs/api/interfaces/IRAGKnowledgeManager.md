[@elizaos/core v0.1.9](../index.md) / IRAGKnowledgeManager

# Interface: IRAGKnowledgeManager

## Properties

### runtime

> **runtime**: [`IAgentRuntime`](IAgentRuntime.md)

#### Defined in

[packages/core/src/types.ts:1203](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/types.ts#L1203)

***

### tableName

> **tableName**: `string`

#### Defined in

[packages/core/src/types.ts:1204](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/types.ts#L1204)

## Methods

### getKnowledge()

> **getKnowledge**(`params`): `Promise`\<[`RAGKnowledgeItem`](RAGKnowledgeItem.md)[]\>

#### Parameters

• **params**

• **params.query?**: `string`

• **params.id?**: \`$\{string\}-$\{string\}-$\{string\}-$\{string\}-$\{string\}\`

• **params.limit?**: `number`

• **params.conversationContext?**: `string`

• **params.agentId?**: \`$\{string\}-$\{string\}-$\{string\}-$\{string\}-$\{string\}\`

#### Returns

`Promise`\<[`RAGKnowledgeItem`](RAGKnowledgeItem.md)[]\>

#### Defined in

[packages/core/src/types.ts:1206](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/types.ts#L1206)

***

### createKnowledge()

> **createKnowledge**(`item`): `Promise`\<`void`\>

#### Parameters

• **item**: [`RAGKnowledgeItem`](RAGKnowledgeItem.md)

#### Returns

`Promise`\<`void`\>

#### Defined in

[packages/core/src/types.ts:1213](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/types.ts#L1213)

***

### removeKnowledge()

> **removeKnowledge**(`id`): `Promise`\<`void`\>

#### Parameters

• **id**: \`$\{string\}-$\{string\}-$\{string\}-$\{string\}-$\{string\}\`

#### Returns

`Promise`\<`void`\>

#### Defined in

[packages/core/src/types.ts:1214](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/types.ts#L1214)

***

### searchKnowledge()

> **searchKnowledge**(`params`): `Promise`\<[`RAGKnowledgeItem`](RAGKnowledgeItem.md)[]\>

#### Parameters

• **params**

• **params.agentId**: \`$\{string\}-$\{string\}-$\{string\}-$\{string\}-$\{string\}\`

• **params.embedding**: `number`[] \| `Float32Array`

• **params.match\_threshold?**: `number`

• **params.match\_count?**: `number`

• **params.searchText?**: `string`

#### Returns

`Promise`\<[`RAGKnowledgeItem`](RAGKnowledgeItem.md)[]\>

#### Defined in

[packages/core/src/types.ts:1215](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/types.ts#L1215)

***

### clearKnowledge()

> **clearKnowledge**(`shared`?): `Promise`\<`void`\>

#### Parameters

• **shared?**: `boolean`

#### Returns

`Promise`\<`void`\>

#### Defined in

[packages/core/src/types.ts:1222](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/types.ts#L1222)

***

### processFile()

> **processFile**(`file`): `Promise`\<`void`\>

#### Parameters

• **file**

• **file.path**: `string`

• **file.content**: `string`

• **file.type**: `"pdf"` \| `"md"` \| `"txt"`

• **file.isShared**: `boolean`

#### Returns

`Promise`\<`void`\>

#### Defined in

[packages/core/src/types.ts:1223](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/types.ts#L1223)

***

### cleanupDeletedKnowledgeFiles()

> **cleanupDeletedKnowledgeFiles**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Defined in

[packages/core/src/types.ts:1229](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/types.ts#L1229)

***

### generateScopedId()

> **generateScopedId**(`path`, `isShared`): \`$\{string\}-$\{string\}-$\{string\}-$\{string\}-$\{string\}\`

#### Parameters

• **path**: `string`

• **isShared**: `boolean`

#### Returns

\`$\{string\}-$\{string\}-$\{string\}-$\{string\}-$\{string\}\`

#### Defined in

[packages/core/src/types.ts:1230](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/types.ts#L1230)
