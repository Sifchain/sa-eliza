[@elizaos/core v0.1.9](../index.md) / IVerifiableInferenceAdapter

# Interface: IVerifiableInferenceAdapter

Interface for verifiable inference adapters

## Properties

### options

> **options**: `any`

#### Defined in

[packages/core/src/types.ts:1615](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/types.ts#L1615)

## Methods

### generateText()

> **generateText**(`context`, `modelClass`, `options`?): `Promise`\<[`VerifiableInferenceResult`](VerifiableInferenceResult.md)\>

Generate text with verifiable proof

#### Parameters

• **context**: `string`

The input text/prompt

• **modelClass**: `string`

The model class/name to use

• **options?**: [`VerifiableInferenceOptions`](VerifiableInferenceOptions.md)

Additional provider-specific options

#### Returns

`Promise`\<[`VerifiableInferenceResult`](VerifiableInferenceResult.md)\>

Promise containing the generated text and proof data

#### Defined in

[packages/core/src/types.ts:1623](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/types.ts#L1623)

***

### verifyProof()

> **verifyProof**(`result`): `Promise`\<`boolean`\>

Verify the proof of a generated response

#### Parameters

• **result**: [`VerifiableInferenceResult`](VerifiableInferenceResult.md)

The result containing response and proof to verify

#### Returns

`Promise`\<`boolean`\>

Promise indicating if the proof is valid

#### Defined in

[packages/core/src/types.ts:1634](https://github.com/Sifchain/sa-eliza/blob/main/packages/core/src/types.ts#L1634)
