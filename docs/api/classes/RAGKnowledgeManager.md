[@elizaos/core v0.1.9](../index.md) / RAGKnowledgeManager

# Class: RAGKnowledgeManager

Manage knowledge in the database.

## Implements

- [`IRAGKnowledgeManager`](../interfaces/IRAGKnowledgeManager.md)

## Constructors

### new RAGKnowledgeManager()

> **new RAGKnowledgeManager**(`opts`): [`RAGKnowledgeManager`](RAGKnowledgeManager.md)

Constructs a new KnowledgeManager instance.

#### Parameters

• **opts**

Options for the manager.

• **opts.tableName**: `string`

The name of the table this manager will operate on.

• **opts.runtime**: [`IAgentRuntime`](../interfaces/IAgentRuntime.md)

The AgentRuntime instance associated with this manager.

• **opts.knowledgeRoot**: `string`

#### Returns

[`RAGKnowledgeManager`](RAGKnowledgeManager.md)

#### Defined in

[packages/core/src/ragknowledge.ts:40](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/ragknowledge.ts#L40)

## Properties

### runtime

> **runtime**: [`IAgentRuntime`](../interfaces/IAgentRuntime.md)

The AgentRuntime instance associated with this manager.

#### Implementation of

[`IRAGKnowledgeManager`](../interfaces/IRAGKnowledgeManager.md).[`runtime`](../interfaces/IRAGKnowledgeManager.md#runtime)

#### Defined in

[packages/core/src/ragknowledge.ts:22](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/ragknowledge.ts#L22)

***

### tableName

> **tableName**: `string`

The name of the database table this manager operates on.

#### Implementation of

[`IRAGKnowledgeManager`](../interfaces/IRAGKnowledgeManager.md).[`tableName`](../interfaces/IRAGKnowledgeManager.md#tableName)

#### Defined in

[packages/core/src/ragknowledge.ts:27](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/ragknowledge.ts#L27)

***

### knowledgeRoot

> **knowledgeRoot**: `string`

The root directory where RAG knowledge files are located (internal)

#### Defined in

[packages/core/src/ragknowledge.ts:32](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/ragknowledge.ts#L32)

## Methods

### getKnowledge()

> **getKnowledge**(`params`): `Promise`\<[`RAGKnowledgeItem`](../interfaces/RAGKnowledgeItem.md)[]\>

#### Parameters

• **params**

• **params.query?**: `string`

• **params.id?**: \`$\{string\}-$\{string\}-$\{string\}-$\{string\}-$\{string\}\`

• **params.conversationContext?**: `string`

• **params.limit?**: `number`

• **params.agentId?**: \`$\{string\}-$\{string\}-$\{string\}-$\{string\}-$\{string\}\`

#### Returns

`Promise`\<[`RAGKnowledgeItem`](../interfaces/RAGKnowledgeItem.md)[]\>

#### Implementation of

[`IRAGKnowledgeManager`](../interfaces/IRAGKnowledgeManager.md).[`getKnowledge`](../interfaces/IRAGKnowledgeManager.md#getKnowledge)

#### Defined in

[packages/core/src/ragknowledge.ts:165](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/ragknowledge.ts#L165)

***

### createKnowledge()

> **createKnowledge**(`item`): `Promise`\<`void`\>

#### Parameters

• **item**: [`RAGKnowledgeItem`](../interfaces/RAGKnowledgeItem.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IRAGKnowledgeManager`](../interfaces/IRAGKnowledgeManager.md).[`createKnowledge`](../interfaces/IRAGKnowledgeManager.md#createKnowledge)

#### Defined in

[packages/core/src/ragknowledge.ts:274](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/ragknowledge.ts#L274)

***

### searchKnowledge()

> **searchKnowledge**(`params`): `Promise`\<[`RAGKnowledgeItem`](../interfaces/RAGKnowledgeItem.md)[]\>

#### Parameters

• **params**

• **params.agentId**: \`$\{string\}-$\{string\}-$\{string\}-$\{string\}-$\{string\}\`

• **params.embedding**: `number`[] \| `Float32Array`

• **params.match\_threshold?**: `number`

• **params.match\_count?**: `number`

• **params.searchText?**: `string`

#### Returns

`Promise`\<[`RAGKnowledgeItem`](../interfaces/RAGKnowledgeItem.md)[]\>

#### Implementation of

[`IRAGKnowledgeManager`](../interfaces/IRAGKnowledgeManager.md).[`searchKnowledge`](../interfaces/IRAGKnowledgeManager.md#searchKnowledge)

#### Defined in

[packages/core/src/ragknowledge.ts:335](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/ragknowledge.ts#L335)

***

### removeKnowledge()

> **removeKnowledge**(`id`): `Promise`\<`void`\>

#### Parameters

• **id**: \`$\{string\}-$\{string\}-$\{string\}-$\{string\}-$\{string\}\`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IRAGKnowledgeManager`](../interfaces/IRAGKnowledgeManager.md).[`removeKnowledge`](../interfaces/IRAGKnowledgeManager.md#removeKnowledge)

#### Defined in

[packages/core/src/ragknowledge.ts:362](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/ragknowledge.ts#L362)

***

### clearKnowledge()

> **clearKnowledge**(`shared`?): `Promise`\<`void`\>

#### Parameters

• **shared?**: `boolean`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IRAGKnowledgeManager`](../interfaces/IRAGKnowledgeManager.md).[`clearKnowledge`](../interfaces/IRAGKnowledgeManager.md#clearKnowledge)

#### Defined in

[packages/core/src/ragknowledge.ts:366](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/ragknowledge.ts#L366)

***

### listAllKnowledge()

> **listAllKnowledge**(`agentId`): `Promise`\<[`RAGKnowledgeItem`](../interfaces/RAGKnowledgeItem.md)[]\>

Lists all knowledge entries for an agent without semantic search or reranking.
Used primarily for administrative tasks like cleanup.

#### Parameters

• **agentId**: \`$\{string\}-$\{string\}-$\{string\}-$\{string\}-$\{string\}\`

The agent ID to fetch knowledge entries for

#### Returns

`Promise`\<[`RAGKnowledgeItem`](../interfaces/RAGKnowledgeItem.md)[]\>

Array of RAGKnowledgeItem entries

#### Defined in

[packages/core/src/ragknowledge.ts:380](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/ragknowledge.ts#L380)

***

### cleanupDeletedKnowledgeFiles()

> **cleanupDeletedKnowledgeFiles**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IRAGKnowledgeManager`](../interfaces/IRAGKnowledgeManager.md).[`cleanupDeletedKnowledgeFiles`](../interfaces/IRAGKnowledgeManager.md#cleanupDeletedKnowledgeFiles)

#### Defined in

[packages/core/src/ragknowledge.ts:404](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/ragknowledge.ts#L404)

***

### generateScopedId()

> **generateScopedId**(`path`, `isShared`): \`$\{string\}-$\{string\}-$\{string\}-$\{string\}-$\{string\}\`

#### Parameters

• **path**: `string`

• **isShared**: `boolean`

#### Returns

\`$\{string\}-$\{string\}-$\{string\}-$\{string\}-$\{string\}\`

#### Implementation of

[`IRAGKnowledgeManager`](../interfaces/IRAGKnowledgeManager.md).[`generateScopedId`](../interfaces/IRAGKnowledgeManager.md#generateScopedId)

#### Defined in

[packages/core/src/ragknowledge.ts:486](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/ragknowledge.ts#L486)

***

### processFile()

> **processFile**(`file`): `Promise`\<`void`\>

#### Parameters

• **file**

• **file.path**: `string`

• **file.content**: `string`

• **file.type**: `"pdf"` \| `"md"` \| `"txt"`

• **file.isShared?**: `boolean`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IRAGKnowledgeManager`](../interfaces/IRAGKnowledgeManager.md).[`processFile`](../interfaces/IRAGKnowledgeManager.md#processFile)

#### Defined in

[packages/core/src/ragknowledge.ts:493](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/ragknowledge.ts#L493)
