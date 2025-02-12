diff --git a/packages/adapter-postgres/schema.sql b/packages/adapter-postgres/schema.sql
index e0ef6d5a5..7a367318e 100644
--- a/packages/adapter-postgres/schema.sql
+++ b/packages/adapter-postgres/schema.sql
@@ -166,8 +166,3 @@ CREATE INDEX IF NOT EXISTS idx_knowledge_shared ON knowledge("isShared");
 CREATE INDEX IF NOT EXISTS idx_knowledge_embedding ON knowledge USING ivfflat (embedding vector_cosine_ops);
 
 COMMIT;
-
--- Remove DEFAULT clauses since code provides empty strings
-ALTER TABLE traces 
-ALTER COLUMN raw_context DROP DEFAULT,
-ALTER COLUMN raw_response DROP DEFAULT;
diff --git a/packages/adapter-postgres/tracing-schema.sql b/packages/adapter-postgres/tracing-schema.sql
index 683e8e6b8..9afa3d76c 100644
--- a/packages/adapter-postgres/tracing-schema.sql
+++ b/packages/adapter-postgres/tracing-schema.sql
@@ -23,8 +23,6 @@ CREATE TABLE IF NOT EXISTS traces (
     session_id VARCHAR(256),
     environment VARCHAR(64),
     room_id VARCHAR(256),
-    raw_context TEXT NOT NULL DEFAULT '',
-    raw_response TEXT NOT NULL DEFAULT '',
     PRIMARY KEY (trace_id, span_id)
 );
 
@@ -52,33 +50,4 @@ CREATE TABLE IF NOT EXISTS events (
 CREATE INDEX idx_events_agent ON events (agent_id);
 CREATE INDEX idx_events_type ON events (event_type);
 CREATE INDEX idx_events_time ON events (event_time);
-CREATE INDEX idx_events_room ON events (room_id);
-
--- Remove strict constraints temporarily
-ALTER TABLE traces 
-DROP CONSTRAINT IF EXISTS raw_context_not_empty,
-DROP CONSTRAINT IF EXISTS raw_response_not_empty;
-
--- Keep NOT NULL but allow empty strings
-ALTER TABLE traces 
-ALTER COLUMN raw_context DROP DEFAULT,
-ALTER COLUMN raw_response DROP DEFAULT;
-
--- Add smarter constraints that allow placeholders
-ALTER TABLE traces 
-DROP CONSTRAINT valid_raw_context,
-DROP CONSTRAINT valid_raw_response;
-
-ALTER TABLE traces 
-ADD CONSTRAINT valid_raw_context 
-CHECK (
-    (span_name = 'llm_context_pre' AND raw_context <> '')
-    OR (span_name <> 'llm_context_pre')
-);
-
-ALTER TABLE traces 
-ADD CONSTRAINT valid_raw_response 
-CHECK (
-    (span_name = 'llm_response_post' AND raw_response <> '')
-    OR (span_name <> 'llm_response_post')
-);
\ No newline at end of file
+CREATE INDEX idx_events_room ON events (room_id);
\ No newline at end of file
diff --git a/packages/core/src/dbSpanProcessor.ts b/packages/core/src/dbSpanProcessor.ts
index 52bddfe45..7534fa150 100644
--- a/packages/core/src/dbSpanProcessor.ts
+++ b/packages/core/src/dbSpanProcessor.ts
@@ -33,15 +33,13 @@ async function insertTrace(spanData: any): Promise<void> {
       agent_id,
       session_id,
       environment,
-      room_id,
-      raw_context,
-      raw_response
+      room_id
     )
     VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9, $10,
       $11, $12, $13, $14, $15,
-      $16, $17, $18, $19, $20, $21
+      $16, $17, $18, $19
     )
     ON CONFLICT (trace_id, span_id) DO NOTHING;
   `;
@@ -66,8 +64,6 @@ async function insertTrace(spanData: any): Promise<void> {
     spanData.session_id || null,
     spanData.environment || null,
     spanData.room_id || null,
-    spanData.raw_context || '',
-    spanData.raw_response || '',
   ];
 
   try {
@@ -88,10 +84,6 @@ export class DBSpanProcessor implements SpanProcessor {
   }
 
   async onEnd(span: ReadableSpan): Promise<void> {
-    if (!['llm_context_pre', 'llm_response_post'].includes(span.name)) {
-      return; // Skip non-LLM spans
-    }
-
     const spanContext = span.spanContext();
     console.log('Span Context:', spanContext);
     console.log('Span Whole:', span);
@@ -104,11 +96,10 @@ export class DBSpanProcessor implements SpanProcessor {
     const attributes = span.attributes || {};
     const resource = span.resource?.attributes || {};
 
-    // Add truncation here
-    const MAX_CONTEXT_LENGTH = 4000;
-    const safeTrim = (value: unknown) => {
-      if (typeof value !== 'string') return '';
-      return value.trim().substring(0, MAX_CONTEXT_LENGTH);
+    const safeTrim = (value: unknown): string | null => {
+      if (typeof value !== 'string') return null;
+      const trimmed = value.trim();
+      return trimmed.length > 0 ? trimmed : null;
     };
 
     const spanData = {
@@ -127,30 +118,21 @@ export class DBSpanProcessor implements SpanProcessor {
       links: span.links || [],
       resource: resource,
       agent_id: safeTrim(attributes.agentId),
-      session_id: safeTrim(attributes['session.id']),
-      environment:
-        safeTrim(attributes['environment']) ||
-        safeTrim(resource['deployment.environment']) ||
-        'unknown',
-      room_id: safeTrim(attributes['room.id']),
-      raw_context: safeTrim(attributes.raw_context) || '',
-      raw_response: safeTrim(attributes.raw_response) || '',
+      session_id: safeTrim(attributes["session.id"]),
+      environment: safeTrim(attributes["environment"]) || 
+                   safeTrim(resource["deployment.environment"]) ||
+                   'unknown',
+      room_id: safeTrim(attributes["room.id"]),
     };
 
-    // Modify the validation check to allow spans with raw_context/response
-    if (
-      !spanData.agent_id && 
-      !spanData.session_id && 
-      !spanData.room_id
-    ) {
-      console.log('⚠️ Skipping span...');
+    // Add validation
+    if (!spanData.agent_id && !spanData.session_id && !spanData.room_id) {
+      console.log('⚠️ Skipping span with no context IDs:', span.name);
       return;
     }
 
     console.log('🟡 Span ended, inserting:', span.name, spanData);
 
-    console.log('Span attributes:', JSON.stringify(attributes, null, 2));
-
     try {
       await insertTrace(spanData);
     } catch (error) {
diff --git a/packages/core/src/generation.ts b/packages/core/src/generation.ts
index 9140f8c7e..8522a59cd 100644
--- a/packages/core/src/generation.ts
+++ b/packages/core/src/generation.ts
@@ -54,7 +54,6 @@ import { fal } from "@fal-ai/client";
 
 import BigNumber from "bignumber.js";
 import { createPublicClient, http } from "viem";
-import { instrument } from "./instrumentation.ts"; // Import the instrumentation
 
 type Tool = CoreTool<any, any>;
 type StepResult = AIStepResult<any>;
@@ -363,8 +362,6 @@ export async function generateText({
     verifiableInferenceAdapter?: IVerifiableInferenceAdapter;
     verifiableInferenceOptions?: VerifiableInferenceOptions;
 }): Promise<string> {
-    console.log('🏁 generateText called with context:', context.slice(0, 50) + '...'); // Add this
-    
     if (!context) {
         console.error("generateText context is empty");
         return "";
@@ -513,36 +510,20 @@ export async function generateText({
 
     const apiKey = runtime.token;
 
-    //  ADD startTime HERE, *OUTSIDE* the try block
-    const startTime = Date.now();
-
     try {
-        console.log('🔧 Trimming context...');
-        // BEFORE trimming
-        const originalContext = context; // ✅ Correct
+        elizaLogger.debug(
+            `Trimming context to max length of ${max_context_length} tokens.`
+        );
+
         context = await trimTokens(context, max_context_length, runtime);
 
-        // Add these at the start of generateText()
-        let originalResponse: string; // Will capture raw model output
-
-        console.log('📝 Logging context prepared');
-        console.log('📝 Context prepared - raw:', originalContext?.length);
-        instrument.contextPrepared({
-            sessionId: runtime.sessionId,
-            agentId: runtime.agentId,
-            roomId: runtime.agentId,
-            context: context,
-            model: model,
-            raw_context: originalContext || '[EMPTY_CONTEXT]',
-        });
+        let response: string;
 
-        // Before instrumentation calls
-        console.log('🐛 RAW_CTX:', originalContext?.substring(0,50));
-        console.log('🐛 RAW_RES:', originalResponse?.substring(0,50));
+        const _stop = stop || modelSettings.stop;
+        elizaLogger.debug(
+            `Using provider: ${provider}, model: ${model}, temperature: ${temperature}, max response length: ${max_response_length}`
+        );
 
-        let response: string;
-        console.log('🤖 Selecting provider:', provider);
-        
         switch (provider) {
             // OPENAI & LLAMACLOUD shared same structure.
             case ModelProviderName.OPENAI:
@@ -555,7 +536,6 @@ export async function generateText({
             case ModelProviderName.NINETEEN_AI:
             case ModelProviderName.AKASH_CHAT_API:
             case ModelProviderName.LMSTUDIO: {
-                console.log('⚡ Using OpenAI provider');
                 elizaLogger.debug(
                     "Initializing OpenAI model with Cloudflare check"
                 );
@@ -588,7 +568,6 @@ export async function generateText({
 
                 response = openaiResponse;
                 console.log("Received response from OpenAI model.");
-                originalResponse = response; // Capture raw model output
                 break;
             }
 
@@ -676,7 +655,6 @@ export async function generateText({
 
                 response = openaiResponse;
                 elizaLogger.debug("Received response from EternalAI model.");
-                originalResponse = response; // Capture raw model output
                 break;
             }
 
@@ -705,7 +683,6 @@ export async function generateText({
 
                 response = googleResponse;
                 elizaLogger.debug("Received response from Google model.");
-                originalResponse = response; // Capture raw model output
                 break;
             }
 
@@ -727,7 +704,6 @@ export async function generateText({
 
                 response = mistralResponse;
                 elizaLogger.debug("Received response from Mistral model.");
-                originalResponse = response; // Capture raw model output
                 break;
             }
 
@@ -764,7 +740,6 @@ export async function generateText({
 
                 response = anthropicResponse;
                 elizaLogger.debug("Received response from Anthropic model.");
-                originalResponse = response; // Capture raw model output
                 break;
             }
 
@@ -797,7 +772,6 @@ export async function generateText({
                 elizaLogger.debug(
                     "Received response from Claude Vertex model."
                 );
-                originalResponse = response; // Capture raw model output
                 break;
             }
 
@@ -830,7 +804,6 @@ export async function generateText({
 
                 response = grokResponse;
                 elizaLogger.debug("Received response from Grok model.");
-                originalResponse = response; // Capture raw model output
                 break;
             }
 
@@ -865,7 +838,6 @@ export async function generateText({
 
                 response = groqResponse;
                 elizaLogger.debug("Received response from Groq model.");
-                originalResponse = response; // Capture raw model output
                 break;
             }
 
@@ -885,13 +857,12 @@ export async function generateText({
                 response = await textGenerationService.queueTextCompletion(
                     context,
                     temperature,
-                    stop, // Corrected _stop to stop
+                    _stop,
                     frequency_penalty,
                     presence_penalty,
                     max_response_length
                 );
                 elizaLogger.debug("Received response from local Llama model.");
-                originalResponse = response; // Capture raw model output
                 break;
             }
 
@@ -923,7 +894,6 @@ export async function generateText({
 
                 response = redpillResponse;
                 elizaLogger.debug("Received response from redpill model.");
-                originalResponse = response; // Capture raw model output
                 break;
             }
 
@@ -955,7 +925,6 @@ export async function generateText({
 
                 response = openrouterResponse;
                 elizaLogger.debug("Received response from OpenRouter model.");
-                originalResponse = response; // Capture raw model output
                 break;
             }
 
@@ -985,7 +954,6 @@ export async function generateText({
                     });
 
                     response = ollamaResponse;
-                    originalResponse = response; // Capture raw model output
                 }
                 elizaLogger.debug("Received response from Ollama model.");
                 break;
@@ -1018,7 +986,6 @@ export async function generateText({
 
                 response = heuristResponse;
                 elizaLogger.debug("Received response from Heurist model.");
-                originalResponse = response; // Capture raw model output
                 break;
             }
             case ModelProviderName.GAIANET: {
@@ -1072,7 +1039,6 @@ export async function generateText({
 
                 response = openaiResponse;
                 elizaLogger.debug("Received response from GAIANET model.");
-                originalResponse = response; // Capture raw model output
                 break;
             }
 
@@ -1103,7 +1069,6 @@ export async function generateText({
 
                 response = atomaResponse;
                 elizaLogger.debug("Received response from Atoma model.");
-                originalResponse = response; // Capture raw model output
                 break;
             }
 
@@ -1142,7 +1107,6 @@ export async function generateText({
 
                 response = galadrielResponse;
                 elizaLogger.debug("Received response from Galadriel model.");
-                originalResponse = response; // Capture raw model output
                 break;
             }
 
@@ -1174,7 +1138,6 @@ export async function generateText({
                 });
                 response = inferaResponse;
                 elizaLogger.debug("Received response from Infera model.");
-                originalResponse = response; // Capture raw model output
                 break;
             }
 
@@ -1199,10 +1162,14 @@ export async function generateText({
                     maxTokens: max_response_length,
                 });
 
-                // Capture raw response BEFORE processing
-                originalResponse = veniceResponse; 
-                response = veniceResponse.replace(/<think>[\s\S]*?<\/think>\s*\n*/g, '');
-                
+                // console.warn("veniceResponse:")
+                // console.warn(veniceResponse)
+                //rferrari: remove all text from <think> to </think>\n\n
+                response = veniceResponse
+                    .replace(/<think>[\s\S]*?<\/think>\s*\n*/g, '');
+                // console.warn(response)
+
+                // response = veniceResponse;
                 elizaLogger.debug("Received response from Venice model.");
                 break;
             }
@@ -1229,7 +1196,6 @@ export async function generateText({
                 });
 
                 response = nvidiaResponse;
-                originalResponse = response; // Capture raw model output
                 elizaLogger.debug("Received response from NVIDIA model.");
                 break;
             }
@@ -1262,7 +1228,6 @@ export async function generateText({
 
                 response = deepseekResponse;
                 elizaLogger.debug("Received response from Deepseek model.");
-                originalResponse = response; // Capture raw model output
                 break;
             }
 
@@ -1315,8 +1280,10 @@ export async function generateText({
                     throw new Error("Invalid response format from Livepeer");
                 }
 
-                originalResponse = json.choices[0].message.content; // BEFORE processing
-                response = originalResponse.replace(/<\|start_header_id\|>assistant<\|end_header_id\|>\n\n/, "");
+                response = json.choices[0].message.content.replace(
+                    /<\|start_header_id\|>assistant<\|end_header_id\|>\n\n/,
+                    ""
+                );
                 elizaLogger.debug(
                     "Successfully received response from Livepeer model"
                 );
@@ -1324,27 +1291,15 @@ export async function generateText({
             }
 
             default: {
-                console.error('🚨 Unsupported provider:', provider);
-                throw new Error(`Unsupported provider: ${provider}`);
+                const errorMessage = `Unsupported provider: ${provider}`;
+                elizaLogger.error(errorMessage);
+                throw new Error(errorMessage);
             }
         }
 
-        console.log('📤 Logging response received');
-        const endTime = Date.now();
-        console.log('📤 Response received - raw:', originalResponse?.length);
-        instrument.responseReceived({
-            sessionId: runtime.sessionId,
-            agentId: runtime.agentId,
-            roomId: runtime.agentId,
-            response: originalResponse || '[EMPTY_RESPONSE]',
-            model: model,
-            latency: endTime - startTime,
-            raw_response: originalResponse || '[EMPTY_RESPONSE]',
-        });
-
-        return originalResponse;
+        return response;
     } catch (error) {
-        console.error('💥 generateText error:', error);
+        elizaLogger.error("Error in generateText:", error);
         throw error;
     }
 }
diff --git a/packages/core/src/instrumentation.ts b/packages/core/src/instrumentation.ts
index cfc72c1d8..036a1ac50 100644
--- a/packages/core/src/instrumentation.ts
+++ b/packages/core/src/instrumentation.ts
@@ -12,10 +12,6 @@ export interface InstrumentationEvent {
   event: string;
   data: Record<string, any>;
   timestamp?: number;
-  context?: string;
-  response?: string;
-  model?: string;
-  latency?: number;
 }
 
 export class Instrumentation {
@@ -65,21 +61,6 @@ export class Instrumentation {
       return;
     }
 
-    // Add these checks
-    if (event.event === 'llm_context_pre') {
-      if (!event.data.raw_context) {
-        console.error('‼️ Missing raw_context in llm_context_pre');
-        return;
-      }
-      if (event.data.raw_context.trim() === '') {
-        console.error('‼️ Empty raw_context in llm_context_pre');
-      }
-    }
-    if (event.event === 'llm_response_post' && !event.data.raw_response) {
-      console.error('‼️ Missing raw_response in llm_response_post');
-      return;
-    }
-
     const span = this.tracer.startSpan(event.event, {
       attributes: {
         // Core identifiers (only include if present)
@@ -95,10 +76,8 @@ export class Instrumentation {
         // Environment info
         'environment': process.env.NODE_ENV || 'development',
         
-        // Move spread FIRST to prevent overwrites
-        ...event.data,
-        'raw.context': event.data.raw_context,
-        'raw.response': event.data.raw_response
+        // Additional context
+        ...event.data
       },
     });
 
@@ -345,96 +324,6 @@ export class Instrumentation {
       timestamp: Date.now()
     },
   });
-
-  // Add these new event types to the Instrumentation class
-  public contextPrepared = (data: {
-    sessionId: string;
-    agentId: string;
-    roomId: string;
-    context: string;
-    model: string;
-    raw_context: string;
-  }) => {
-    if (!data.raw_context) {
-      console.warn('Missing raw_context in contextPrepared');
-    }
-    this.logEvent({
-      stage: 'Orient',
-      subStage: 'LLM Context',
-      event: 'llm_context_pre',
-      data: {
-        sessionId: data.sessionId,
-        agentId: data.agentId,
-        roomId: data.roomId,
-        context: data.context,
-        model: data.model,
-        raw_context: data.raw_context,
-        timestamp: Date.now()
-      },
-    });
-  }
-
-  public responseReceived = (data: {
-    sessionId: string;
-    agentId: string;
-    roomId: string;
-    response: string;
-    model: string;
-    latency: number;
-    raw_response: string;
-  }) => {
-    if (!data.raw_response) {
-      console.warn('Missing raw_response in responseReceived');
-    }
-    this.logEvent({
-      stage: 'Decide',
-      subStage: 'LLM Response',
-      event: 'llm_response_post',
-      data: {
-        sessionId: data.sessionId,
-        agentId: data.agentId,
-        roomId: data.roomId,
-        response: data.response,
-        model: data.model,
-        latency: data.latency,
-        raw_response: data.raw_response,
-        timestamp: Date.now()
-      },
-    });
-  }
-
-  public logLlmContext(data: {
-    sessionId: string;
-    agentId: string;
-    context: string;
-    model: string;
-  }) {
-    this.logEvent({
-      stage: 'Generation',
-      subStage: 'Context',
-      event: 'llm_context',
-      data: {
-        ...data,
-      }
-    });
-  }
-
-  public logLlmResponse(data: {
-    sessionId: string;
-    agentId: string;
-    response: string;
-    model: string;
-    latency: number;
-  }) {
-    this.logEvent({
-      stage: 'Generation', 
-      subStage: 'Response',
-      event: 'llm_response',
-      data: {
-        ...data,
-      }
-    });
-  }
 }
 
 // Export the singleton instance
diff --git a/packages/core/src/types.ts b/packages/core/src/types.ts
index 563c28869..4c5c2020d 100644
--- a/packages/core/src/types.ts
+++ b/packages/core/src/types.ts
@@ -1301,8 +1301,6 @@ export interface IAgentRuntime {
 
     verifiableInferenceAdapter?: IVerifiableInferenceAdapter | null;
 
-    sessionId: string;
-
     initialize(): Promise<void>;
 
     registerMemoryManager(manager: IMemoryManager): void;
