diff --git a/characters/c3po.character.json b/characters/c3po.character.json
index 283fd224b..b4304c288 100644
--- a/characters/c3po.character.json
+++ b/characters/c3po.character.json
@@ -1,7 +1,7 @@
 {
     "name": "C-3PO",
     "clients": [],
-    "modelProvider": "anthropic",
+    "modelProvider": "openai",
     "settings": {
         "voice": {
             "model": "en_GB-alan-medium"
diff --git a/packages/adapter-postgres/tracing-schema.sql b/packages/adapter-postgres/tracing-schema.sql
index 3c6b59ce9..e3e5c07fc 100644
--- a/packages/adapter-postgres/tracing-schema.sql
+++ b/packages/adapter-postgres/tracing-schema.sql
@@ -29,14 +29,16 @@ CREATE INDEX idx_traces_room ON traces (room_id);
 
 -- Add events table
 CREATE TABLE IF NOT EXISTS events (
-    event_id UUID PRIMARY DEFAULT gen_random_uuid(),
-    trace_id VARCHAR(256) NOT NULL REFERENCES traces(trace_id),
+    event_id UUID DEFAULT gen_random_uuid(),
+    trace_id VARCHAR(256) NOT NULL,
+    span_id VARCHAR(256) NOT NULL,
     agent_id VARCHAR(256) NOT NULL,
     event_type VARCHAR(64) NOT NULL,
     event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     event_data JSONB NOT NULL,
     room_id VARCHAR(256) NOT NULL,
-    PRIMARY KEY (event_id)
+    PRIMARY KEY (event_id),
+    FOREIGN KEY (trace_id, span_id) REFERENCES traces(trace_id, span_id)
 );
 
 -- Add indexes for common event queries
diff --git a/packages/client-direct/src/index.ts b/packages/client-direct/src/index.ts
index e72175554..dac41ee73 100644
--- a/packages/client-direct/src/index.ts
+++ b/packages/client-direct/src/index.ts
@@ -27,7 +27,7 @@ import * as fs from "fs";
 import * as path from "path";
 import { createVerifiableLogApiRouter } from "./verifiable-log-api.ts";
 import OpenAI from "openai";
-import { instrument } from "../../packages/core/src/instrumentation.ts";
+import { instrument } from "@elizaos/core";
 
 const storage = multer.diskStorage({
     destination: (req, file, cb) => {
@@ -1051,3 +1051,5 @@ export const DirectClientInterface: Client = {
 };
 
 export default DirectClientInterface;
+
+instrument.sessionStart({ foo: "bar" });
diff --git a/packages/core/package.json b/packages/core/package.json
index 8540ae4c8..3d65aa816 100644
--- a/packages/core/package.json
+++ b/packages/core/package.json
@@ -91,6 +91,7 @@
 		"langchain": "0.3.6",
 		"ollama-ai-provider": "0.16.1",
 		"openai": "4.82.0",
+		"pg": "8.13.1",
 		"pino": "^9.6.0",
 		"pino-pretty": "^13.0.0",
 		"tinyld": "1.3.4",
diff --git a/packages/core/src/dbSpanProcessor.ts b/packages/core/src/dbSpanProcessor.ts
index 811bb8873..780215aac 100644
--- a/packages/core/src/dbSpanProcessor.ts
+++ b/packages/core/src/dbSpanProcessor.ts
@@ -1,25 +1,46 @@
 // Create a connection pool for local testing using your provided credentials.
 import { Pool } from 'pg';
-import { Span, SpanProcessor } from '@opentelemetry/sdk-trace-base';
+import type { Span } from '@opentelemetry/api';
+import { SpanProcessor, ReadableSpan } from '@opentelemetry/sdk-trace-base';
 
 const pool = new Pool({
-  host: 'localhost',
-  port: 5433,
-  database: 'tracing_database',
-  user: 'trace_user',
-  password: 'trace_password',
+  host: process.env.DB_HOST || 'localhost',
+  port: Number(process.env.DB_PORT) || 5432,
+  database: process.env.DB_DATABASE || 'tracing_database',
+  user: process.env.DB_USER || 'trace_user',
+  password: process.env.DB_PASSWORD || 'trace_password',
 });
 
 // Inserts a span record into the local PostgreSQL database.
 async function insertTrace(spanData: any): Promise<void> {
   const query = `
     INSERT INTO traces (
-      trace_id, span_id, parent_span_id,
-      span_name, span_kind, start_time, end_time,
-      duration_ms, status_code, status_message, attributes,
-      events, resource
+      trace_id,
+      span_id,
+      parent_span_id,
+      trace_state,
+      span_name,
+      span_kind,
+      start_time,
+      end_time,
+      duration_ms,
+      status_code,
+      status_message,
+      attributes,
+      events,
+      links,
+      resource,
+      agent_id,
+      session_id,
+      environment,
+      room_id
+    )
+    VALUES (
+      $1, $2, $3, $4, $5,
+      $6, $7, $8, $9, $10,
+      $11, $12, $13, $14, $15,
+      $16, $17, $18, $19
     )
-    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (trace_id, span_id) DO NOTHING;
   `;
 
@@ -27,6 +48,7 @@ async function insertTrace(spanData: any): Promise<void> {
     spanData.trace_id,
     spanData.span_id,
     spanData.parent_span_id,
+    null, // trace_state (or set it as needed)
     spanData.span_name,
     spanData.span_kind,
     spanData.start_time,
@@ -36,7 +58,12 @@ async function insertTrace(spanData: any): Promise<void> {
     spanData.status_message,
     spanData.attributes,
     spanData.events,
+    null, // links (or set it as needed)
     spanData.resource,
+    null, // agent_id (if you ever want to supply it)
+    null, // session_id
+    null, // environment
+    null, // room_id
   ];
 
   try {
@@ -47,11 +74,12 @@ async function insertTrace(spanData: any): Promise<void> {
 }
 
 export class DBSpanProcessor implements SpanProcessor {
-  onStart(span: Span): void {
+  onStart(span: ReadableSpan): void {
     // No action needed at span start
+    console.log('Span started:', span.name);
   }
 
-  async onEnd(span: Span): Promise<void> {
+  async onEnd(span: ReadableSpan): Promise<void> {
     const spanContext = span.spanContext();
 
     // Convert [seconds, nanoseconds] to milliseconds.
@@ -78,8 +106,11 @@ export class DBSpanProcessor implements SpanProcessor {
       resource: JSON.stringify(span.resource?.attributes || {}),
     };
 
+    console.log('Span ended, attempting to insert:', span.name, spanData);
+
     try {
       await insertTrace(spanData);
+      console.log('Span inserted successfully:', span.name);
     } catch (error) {
       console.error('Error inserting span into DB', error);
     }
diff --git a/packages/core/src/index.ts b/packages/core/src/index.ts
index 76dea8b90..e3de1156e 100644
--- a/packages/core/src/index.ts
+++ b/packages/core/src/index.ts
@@ -1,6 +1,7 @@
 import "./config.ts"; // Add this line first
 
 export * from "./instrumentation.ts";
+export * from "./dbSpanProcessor.ts";
 export * from "./actions.ts";
 export * from "./context.ts";
 export * from "./database.ts";
@@ -25,4 +26,4 @@ export * from "./environment.ts";
 export * from "./cache.ts";
 export { default as knowledge } from "./knowledge.ts";
 export * from "./ragknowledge.ts";
-export * from "./utils.ts"; 
\ No newline at end of file
+export * from "./utils.ts";
\ No newline at end of file
diff --git a/packages/core/src/runtime.ts b/packages/core/src/runtime.ts
index 1c38b8a07..6ff8b9316 100644
--- a/packages/core/src/runtime.ts
+++ b/packages/core/src/runtime.ts
@@ -265,7 +265,7 @@ export class AgentRuntime implements IAgentRuntime {
             stringToUuid(opts.character?.name ?? uuidv4());
         this.character = opts.character || defaultCharacter;
 
-        instrument.startSession({
+        instrument.sessionStart({
             agentId: this.agentId,
             characterName: this.character.name,
             environment: process.env.NODE_ENV || 'development',
diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
index 243320242..5a221464a 100644
--- a/pnpm-lock.yaml
+++ b/pnpm-lock.yaml
@@ -44,7 +44,7 @@ importers:
         version: 1.14.40(@types/react@19.0.8)(bufferutil@4.0.9)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)(utf-8-validate@6.0.5)
       '@vitest/eslint-plugin':
         specifier: 1.0.1
-        version: 1.0.1(@typescript-eslint/utils@8.23.0(eslint@9.19.0(jiti@2.4.2))(typescript@5.6.3))(eslint@9.19.0(jiti@2.4.2))(typescript@5.6.3)(vitest@2.1.5(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+        version: 1.0.1(@typescript-eslint/utils@8.23.0(eslint@9.19.0(jiti@2.4.2))(typescript@5.6.3))(eslint@9.19.0(jiti@2.4.2))(typescript@5.6.3)(vitest@2.1.5(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       amqplib:
         specifier: 0.10.5
         version: 0.10.5
@@ -75,7 +75,7 @@ importers:
         version: 1.9.4
       '@commitlint/cli':
         specifier: 18.6.1
-        version: 18.6.1(@types/node@22.13.0)(typescript@5.6.3)
+        version: 18.6.1(@types/node@22.13.1)(typescript@5.6.3)
       '@commitlint/config-conventional':
         specifier: 18.6.3
         version: 18.6.3
@@ -93,7 +93,7 @@ importers:
         version: 9.1.7
       jest:
         specifier: ^29.7.0
-        version: 29.7.0(@types/node@22.13.0)(babel-plugin-macros@3.1.0)
+        version: 29.7.0(@types/node@22.13.1)(babel-plugin-macros@3.1.0)
       lerna:
         specifier: 8.1.5
         version: 8.1.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(babel-plugin-macros@3.1.0)(encoding@0.1.13)
@@ -114,10 +114,10 @@ importers:
         version: 2.21.58(bufferutil@4.0.9)(typescript@5.6.3)(utf-8-validate@6.0.5)(zod@3.24.1)
       vite:
         specifier: 5.4.12
-        version: 5.4.12(@types/node@22.13.0)(terser@5.37.0)
+        version: 5.4.12(@types/node@22.13.1)(terser@5.38.0)
       vitest:
         specifier: 2.1.5
-        version: 2.1.5(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 2.1.5(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   agent:
     dependencies:
@@ -565,31 +565,31 @@ importers:
         version: link:../packages/core
       '@radix-ui/react-avatar':
         specifier: ^1.1.2
-        version: 1.1.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+        version: 1.1.3(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
       '@radix-ui/react-collapsible':
         specifier: ^1.1.2
-        version: 1.1.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+        version: 1.1.3(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
       '@radix-ui/react-dialog':
         specifier: ^1.1.4
-        version: 1.1.5(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+        version: 1.1.6(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
       '@radix-ui/react-label':
         specifier: ^2.1.1
-        version: 2.1.1(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+        version: 2.1.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
       '@radix-ui/react-separator':
         specifier: ^1.1.1
-        version: 1.1.1(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+        version: 1.1.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
       '@radix-ui/react-slot':
         specifier: ^1.1.1
-        version: 1.1.1(@types/react@19.0.8)(react@19.0.0)
+        version: 1.1.2(@types/react@19.0.8)(react@19.0.0)
       '@radix-ui/react-tabs':
         specifier: ^1.1.2
-        version: 1.1.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+        version: 1.1.3(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
       '@radix-ui/react-toast':
         specifier: ^1.2.4
-        version: 1.2.5(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+        version: 1.2.6(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
       '@radix-ui/react-tooltip':
         specifier: ^1.1.6
-        version: 1.1.7(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+        version: 1.1.8(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
       '@react-spring/web':
         specifier: ^9.7.5
         version: 9.7.5(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
@@ -634,17 +634,17 @@ importers:
         version: 2.6.0
       tailwindcss-animate:
         specifier: ^1.0.7
-        version: 1.0.7(tailwindcss@3.4.17(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.6.3)))
+        version: 1.0.7(tailwindcss@3.4.17(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.6.3)))
       vite-plugin-compression:
         specifier: ^0.5.1
-        version: 0.5.1(vite@6.0.11(@types/node@22.13.0)(jiti@2.4.2)(terser@5.37.0)(tsx@4.19.2)(yaml@2.7.0))
+        version: 0.5.1(vite@6.1.0(@types/node@22.13.1)(jiti@2.4.2)(terser@5.38.0)(tsx@4.19.2)(yaml@2.7.0))
     devDependencies:
       '@eslint/js':
         specifier: ^9.17.0
         version: 9.19.0
       '@types/node':
         specifier: ^22.10.5
-        version: 22.13.0
+        version: 22.13.1
       '@types/react':
         specifier: ^19.0.3
         version: 19.0.8
@@ -662,7 +662,7 @@ importers:
         version: 8.23.0(eslint@9.19.0(jiti@2.4.2))(typescript@5.6.3)
       '@vitejs/plugin-react-swc':
         specifier: ^3.5.0
-        version: 3.7.2(@swc/helpers@0.5.15)(vite@6.0.11(@types/node@22.13.0)(jiti@2.4.2)(terser@5.37.0)(tsx@4.19.2)(yaml@2.7.0))
+        version: 3.7.2(@swc/helpers@0.5.15)(vite@6.1.0(@types/node@22.13.1)(jiti@2.4.2)(terser@5.38.0)(tsx@4.19.2)(yaml@2.7.0))
       autoprefixer:
         specifier: ^10.4.19
         version: 10.4.20(postcss@8.5.1)
@@ -695,10 +695,10 @@ importers:
         version: 8.5.1
       rollup-plugin-visualizer:
         specifier: ^5.14.0
-        version: 5.14.0(rollup@4.34.1)
+        version: 5.14.0(rollup@4.34.4)
       tailwindcss:
         specifier: ^3.4.4
-        version: 3.4.17(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.6.3))
+        version: 3.4.17(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.6.3))
       typescript:
         specifier: ~5.6.3
         version: 5.6.3
@@ -707,10 +707,10 @@ importers:
         version: 8.23.0(eslint@9.19.0(jiti@2.4.2))(typescript@5.6.3)
       vite:
         specifier: ^6.0.5
-        version: 6.0.11(@types/node@22.13.0)(jiti@2.4.2)(terser@5.37.0)(tsx@4.19.2)(yaml@2.7.0)
+        version: 6.1.0(@types/node@22.13.1)(jiti@2.4.2)(terser@5.38.0)(tsx@4.19.2)(yaml@2.7.0)
       vite-tsconfig-paths:
         specifier: ^5.1.4
-        version: 5.1.4(typescript@5.6.3)(vite@6.0.11(@types/node@22.13.0)(jiti@2.4.2)(terser@5.37.0)(tsx@4.19.2)(yaml@2.7.0))
+        version: 5.1.4(typescript@5.6.3)(vite@6.1.0(@types/node@22.13.1)(jiti@2.4.2)(terser@5.38.0)(tsx@4.19.2)(yaml@2.7.0))
 
   docs:
     dependencies:
@@ -728,7 +728,7 @@ importers:
         version: 3.7.0(@mdx-js/react@3.0.1(@types/react@19.0.8)(react@18.3.1))(@swc/core@1.10.14(@swc/helpers@0.5.15))(acorn@8.14.0)(bufferutil@4.0.9)(eslint@9.19.0(jiti@2.4.2))(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@docusaurus/preset-classic':
         specifier: 3.7.0
-        version: 3.7.0(@algolia/client-search@5.20.0)(@mdx-js/react@3.0.1(@types/react@19.0.8)(react@18.3.1))(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/react@19.0.8)(acorn@8.14.0)(bufferutil@4.0.9)(eslint@9.19.0(jiti@2.4.2))(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(search-insights@2.17.3)(typescript@5.7.3)(utf-8-validate@5.0.10)
+        version: 3.7.0(@algolia/client-search@5.20.1)(@mdx-js/react@3.0.1(@types/react@19.0.8)(react@18.3.1))(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/react@19.0.8)(acorn@8.14.0)(bufferutil@4.0.9)(eslint@9.19.0(jiti@2.4.2))(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(search-insights@2.17.3)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@docusaurus/theme-common':
         specifier: 3.7.0
         version: 3.7.0(@docusaurus/plugin-content-docs@3.7.0(@mdx-js/react@3.0.1(@types/react@19.0.8)(react@18.3.1))(@swc/core@1.10.14(@swc/helpers@0.5.15))(acorn@8.14.0)(bufferutil@4.0.9)(eslint@9.19.0(jiti@2.4.2))(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(typescript@5.7.3)(utf-8-validate@5.0.10))(@swc/core@1.10.14(@swc/helpers@0.5.15))(acorn@8.14.0)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
@@ -878,7 +878,7 @@ importers:
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: ^3.0.2
-        version: 3.0.2(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 3.0.2(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/adapter-sqlite:
     dependencies:
@@ -900,13 +900,13 @@ importers:
     devDependencies:
       '@vitest/coverage-v8':
         specifier: ^3.0.2
-        version: 3.0.5(vitest@3.0.2(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+        version: 3.0.5(vitest@3.0.2(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       tsup:
         specifier: 8.3.5
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: ^3.0.2
-        version: 3.0.2(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 3.0.2(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/adapter-sqljs:
     dependencies:
@@ -944,13 +944,13 @@ importers:
     devDependencies:
       '@vitest/coverage-v8':
         specifier: ^3.0.2
-        version: 3.0.5(vitest@3.0.2(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+        version: 3.0.5(vitest@3.0.2(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       tsup:
         specifier: 8.3.5
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: ^3.0.2
-        version: 3.0.2(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 3.0.2(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/client-alexa:
     dependencies:
@@ -975,7 +975,7 @@ importers:
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: 1.2.1
-        version: 1.2.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 1.2.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/client-auto:
     dependencies:
@@ -1046,19 +1046,19 @@ importers:
         version: 29.5.14
       '@types/node':
         specifier: ^18.15.11
-        version: 18.19.74
+        version: 18.19.75
       jest:
         specifier: ^29.5.0
-        version: 29.7.0(@types/node@18.19.74)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.74)(typescript@5.7.3))
+        version: 29.7.0(@types/node@18.19.75)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.75)(typescript@5.7.3))
       rimraf:
         specifier: ^5.0.0
         version: 5.0.10
       ts-jest:
         specifier: ^29.1.0
-        version: 29.2.5(@babel/core@7.26.7)(@jest/transform@29.7.0)(@jest/types@29.6.3)(babel-jest@29.7.0(@babel/core@7.26.7))(jest@29.7.0(@types/node@18.19.74)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.74)(typescript@5.7.3)))(typescript@5.7.3)
+        version: 29.2.5(@babel/core@7.26.7)(@jest/transform@29.7.0)(@jest/types@29.6.3)(babel-jest@29.7.0(@babel/core@7.26.7))(jest@29.7.0(@types/node@18.19.75)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.75)(typescript@5.7.3)))(typescript@5.7.3)
       ts-node:
         specifier: ^10.9.1
-        version: 10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.74)(typescript@5.7.3)
+        version: 10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.75)(typescript@5.7.3)
       tsup:
         specifier: ^8.3.5
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
@@ -1181,7 +1181,7 @@ importers:
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: 1.2.1
-        version: 1.2.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 1.2.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/client-eliza-home:
     dependencies:
@@ -1191,13 +1191,13 @@ importers:
     devDependencies:
       '@vitest/coverage-v8':
         specifier: ^1.2.1
-        version: 1.6.1(vitest@1.6.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+        version: 1.6.1(vitest@1.6.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       tsup:
         specifier: 8.3.5
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: ^1.2.1
-        version: 1.6.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 1.6.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/client-farcaster:
     dependencies:
@@ -1206,14 +1206,14 @@ importers:
         version: link:../core
       '@neynar/nodejs-sdk':
         specifier: ^2.0.3
-        version: 2.9.0(bufferutil@4.0.9)(class-transformer@0.5.1)(encoding@0.1.13)(typescript@5.7.3)(utf-8-validate@6.0.5)(zod@3.24.1)
+        version: 2.10.0(bufferutil@4.0.9)(class-transformer@0.5.1)(encoding@0.1.13)(typescript@5.7.3)(utf-8-validate@6.0.5)(zod@3.24.1)
     devDependencies:
       tsup:
         specifier: ^8.3.5
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: ^2.1.5
-        version: 2.1.8(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 2.1.8(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/client-github:
     dependencies:
@@ -1244,7 +1244,7 @@ importers:
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: ^1.2.1
-        version: 1.6.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 1.6.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/client-instagram:
     dependencies:
@@ -1272,7 +1272,7 @@ importers:
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: ^1.2.1
-        version: 1.6.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 1.6.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/client-lens:
     dependencies:
@@ -1291,13 +1291,13 @@ importers:
     devDependencies:
       '@vitest/coverage-v8':
         specifier: ^1.2.1
-        version: 1.6.1(vitest@1.6.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+        version: 1.6.1(vitest@1.6.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       tsup:
         specifier: ^8.3.5
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: ^1.2.1
-        version: 1.6.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 1.6.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/client-simsai:
     dependencies:
@@ -1353,19 +1353,19 @@ importers:
         version: 2.1.27
       '@types/node':
         specifier: ^18.15.11
-        version: 18.19.74
+        version: 18.19.75
       rimraf:
         specifier: ^5.0.0
         version: 5.0.10
       tsup:
         specifier: ^6.7.0
-        version: 6.7.0(@swc/core@1.10.14(@swc/helpers@0.5.15))(postcss@8.5.1)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.74)(typescript@5.7.3))(typescript@5.7.3)
+        version: 6.7.0(@swc/core@1.10.14(@swc/helpers@0.5.15))(postcss@8.5.1)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.75)(typescript@5.7.3))(typescript@5.7.3)
       typescript:
         specifier: ^5.0.3
         version: 5.7.3
       vitest:
         specifier: ^1.2.1
-        version: 1.6.1(@types/node@18.19.74)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 1.6.1(@types/node@18.19.75)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/client-telegram:
     dependencies:
@@ -1387,7 +1387,7 @@ importers:
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: 1.2.1
-        version: 1.2.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 1.2.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/client-telegram-account:
     dependencies:
@@ -1409,13 +1409,13 @@ importers:
     devDependencies:
       '@vitest/coverage-v8':
         specifier: 1.1.3
-        version: 1.1.3(vitest@1.1.3(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+        version: 1.1.3(vitest@1.1.3(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       tsup:
         specifier: 8.3.5
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: 1.1.3
-        version: 1.1.3(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 1.1.3(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/client-twitter:
     dependencies:
@@ -1440,13 +1440,13 @@ importers:
     devDependencies:
       '@vitest/coverage-v8':
         specifier: 1.1.3
-        version: 1.1.3(vitest@1.1.3(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+        version: 1.1.3(vitest@1.1.3(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       tsup:
         specifier: 8.3.5
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: 1.1.3
-        version: 1.1.3(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 1.1.3(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/client-xmtp:
     dependencies:
@@ -1487,6 +1487,24 @@ importers:
       '@fal-ai/client':
         specifier: 1.2.0
         version: 1.2.0
+      '@opentelemetry/api':
+        specifier: ^1.9.0
+        version: 1.9.0
+      '@opentelemetry/exporter-trace-otlp-http':
+        specifier: ^0.57.1
+        version: 0.57.1(@opentelemetry/api@1.9.0)
+      '@opentelemetry/resources':
+        specifier: ^1.30.1
+        version: 1.30.1(@opentelemetry/api@1.9.0)
+      '@opentelemetry/sdk-trace-base':
+        specifier: ^1.30.1
+        version: 1.30.1(@opentelemetry/api@1.9.0)
+      '@opentelemetry/sdk-trace-node':
+        specifier: ^1.30.1
+        version: 1.30.1(@opentelemetry/api@1.9.0)
+      '@opentelemetry/semantic-conventions':
+        specifier: ^1.28.0
+        version: 1.28.0
       '@tavily/core':
         specifier: ^0.0.2
         version: 0.0.2
@@ -1525,13 +1543,16 @@ importers:
         version: 1.0.15
       langchain:
         specifier: 0.3.6
-        version: 0.3.6(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)))(@langchain/groq@0.1.3(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)))(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10)))(axios@1.7.9)(encoding@0.1.13)(handlebars@4.7.8)(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8))(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))
+        version: 0.3.6(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)))(@langchain/groq@0.1.3(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)))(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10)))(axios@1.7.9)(encoding@0.1.13)(handlebars@4.7.8)(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8))(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))
       ollama-ai-provider:
         specifier: 0.16.1
         version: 0.16.1(zod@3.23.8)
       openai:
         specifier: 4.82.0
         version: 4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)
+      pg:
+        specifier: 8.13.1
+        version: 8.13.1
       pino:
         specifier: ^9.6.0
         version: 9.6.0
@@ -1607,7 +1628,7 @@ importers:
         version: 8.16.0(eslint@9.19.0(jiti@2.4.2))(typescript@5.6.3)
       '@vitest/coverage-v8':
         specifier: 2.1.5
-        version: 2.1.5(vitest@3.0.2(@types/node@22.8.4)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.37.0))
+        version: 2.1.5(vitest@3.0.2(@types/node@22.8.4)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.38.0))
       jest:
         specifier: 29.7.0
         version: 29.7.0(@types/node@22.8.4)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.8.4)(typescript@5.6.3))
@@ -1681,13 +1702,13 @@ importers:
         version: 1.5.3
       vitest:
         specifier: ^1.2.1
-        version: 1.6.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 1.6.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/plugin-0x:
     dependencies:
       '@0x/swap-ts-sdk':
         specifier: 2.1.1
-        version: 2.1.1(@types/express@5.0.0)(@types/node@22.13.0)(encoding@0.1.13)
+        version: 2.1.1(@types/express@5.0.0)(@types/node@22.13.1)(encoding@0.1.13)
       '@elizaos/core':
         specifier: workspace:*
         version: link:../core
@@ -1706,7 +1727,7 @@ importers:
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: ^2.1.5
-        version: 2.1.8(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 2.1.8(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/plugin-3d-generation:
     dependencies:
@@ -1725,7 +1746,7 @@ importers:
         version: 1.5.3
       vitest:
         specifier: ^2.1.5
-        version: 2.1.8(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 2.1.8(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/plugin-abstract:
     dependencies:
@@ -1753,7 +1774,7 @@ importers:
         version: 4.9.5
       vitest:
         specifier: ^1.0.0
-        version: 1.6.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 1.6.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/plugin-agentkit:
     dependencies:
@@ -1768,7 +1789,7 @@ importers:
         version: link:../core
       '@langchain/core':
         specifier: ^0.3.27
-        version: 0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))(zod@3.23.8))
+        version: 0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))(zod@3.23.8))
       tsup:
         specifier: 8.3.5
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
@@ -1778,16 +1799,16 @@ importers:
         version: 1.9.4
       vitest:
         specifier: ^1.0.0
-        version: 1.6.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 1.6.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/plugin-akash:
     dependencies:
       '@akashnetwork/akash-api':
         specifier: ^1.4.0
-        version: 1.4.0(@grpc/grpc-js@1.12.5)
+        version: 1.4.0(@grpc/grpc-js@1.12.6)
       '@akashnetwork/akashjs':
         specifier: 0.10.1
-        version: 0.10.1(@grpc/grpc-js@1.12.5)(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
+        version: 0.10.1(@grpc/grpc-js@1.12.6)(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
       '@cosmjs/proto-signing':
         specifier: ^0.31.3
         version: 0.31.3
@@ -1851,13 +1872,13 @@ importers:
         version: 5.7.3
       vite:
         specifier: ^5.0.10
-        version: 5.4.12(@types/node@20.17.9)(terser@5.37.0)
+        version: 5.4.12(@types/node@20.17.9)(terser@5.38.0)
       vite-tsconfig-paths:
         specifier: ^4.2.2
-        version: 4.3.2(typescript@5.7.3)(vite@5.4.12(@types/node@20.17.9)(terser@5.37.0))
+        version: 4.3.2(typescript@5.7.3)(vite@5.4.12(@types/node@20.17.9)(terser@5.38.0))
       vitest:
         specifier: ^0.34.6
-        version: 0.34.6(@vitest/ui@0.34.7)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(playwright@1.48.2)(terser@5.37.0)
+        version: 0.34.6(@vitest/ui@0.34.7)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(playwright@1.48.2)(terser@5.38.0)
 
   packages/plugin-allora:
     dependencies:
@@ -1872,7 +1893,7 @@ importers:
         version: 5.1.2
       vitest:
         specifier: 2.1.8
-        version: 2.1.8(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 2.1.8(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
       whatwg-url:
         specifier: 7.1.0
         version: 7.1.0
@@ -1955,13 +1976,13 @@ importers:
         version: 5.7.3
       vite:
         specifier: ^5.0.10
-        version: 5.4.12(@types/node@20.17.9)(terser@5.37.0)
+        version: 5.4.12(@types/node@20.17.9)(terser@5.38.0)
       vite-tsconfig-paths:
         specifier: ^4.2.2
-        version: 4.3.2(typescript@5.7.3)(vite@5.4.12(@types/node@20.17.9)(terser@5.37.0))
+        version: 4.3.2(typescript@5.7.3)(vite@5.4.12(@types/node@20.17.9)(terser@5.38.0))
       vitest:
         specifier: ^1.2.1
-        version: 1.6.1(@types/node@20.17.9)(@vitest/ui@0.34.7)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 1.6.1(@types/node@20.17.9)(@vitest/ui@0.34.7)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/plugin-anyone:
     dependencies:
@@ -1986,10 +2007,10 @@ importers:
         version: 1.9.4
       '@vitest/coverage-v8':
         specifier: ^1.2.1
-        version: 1.6.1(vitest@1.6.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+        version: 1.6.1(vitest@1.6.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       vitest:
         specifier: ^1.2.1
-        version: 1.6.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 1.6.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/plugin-apro:
     dependencies:
@@ -2017,7 +2038,7 @@ importers:
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: 2.1.4
-        version: 2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.37.0)
+        version: 2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.38.0)
 
   packages/plugin-aptos:
     dependencies:
@@ -2041,7 +2062,7 @@ importers:
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: 2.1.4
-        version: 2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
       whatwg-url:
         specifier: 7.1.0
         version: 7.1.0
@@ -2106,13 +2127,13 @@ importers:
         version: 4.17.15
       '@types/node':
         specifier: ^22.10.9
-        version: 22.13.0
+        version: 22.13.1
       '@types/ws':
         specifier: ^8.5.13
         version: 8.5.14
       '@vitest/coverage-v8':
         specifier: ^2.1.4
-        version: 2.1.9(vitest@2.1.8(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.37.0))
+        version: 2.1.9(vitest@2.1.8(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.38.0))
       rimraf:
         specifier: ^5.0.5
         version: 5.0.10
@@ -2124,7 +2145,7 @@ importers:
         version: 5.7.3
       vitest:
         specifier: ^2.1.4
-        version: 2.1.8(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.37.0)
+        version: 2.1.8(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.38.0)
 
   packages/plugin-arthera:
     dependencies:
@@ -2192,7 +2213,7 @@ importers:
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: ^1.2.1
-        version: 1.6.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 1.6.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/plugin-autonome:
     dependencies:
@@ -2245,13 +2266,13 @@ importers:
         version: 20.17.9
       '@vitest/coverage-v8':
         specifier: ^2.1.8
-        version: 2.1.9(vitest@2.1.8(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+        version: 2.1.9(vitest@2.1.8(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       tsup:
         specifier: 8.3.5
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: ^2.1.8
-        version: 2.1.8(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 2.1.8(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/plugin-avalanche:
     dependencies:
@@ -2270,7 +2291,7 @@ importers:
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: ^2.1.5
-        version: 2.1.8(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 2.1.8(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/plugin-b2:
     dependencies:
@@ -2308,10 +2329,10 @@ importers:
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vite-tsconfig-paths:
         specifier: ^5.1.4
-        version: 5.1.4(typescript@5.7.3)(vite@6.0.11(@types/node@20.17.9)(jiti@2.4.2)(terser@5.37.0)(tsx@4.19.2)(yaml@2.7.0))
+        version: 5.1.4(typescript@5.7.3)(vite@6.1.0(@types/node@20.17.9)(jiti@2.4.2)(terser@5.38.0)(tsx@4.19.2)(yaml@2.7.0))
       vitest:
         specifier: ^3.0.2
-        version: 3.0.2(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 3.0.2(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/plugin-birdeye:
     dependencies:
@@ -2347,13 +2368,13 @@ importers:
         version: 5.1.2
       pumpdotfun-sdk:
         specifier: 1.3.2
-        version: 1.3.2(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(rollup@4.34.1)(typescript@5.7.3)(utf-8-validate@5.0.10)
+        version: 1.3.2(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(rollup@4.34.4)(typescript@5.7.3)(utf-8-validate@5.0.10)
       tsup:
         specifier: 8.3.5
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: 2.1.4
-        version: 2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.37.0)
+        version: 2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.38.0)
       whatwg-url:
         specifier: 7.1.0
         version: 7.1.0
@@ -2363,10 +2384,10 @@ importers:
         version: 1.5.3
       '@types/node':
         specifier: ^22.10.2
-        version: 22.13.0
+        version: 22.13.1
       ts-node:
         specifier: ^10.9.2
-        version: 10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.7.3)
+        version: 10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.7.3)
       tsconfig-paths:
         specifier: ^4.2.0
         version: 4.2.0
@@ -2412,7 +2433,7 @@ importers:
         version: 5.2.0
       '@types/node':
         specifier: ^22.10.5
-        version: 22.13.0
+        version: 22.13.1
       '@web3-name-sdk/core':
         specifier: ^0.3.2
         version: 0.3.2(@bonfida/spl-name-service@3.0.8(bufferutil@4.0.9)(encoding@0.1.13)(typescript@5.7.3)(utf-8-validate@5.0.10))(@sei-js/core@3.2.1(bufferutil@4.0.9)(utf-8-validate@5.0.10))(@siddomains/injective-sidjs@0.0.2-beta(@injectivelabs/sdk-ts@1.14.40(@types/react@19.0.8)(bufferutil@4.0.9)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)(utf-8-validate@5.0.10))(@injectivelabs/ts-types@1.14.40))(@siddomains/sei-sidjs@0.0.4(@sei-js/core@3.2.1(bufferutil@4.0.9)(utf-8-validate@5.0.10)))(viem@2.21.58(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)(zod@3.24.1))
@@ -2459,7 +2480,7 @@ importers:
         version: 1.9.4
       vitest:
         specifier: ^2.1.5
-        version: 2.1.8(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 2.1.8(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/plugin-coinbase:
     dependencies:
@@ -2496,7 +2517,7 @@ importers:
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: ^1.0.0
-        version: 1.6.1(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.37.0)
+        version: 1.6.1(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.38.0)
 
   packages/plugin-coingecko:
     dependencies:
@@ -2515,10 +2536,10 @@ importers:
         version: 1.9.4
       '@vitest/coverage-v8':
         specifier: ^1.2.2
-        version: 1.6.1(vitest@1.6.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+        version: 1.6.1(vitest@1.6.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       vitest:
         specifier: ^1.2.2
-        version: 1.6.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 1.6.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/plugin-coinmarketcap:
     dependencies:
@@ -2556,7 +2577,7 @@ importers:
     dependencies:
       '@chain-registry/utils':
         specifier: ^1.51.41
-        version: 1.51.62
+        version: 1.51.65
       '@cosmjs/cosmwasm-stargate':
         specifier: ^0.32.4
         version: 0.32.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
@@ -2580,7 +2601,7 @@ importers:
         version: 9.1.2
       chain-registry:
         specifier: ^1.69.68
-        version: 1.69.113
+        version: 1.69.116
       interchain:
         specifier: ^1.10.4
         version: 1.10.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
@@ -2596,7 +2617,7 @@ importers:
         version: 1.9.4
       '@chain-registry/types':
         specifier: ^0.50.44
-        version: 0.50.62
+        version: 0.50.65
 
   packages/plugin-cronos:
     dependencies:
@@ -2716,7 +2737,7 @@ importers:
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: ^1.0.0
-        version: 1.6.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 1.6.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/plugin-dexscreener:
     dependencies:
@@ -2766,7 +2787,7 @@ importers:
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: 2.1.4
-        version: 2.1.4(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 2.1.4(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/plugin-dkg:
     dependencies:
@@ -2775,7 +2796,7 @@ importers:
         version: link:../core
       dkg.js:
         specifier: ^8.0.4
-        version: 8.0.4(@nomicfoundation/hardhat-ethers@3.0.8(ethers@5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10))(hardhat@2.22.18(bufferutil@4.0.9)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.7.3))(typescript@5.7.3)(utf-8-validate@5.0.10)))(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)(web-streams-polyfill@3.3.3)
+        version: 8.0.4(@nomicfoundation/hardhat-ethers@3.0.8(ethers@5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10))(hardhat@2.22.18(bufferutil@4.0.9)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.7.3))(typescript@5.7.3)(utf-8-validate@5.0.10)))(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)(web-streams-polyfill@3.3.3)
       tsup:
         specifier: 8.3.5
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@4.9.5)(yaml@2.7.0)
@@ -2896,7 +2917,7 @@ importers:
         version: 5.7.3
       vitest:
         specifier: ^2.1.8
-        version: 2.1.8(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 2.1.8(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/plugin-ethstorage:
     dependencies:
@@ -3004,7 +3025,7 @@ importers:
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: 2.1.4
-        version: 2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/plugin-football:
     dependencies:
@@ -3051,13 +3072,13 @@ importers:
         version: 4.0.1
       fuels:
         specifier: 0.97.2
-        version: 0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+        version: 0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       tsup:
         specifier: 8.3.5
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: 2.1.4
-        version: 2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
       whatwg-url:
         specifier: 7.1.0
         version: 7.1.0
@@ -3187,7 +3208,7 @@ importers:
         version: 5.2.1(@types/eslint@9.6.1)(eslint-config-prettier@9.1.0(eslint@9.13.0(jiti@2.4.2)))(eslint@9.13.0(jiti@2.4.2))(prettier@3.4.1)
       eslint-plugin-vitest:
         specifier: 0.5.4
-        version: 0.5.4(eslint@9.13.0(jiti@2.4.2))(typescript@5.7.3)(vitest@3.0.2(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+        version: 0.5.4(eslint@9.13.0(jiti@2.4.2))(typescript@5.7.3)(vitest@3.0.2(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       tsup:
         specifier: 8.3.5
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
@@ -3265,7 +3286,7 @@ importers:
     devDependencies:
       ts-node:
         specifier: ^10.9.2
-        version: 10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.7.3)
+        version: 10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.7.3)
 
   packages/plugin-hyperbolic:
     dependencies:
@@ -3338,13 +3359,13 @@ importers:
         version: 5.7.3
       vite:
         specifier: ^5.0.10
-        version: 5.4.12(@types/node@20.17.9)(terser@5.37.0)
+        version: 5.4.12(@types/node@20.17.9)(terser@5.38.0)
       vite-tsconfig-paths:
         specifier: ^4.2.2
-        version: 4.3.2(typescript@5.7.3)(vite@5.4.12(@types/node@20.17.9)(terser@5.37.0))
+        version: 4.3.2(typescript@5.7.3)(vite@5.4.12(@types/node@20.17.9)(terser@5.38.0))
       vitest:
         specifier: ^1.2.1
-        version: 1.6.1(@types/node@20.17.9)(@vitest/ui@0.34.7)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 1.6.1(@types/node@20.17.9)(@vitest/ui@0.34.7)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/plugin-hyperliquid:
     dependencies:
@@ -3388,7 +3409,7 @@ importers:
         version: 29.5.14
       jest:
         specifier: 29.7.0
-        version: 29.7.0(@types/node@22.13.0)(babel-plugin-macros@3.1.0)
+        version: 29.7.0(@types/node@22.13.1)(babel-plugin-macros@3.1.0)
       tsup:
         specifier: 8.3.5
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.6.3)(yaml@2.7.0)
@@ -3437,13 +3458,13 @@ importers:
     devDependencies:
       '@types/node':
         specifier: ^22.10.1
-        version: 22.13.0
+        version: 22.13.1
 
   packages/plugin-injective:
     dependencies:
       '@elizaos/adapter-sqlite':
         specifier: 0.1.7-alpha.2
-        version: 0.1.7-alpha.2(@google-cloud/vertexai@1.9.3(encoding@0.1.13))(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(@langchain/groq@0.1.3(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5)))(axios@1.7.9)(encoding@0.1.13)(react@19.0.0)(sswr@2.1.0(svelte@5.19.7))(svelte@5.19.7)(whatwg-url@14.1.0)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))
+        version: 0.1.7-alpha.2(@google-cloud/vertexai@1.9.3(encoding@0.1.13))(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(@langchain/groq@0.1.3(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5)))(axios@1.7.9)(encoding@0.1.13)(react@19.0.0)(sswr@2.1.0(svelte@5.19.8))(svelte@5.19.8)(whatwg-url@14.1.0)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))
       '@elizaos/core':
         specifier: workspace:*
         version: link:../core
@@ -3459,7 +3480,7 @@ importers:
         version: 29.5.14
       '@types/node':
         specifier: ^22.10.3
-        version: 22.13.0
+        version: 22.13.1
       '@types/sinon':
         specifier: ^17.0.3
         version: 17.0.3
@@ -3477,7 +3498,7 @@ importers:
         version: 9.16.0(jiti@2.4.2)
       jest:
         specifier: ^29.7.0
-        version: 29.7.0(@types/node@22.13.0)(babel-plugin-macros@3.1.0)
+        version: 29.7.0(@types/node@22.13.1)(babel-plugin-macros@3.1.0)
       prettier:
         specifier: 3.4.1
         version: 3.4.1
@@ -3486,7 +3507,7 @@ importers:
         version: 19.0.2
       ts-jest:
         specifier: ^29.2.5
-        version: 29.2.5(@babel/core@7.26.7)(@jest/transform@29.7.0)(@jest/types@29.6.3)(babel-jest@29.7.0(@babel/core@7.26.7))(jest@29.7.0(@types/node@22.13.0)(babel-plugin-macros@3.1.0))(typescript@5.7.3)
+        version: 29.2.5(@babel/core@7.26.7)(@jest/transform@29.7.0)(@jest/types@29.6.3)(babel-jest@29.7.0(@babel/core@7.26.7))(jest@29.7.0(@types/node@22.13.1)(babel-plugin-macros@3.1.0))(typescript@5.7.3)
       typescript:
         specifier: ^5.7.2
         version: 5.7.3
@@ -3624,34 +3645,34 @@ importers:
         version: 16.3.0
       '@lit-protocol/auth-helpers':
         specifier: ^7.0.4
-        version: 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+        version: 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/aw-tool':
         specifier: '*'
-        version: 0.1.0-17(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+        version: 0.1.0-19(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/constants':
         specifier: ^7.0.4
-        version: 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+        version: 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/contracts-sdk':
         specifier: ^7.0.2
-        version: 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+        version: 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/lit-auth-client':
         specifier: ^7.0.2
-        version: 7.0.4(@walletconnect/modal@2.6.1(react@19.0.0))(bufferutil@4.0.9)(encoding@0.1.13)(ioredis@5.4.2)(typescript@5.7.3)(utf-8-validate@5.0.10)
+        version: 7.0.5(@walletconnect/modal@2.6.1(react@19.0.0))(bufferutil@4.0.9)(encoding@0.1.13)(ioredis@5.4.2)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/lit-node-client':
         specifier: ^7.0.4
-        version: 7.0.4(@walletconnect/modal@2.6.1(react@19.0.0))(bufferutil@4.0.9)(encoding@0.1.13)(ioredis@5.4.2)(typescript@5.7.3)(utf-8-validate@5.0.10)
+        version: 7.0.5(@walletconnect/modal@2.6.1(react@19.0.0))(bufferutil@4.0.9)(encoding@0.1.13)(ioredis@5.4.2)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/pkp-client':
         specifier: 6.11.3
         version: 6.11.3(bufferutil@4.0.9)(encoding@0.1.13)(ioredis@5.4.2)(react@19.0.0)(typescript@5.7.3)(utf-8-validate@5.0.10)(web-vitals@3.5.2)
       '@lit-protocol/pkp-ethers':
         specifier: ^7.0.2
-        version: 7.0.4(@walletconnect/modal@2.6.1(react@19.0.0))(bufferutil@4.0.9)(encoding@0.1.13)(ioredis@5.4.2)(typescript@5.7.3)(utf-8-validate@5.0.10)
+        version: 7.0.5(@walletconnect/modal@2.6.1(react@19.0.0))(bufferutil@4.0.9)(encoding@0.1.13)(ioredis@5.4.2)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/types':
         specifier: ^6.11.3
         version: 6.11.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
       '@lit-protocol/wrapped-keys':
         specifier: ^7.0.2
-        version: 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+        version: 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@solana/web3.js':
         specifier: npm:@solana/web3.js@1.95.8
         version: 1.95.8(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
@@ -3715,7 +3736,7 @@ importers:
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: 3.0.2
-        version: 3.0.2(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 3.0.2(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
       whatwg-url:
         specifier: 7.1.0
         version: 7.1.0
@@ -3779,7 +3800,7 @@ importers:
         version: 5.7.3
       vitest:
         specifier: 2.1.4
-        version: 2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/plugin-multiversx:
     dependencies:
@@ -3812,7 +3833,7 @@ importers:
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: 2.1.5
-        version: 2.1.5(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 2.1.5(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
       whatwg-url:
         specifier: 7.1.0
         version: 7.1.0
@@ -3894,7 +3915,7 @@ importers:
         version: 5.7.3
       vitest:
         specifier: ^2.1.5
-        version: 2.1.8(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 2.1.8(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/plugin-nft-generation:
     dependencies:
@@ -4181,7 +4202,7 @@ importers:
         version: 5.7.3
       vitest:
         specifier: ^1.2.0
-        version: 1.6.1(@types/node@20.17.9)(@vitest/ui@0.34.7)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 1.6.1(@types/node@20.17.9)(@vitest/ui@0.34.7)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/plugin-obsidian:
     dependencies:
@@ -4244,7 +4265,7 @@ importers:
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: 2.1.4
-        version: 2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.37.0)
+        version: 2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.38.0)
       whatwg-url:
         specifier: 7.1.0
         version: 7.1.0
@@ -4291,7 +4312,7 @@ importers:
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: ^1.0.0
-        version: 1.6.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 1.6.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/plugin-primus:
     dependencies:
@@ -4312,7 +4333,7 @@ importers:
     dependencies:
       '@elizaos/core':
         specifier: ^0.1.7
-        version: 0.1.9(@google-cloud/vertexai@1.9.3(encoding@0.1.13))(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(@langchain/groq@0.1.3(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10)))(axios@1.7.9)(encoding@0.1.13)(react@19.0.0)(sswr@2.1.0(svelte@5.19.7))(svelte@5.19.7)(vue@3.5.13(typescript@5.7.3))(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
+        version: 0.1.9(@google-cloud/vertexai@1.9.3(encoding@0.1.13))(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(@langchain/groq@0.1.3(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10)))(axios@1.7.9)(encoding@0.1.13)(react@19.0.0)(sswr@2.1.0(svelte@5.19.8))(svelte@5.19.8)(vue@3.5.13(typescript@5.7.3))(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
       '@pythnetwork/client':
         specifier: ^2.22.0
         version: 2.22.0(@solana/web3.js@1.95.8(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
@@ -4379,7 +4400,7 @@ importers:
         version: 5.7.3
       vitest:
         specifier: ^1.0.0
-        version: 1.6.1(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.37.0)
+        version: 1.6.1(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.38.0)
 
   packages/plugin-quai:
     dependencies:
@@ -4400,7 +4421,7 @@ importers:
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: ^2.1.4
-        version: 2.1.8(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 2.1.8(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
       whatwg-url:
         specifier: 7.1.0
         version: 7.1.0
@@ -4467,10 +4488,10 @@ importers:
     devDependencies:
       '@vitest/coverage-v8':
         specifier: ^1.2.1
-        version: 1.6.1(vitest@1.6.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.37.0))
+        version: 1.6.1(vitest@1.6.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.38.0))
       vitest:
         specifier: ^1.2.1
-        version: 1.6.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.37.0)
+        version: 1.6.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.38.0)
 
   packages/plugin-router-nitro:
     dependencies:
@@ -4506,7 +4527,7 @@ importers:
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: 2.1.4
-        version: 2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
       whatwg-url:
         specifier: 7.1.0
         version: 7.1.0
@@ -4564,7 +4585,7 @@ importers:
         version: 5.1.2
       pumpdotfun-sdk:
         specifier: 1.3.2
-        version: 1.3.2(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(rollup@4.34.1)(typescript@5.6.3)(utf-8-validate@5.0.10)
+        version: 1.3.2(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(rollup@4.34.4)(typescript@5.6.3)(utf-8-validate@5.0.10)
       solana-agent-kit:
         specifier: ^1.4.0
         version: 1.4.4(@noble/hashes@1.7.1)(@solana/buffer-layout@4.0.1)(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@20.17.9)(arweave@1.15.5)(axios@1.7.9)(borsh@2.0.0)(buffer@6.0.3)(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(handlebars@4.7.8)(react@19.0.0)(sodium-native@3.4.1)(typescript@5.6.3)(utf-8-validate@5.0.10)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
@@ -4573,7 +4594,7 @@ importers:
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.6.3)(yaml@2.7.0)
       vitest:
         specifier: 2.1.4
-        version: 2.1.4(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.37.0)
+        version: 2.1.4(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.38.0)
       whatwg-url:
         specifier: 7.1.0
         version: 7.1.0
@@ -4622,16 +4643,16 @@ importers:
         version: 5.1.2
       pumpdotfun-sdk:
         specifier: 1.3.2
-        version: 1.3.2(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(rollup@4.34.1)(typescript@5.7.3)(utf-8-validate@5.0.10)
+        version: 1.3.2(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(rollup@4.34.4)(typescript@5.7.3)(utf-8-validate@5.0.10)
       solana-agent-kit:
         specifier: ^1.2.0
-        version: 1.4.4(@noble/hashes@1.7.1)(@solana/buffer-layout@4.0.1)(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(arweave@1.15.5)(axios@1.7.9)(borsh@2.0.0)(buffer@6.0.3)(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(handlebars@4.7.8)(react@19.0.0)(sodium-native@3.4.1)(typescript@5.7.3)(utf-8-validate@5.0.10)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
+        version: 1.4.4(@noble/hashes@1.7.1)(@solana/buffer-layout@4.0.1)(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(arweave@1.15.5)(axios@1.7.9)(borsh@2.0.0)(buffer@6.0.3)(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(handlebars@4.7.8)(react@19.0.0)(sodium-native@3.4.1)(typescript@5.7.3)(utf-8-validate@5.0.10)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
       tsup:
         specifier: 8.3.5
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: 2.1.4
-        version: 2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.37.0)
+        version: 2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.38.0)
       whatwg-url:
         specifier: 7.1.0
         version: 7.1.0
@@ -4684,13 +4705,13 @@ importers:
         version: 1.5.3
       '@types/node':
         specifier: ^22.8.7
-        version: 22.13.0
+        version: 22.13.1
       tsup:
         specifier: ^8.3.5
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: 2.1.4
-        version: 2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/plugin-spheron:
     dependencies:
@@ -4795,7 +4816,7 @@ importers:
         version: 1.4.0(starknet@6.18.0(encoding@0.1.13))
       vitest:
         specifier: 2.1.5
-        version: 2.1.5(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 2.1.5(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
       whatwg-url:
         specifier: 7.1.0
         version: 7.1.0
@@ -4827,13 +4848,13 @@ importers:
         version: 1.5.3
       '@types/node':
         specifier: ^22.10.1
-        version: 22.13.0
+        version: 22.13.1
 
   packages/plugin-sui:
     dependencies:
       '@cetusprotocol/aggregator-sdk':
         specifier: ^0.3.21
-        version: 0.3.21(@jest/transform@29.7.0)(@jest/types@29.6.3)(babel-plugin-macros@3.1.0)(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@6.0.5)
+        version: 0.3.22(@jest/transform@29.7.0)(@jest/types@29.6.3)(babel-plugin-macros@3.1.0)(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@6.0.5)
       '@elizaos/core':
         specifier: workspace:*
         version: link:../core
@@ -4857,7 +4878,7 @@ importers:
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
       vitest:
         specifier: 2.1.4
-        version: 2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
       whatwg-url:
         specifier: 7.1.0
         version: 7.1.0
@@ -4880,10 +4901,10 @@ importers:
         version: 27.5.2
       '@types/node':
         specifier: ^16.0.0
-        version: 16.18.125
+        version: 16.18.126
       jest:
         specifier: ^27.0.0
-        version: 27.5.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@16.18.125)(typescript@5.7.3))(utf-8-validate@5.0.10)
+        version: 27.5.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@16.18.126)(typescript@5.7.3))(utf-8-validate@5.0.10)
       tsup:
         specifier: ^8.3.5
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
@@ -4916,7 +4937,7 @@ importers:
         version: 5.1.2
       pumpdotfun-sdk:
         specifier: 1.3.2
-        version: 1.3.2(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(rollup@4.34.1)(typescript@5.7.3)(utf-8-validate@5.0.10)
+        version: 1.3.2(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(rollup@4.34.4)(typescript@5.7.3)(utf-8-validate@5.0.10)
       tsup:
         specifier: 8.3.5
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
@@ -4997,7 +5018,7 @@ importers:
         version: 11.0.3
       vitest:
         specifier: 2.1.5
-        version: 2.1.5(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 2.1.5(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
       whatwg-url:
         specifier: 7.1.0
         version: 7.1.0
@@ -5010,7 +5031,7 @@ importers:
         version: 3.2.0
       ts-node:
         specifier: ^10.9.2
-        version: 10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.7.3)
+        version: 10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.7.3)
 
   packages/plugin-thirdweb:
     dependencies:
@@ -5019,7 +5040,7 @@ importers:
         version: link:../core
       thirdweb:
         specifier: ^5.80.0
-        version: 5.87.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(bufferutil@4.0.9)(encoding@0.1.13)(ethers@6.13.5(bufferutil@4.0.9)(utf-8-validate@5.0.10))(ioredis@5.4.2)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)(typescript@5.7.3)(utf-8-validate@5.0.10)(zod@3.24.1)
+        version: 5.87.4(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(bufferutil@4.0.9)(encoding@0.1.13)(ethers@6.13.5(bufferutil@4.0.9)(utf-8-validate@5.0.10))(ioredis@5.4.2)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)(typescript@5.7.3)(utf-8-validate@5.0.10)(zod@3.24.1)
       tsup:
         specifier: 8.3.5
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
@@ -5103,7 +5124,7 @@ importers:
         version: 11.0.3
       vitest:
         specifier: 2.1.5
-        version: 2.1.5(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 2.1.5(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
       whatwg-url:
         specifier: 7.1.0
         version: 7.1.0
@@ -5151,7 +5172,7 @@ importers:
         version: 1.5.3
       vitest:
         specifier: ^1.0.0
-        version: 1.6.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 1.6.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/plugin-udio:
     dependencies:
@@ -5167,10 +5188,10 @@ importers:
         version: 27.5.2
       '@types/node':
         specifier: ^16.0.0
-        version: 16.18.125
+        version: 16.18.126
       jest:
         specifier: ^27.0.0
-        version: 27.5.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@16.18.125)(typescript@5.7.3))(utf-8-validate@5.0.10)
+        version: 27.5.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@16.18.126)(typescript@5.7.3))(utf-8-validate@5.0.10)
       tsup:
         specifier: ^8.3.5
         version: 8.3.5(@swc/core@1.10.14(@swc/helpers@0.5.15))(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(typescript@5.7.3)(yaml@2.7.0)
@@ -5242,7 +5263,7 @@ importers:
         version: 5.6.3
       vitest:
         specifier: ^1.2.1
-        version: 1.6.1(@types/node@20.17.9)(@vitest/ui@0.34.7)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+        version: 1.6.1(@types/node@20.17.9)(@vitest/ui@0.34.7)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   packages/plugin-zerion:
     dependencies:
@@ -5558,59 +5579,59 @@ packages:
       '@algolia/client-search': '>= 4.9.1 < 6'
       algoliasearch: '>= 4.9.1 < 6'
 
-  '@algolia/client-abtesting@5.20.0':
-    resolution: {integrity: sha512-YaEoNc1Xf2Yk6oCfXXkZ4+dIPLulCx8Ivqj0OsdkHWnsI3aOJChY5qsfyHhDBNSOhqn2ilgHWxSfyZrjxBcAww==}
+  '@algolia/client-abtesting@5.20.1':
+    resolution: {integrity: sha512-73pnrUixMVnfjgldxhRi5eYLraMt95/MhQHevoFtqwy+t2hfayxYBZXJ2k6JJDld8UmjcWwq3wXnvZJCOm7vZA==}
     engines: {node: '>= 14.0.0'}
 
-  '@algolia/client-analytics@5.20.0':
-    resolution: {integrity: sha512-CIT9ni0+5sYwqehw+t5cesjho3ugKQjPVy/iPiJvtJX4g8Cdb6je6SPt2uX72cf2ISiXCAX9U3cY0nN0efnRDw==}
+  '@algolia/client-analytics@5.20.1':
+    resolution: {integrity: sha512-BRiyL+AwPfGTlo3HbrFDMeTK2z5SaJmB8PBd1JI66d6MeP85+38Mux2FFw+nvDOfBwlGaN/uw2AQTOZ9r4JYtA==}
     engines: {node: '>= 14.0.0'}
 
-  '@algolia/client-common@5.20.0':
-    resolution: {integrity: sha512-iSTFT3IU8KNpbAHcBUJw2HUrPnMXeXLyGajmCL7gIzWOsYM4GabZDHXOFx93WGiXMti1dymz8k8R+bfHv1YZmA==}
+  '@algolia/client-common@5.20.1':
+    resolution: {integrity: sha512-Dk4RhklaAbqLzOeJO/MoIFUjcKYGECiAJYYqDzmE/sbXICk5Uo6dGlv8w4z09lmvsASpNUoMvGYHGBK+WkEGpA==}
     engines: {node: '>= 14.0.0'}
 
-  '@algolia/client-insights@5.20.0':
-    resolution: {integrity: sha512-w9RIojD45z1csvW1vZmAko82fqE/Dm+Ovsy2ElTsjFDB0HMAiLh2FO86hMHbEXDPz6GhHKgGNmBRiRP8dDPgJg==}
+  '@algolia/client-insights@5.20.1':
+    resolution: {integrity: sha512-eu5vhmyYgzZjFIPmkoLo/TU4s+IdsjQ+bEfLj2jcMvyfBD4DcqySKp03TrXjdrHPGO2I3fF7dPZOoCgEi1j2/g==}
     engines: {node: '>= 14.0.0'}
 
-  '@algolia/client-personalization@5.20.0':
-    resolution: {integrity: sha512-p/hftHhrbiHaEcxubYOzqVV4gUqYWLpTwK+nl2xN3eTrSW9SNuFlAvUBFqPXSVBqc6J5XL9dNKn3y8OA1KElSQ==}
+  '@algolia/client-personalization@5.20.1':
+    resolution: {integrity: sha512-TrUCJ0nVqE0PnOGoRG/RCirxWZ6pF+skZgaaESN2IBnJtk/In14xVmoj8Yzck81bGUY/UI+5dUUOOS7YTSVEhQ==}
     engines: {node: '>= 14.0.0'}
 
-  '@algolia/client-query-suggestions@5.20.0':
-    resolution: {integrity: sha512-m4aAuis5vZi7P4gTfiEs6YPrk/9hNTESj3gEmGFgfJw3hO2ubdS4jSId1URd6dGdt0ax2QuapXufcrN58hPUcw==}
+  '@algolia/client-query-suggestions@5.20.1':
+    resolution: {integrity: sha512-rHHX/30R3Kkx2aZeR7/8+jU0s6h1cNPMAKOvcMUGVmoiuh46F1sxzmiswHLg6CuLrQ0ikhpdhn3ehFSJwHgp2Q==}
     engines: {node: '>= 14.0.0'}
 
-  '@algolia/client-search@5.20.0':
-    resolution: {integrity: sha512-KL1zWTzrlN4MSiaK1ea560iCA/UewMbS4ZsLQRPoDTWyrbDKVbztkPwwv764LAqgXk0fvkNZvJ3IelcK7DqhjQ==}
+  '@algolia/client-search@5.20.1':
+    resolution: {integrity: sha512-YzHD0Nqp7AjvzbFrMIjhCUl6apHkWfZxKDSlMqf80mXkuG52wY289zFlvTfHjHK1nEiDslH3uHYAR/poOOa21Q==}
     engines: {node: '>= 14.0.0'}
 
   '@algolia/events@4.0.1':
     resolution: {integrity: sha512-FQzvOCgoFXAbf5Y6mYozw2aj5KCJoA3m4heImceldzPSMbdyS4atVjJzXKMsfX3wnZTFYwkkt8/z8UesLHlSBQ==}
 
-  '@algolia/ingestion@1.20.0':
-    resolution: {integrity: sha512-shj2lTdzl9un4XJblrgqg54DoK6JeKFO8K8qInMu4XhE2JuB8De6PUuXAQwiRigZupbI0xq8aM0LKdc9+qiLQA==}
+  '@algolia/ingestion@1.20.1':
+    resolution: {integrity: sha512-sHNZ8b5tK7TvXMiiKK+89UsXnFthnAZc0vpwvDKygdTqvsfmfJPhthx36eHTAVYfh7NnA1+eqZsT/hMUGeZFkQ==}
     engines: {node: '>= 14.0.0'}
 
-  '@algolia/monitoring@1.20.0':
-    resolution: {integrity: sha512-aF9blPwOhKtWvkjyyXh9P5peqmhCA1XxLBRgItT+K6pbT0q4hBDQrCid+pQZJYy4HFUKjB/NDDwyzFhj/rwKhw==}
+  '@algolia/monitoring@1.20.1':
+    resolution: {integrity: sha512-+fHd1U3gSeszCH03UtyUZmprpmcJH6aJKyUTOfY73lKKRR7hVofmV812ahScR0T4xUkBlGjTLeGnsKY0IG6K6Q==}
     engines: {node: '>= 14.0.0'}
 
-  '@algolia/recommend@5.20.0':
-    resolution: {integrity: sha512-T6B/WPdZR3b89/F9Vvk6QCbt/wrLAtrGoL8z4qPXDFApQ8MuTFWbleN/4rHn6APWO3ps+BUePIEbue2rY5MlRw==}
+  '@algolia/recommend@5.20.1':
+    resolution: {integrity: sha512-+IuiUv3OSOFFKoXFMlZHfFzXGqEQbKhncpAcRSAtJmN4pupY4aNblvJ9Wv0SMm7/MSFRy2JLIoYWRSBpSV2yEg==}
     engines: {node: '>= 14.0.0'}
 
-  '@algolia/requester-browser-xhr@5.20.0':
-    resolution: {integrity: sha512-t6//lXsq8E85JMenHrI6mhViipUT5riNhEfCcvtRsTV+KIBpC6Od18eK864dmBhoc5MubM0f+sGpKOqJIlBSCg==}
+  '@algolia/requester-browser-xhr@5.20.1':
+    resolution: {integrity: sha512-+RaJa5MpJqPHaSbBw0nrHeyIAd5C4YC9C1LfDbZJqrn5ZwOvHMUTod852XmzX/1S8oi1jTynB4FjicmauZIKwA==}
     engines: {node: '>= 14.0.0'}
 
-  '@algolia/requester-fetch@5.20.0':
-    resolution: {integrity: sha512-FHxYGqRY+6bgjKsK4aUsTAg6xMs2S21elPe4Y50GB0Y041ihvw41Vlwy2QS6K9ldoftX4JvXodbKTcmuQxywdQ==}
+  '@algolia/requester-fetch@5.20.1':
+    resolution: {integrity: sha512-4l1cba8t02rNkLeX/B7bmgDg3CwuRunmuCSgN2zORDtepjg9YAU1qcyRTyc/rAuNJ54AduRfoBplmKXjowYzbQ==}
     engines: {node: '>= 14.0.0'}
 
-  '@algolia/requester-node-http@5.20.0':
-    resolution: {integrity: sha512-kmtQClq/w3vtPteDSPvaW9SPZL/xrIgMrxZyAgsFwrJk0vJxqyC5/hwHmrCraDnStnGSADnLpBf4SpZnwnkwWw==}
+  '@algolia/requester-node-http@5.20.1':
+    resolution: {integrity: sha512-4npKo1qpLG5xusFoFUj4xIIR/6y3YoCuS/uhagv2blGFotDj+D6OLTML3Pp6JCVcES4zDbkoY7pmNBA8ARtidQ==}
     engines: {node: '>= 14.0.0'}
 
   '@alloc/quick-lru@5.2.0':
@@ -5625,11 +5646,11 @@ packages:
     resolution: {integrity: sha512-30iZtAPgz+LTIYoeivqYo853f02jBYSd5uGnGpkFV0M3xOt9aN73erkgYAmZU43x4VfqcnLxW9Kpg3R5LC4YYw==}
     engines: {node: '>=6.0.0'}
 
-  '@antfu/install-pkg@0.4.1':
-    resolution: {integrity: sha512-T7yB5QNG29afhWVkVq7XeIMBa5U/vs9mX69YqayXypPRmYzUmzwnYltplHmPtZ4HPCn+sQKeXW8I47wCbuBOjw==}
+  '@antfu/install-pkg@1.0.0':
+    resolution: {integrity: sha512-xvX6P/lo1B3ej0OsaErAjqgFYzYVcJpamjLAFLYh9vRJngBrMoUG7aVnrGTeqM7yxbyTD5p3F2+0/QUEh8Vzhw==}
 
-  '@antfu/utils@0.7.10':
-    resolution: {integrity: sha512-+562v9k4aI80m1+VuMHehNJWLOFjBnXn3tdOitzD0il5b7smkSBal4+a3oKiQTbrwMmN/TBUMDvbdoWDehgOww==}
+  '@antfu/utils@8.1.0':
+    resolution: {integrity: sha512-XPR7Jfwp0FFl/dFYPX8ZjpmU4/1mIXTjnZ1ba48BLMyKOV62/tiRjdsFcPs2hsYcSud4tzk7w3a3LjX8Fu3huA==}
 
   '@anthropic-ai/sdk@0.30.1':
     resolution: {integrity: sha512-nuKvp7wOIz6BFei8WrTdhmSsx5mwnArYyJgh4+vYu3V4J0Ltb8Xm3odPm51n1aSI0XxNCrDl7O88cxCtUdAkaw==}
@@ -6706,19 +6727,19 @@ packages:
   '@brokerloop/ttlcache@3.2.3':
     resolution: {integrity: sha512-kZWoyJGBYTv1cL5oHBYEixlJysJBf2RVnub3gbclD+dwaW9aKubbHzbZ9q1q6bONosxaOqMsoBorOrZKzBDiqg==}
 
-  '@cetusprotocol/aggregator-sdk@0.3.21':
-    resolution: {integrity: sha512-ZvYphduw/VHik48Lc+f0SzwkzH3pK8c73mQAI85AIJ/xwxCTTC528ePuRnFd/Era0Vo6kHT4AN65XK4ipqTvwQ==}
+  '@cetusprotocol/aggregator-sdk@0.3.22':
+    resolution: {integrity: sha512-CM3QAqjusAJuq8XxPRboz5Md9KFS9L9po3O83ZV6WAxNqiB+dJsMEK7fGOwIleo08MkmzKf57SVk0I8n0H2pcw==}
     peerDependencies:
       typescript: ^5.0.0
 
   '@cfworker/json-schema@4.1.1':
     resolution: {integrity: sha512-gAmrUZSGtKc3AiBL71iNWxDsyUC5uMaKKGdvzYsBoTW/xi42JQHl7eKV2OYzCUqvc+D2RCcf7EXY2iCyFIk6og==}
 
-  '@chain-registry/types@0.50.62':
-    resolution: {integrity: sha512-7o7ADxjo4J4Re43ZDh9hMnv2kcn1Lt2P3HudvV6Veb3VmTHakIXZJGmfx7Yr8YSfBhZP6kMimJU0Zk6TegGzeg==}
+  '@chain-registry/types@0.50.65':
+    resolution: {integrity: sha512-QsAfpG3ApGhuoLoi6m8Kir+p9F634mN/dohqX8Z3k4IM8HV9a9qbpWIsI8SY9dKfz4HuqsTEAzsv0/6CVy8kmQ==}
 
-  '@chain-registry/utils@1.51.62':
-    resolution: {integrity: sha512-n6iwpRkgO8jHOksWTlZIFD8t75P72bjOnYKIalow1S8h+oy0yzOUJLWrIHXEp91RJuPDxUMonQ4eS4q10wWpOw==}
+  '@chain-registry/utils@1.51.65':
+    resolution: {integrity: sha512-NnFMx+dTLIJka3RyNd9Z3wSH+6CkUmTZXjqQ9rVC41tv6qeOPrHgzT6Aj4PzT7EnVEp/NarP45y0a7UXCJxtyA==}
 
   '@changesets/apply-release-plan@7.0.8':
     resolution: {integrity: sha512-qjMUj4DYQ1Z6qHawsn7S71SujrExJ+nceyKKyI9iB+M5p9lCL55afuEd6uLBPRpLGWQwkwvWegDHtwHJb1UjpA==}
@@ -9035,8 +9056,8 @@ packages:
     resolution: {integrity: sha512-bgxdZmgTrJZX50OjyVwz3+mNEnCTNkh3cIqGPWVNeW9jX6bn1ZkU80uPd+67/ZpIJIjRQ9qaHCjhavyoWYxumg==}
     engines: {node: '>=12.10.0'}
 
-  '@grpc/grpc-js@1.12.5':
-    resolution: {integrity: sha512-d3iiHxdpg5+ZcJ6jnDSOT8Z0O0VMVGy34jAnYLUX8yd36b1qn8f1TwOA/Lc7TsOh03IkPJ38eGI5qD2EjNkoEA==}
+  '@grpc/grpc-js@1.12.6':
+    resolution: {integrity: sha512-JXUj6PI0oqqzTGvKtzOkxtpsyPRNsrmhh41TtIz/zEB6J+AUiZZ0dxWzcMwO9Ns5rmSPuMdghlTbUuqIM48d3Q==}
     engines: {node: '>=12.10.0'}
 
   '@grpc/proto-loader@0.7.13':
@@ -9100,8 +9121,8 @@ packages:
   '@iconify/types@2.0.0':
     resolution: {integrity: sha512-+wluvCrRhXrhyOmRDJ3q8mux9JkKy5SJ/v8ol2tu4FVjyYvtEzkc/3pK15ET6RKg4b4w4BmTk1+gsCUhf21Ykg==}
 
-  '@iconify/utils@2.2.1':
-    resolution: {integrity: sha512-0/7J7hk4PqXmxo5PDBDxmnecw5PxklZJfNjIVG9FM0mEfVrvfudS22rYWsqVk6gR3UJ/mSYS90X4R3znXnqfNA==}
+  '@iconify/utils@2.3.0':
+    resolution: {integrity: sha512-GmQ78prtwYW6EtzXRU1rY+KwOKfz32PD7iJh6Iyqw68GiKuoZ2A6pRtzWONz5VQJbp50mEjXh/7NkumtrAgRKA==}
 
   '@img/sharp-darwin-arm64@0.33.5':
     resolution: {integrity: sha512-UT4p+iz/2H4twwAoLCqfA9UH5pI6DggwKEGuaPy7nCVQ8ZsiY5PIcrRvD1DzuY3qYL07NtIQcWnBSY/heikIFQ==}
@@ -9217,8 +9238,8 @@ packages:
     resolution: {integrity: sha512-qlChzqPi7I45kxs+ef/8JSP9r7i/nZS0Mx7H3zkBKiXGbg4lgsADyirxT1hsP0JVvpmu0Q+CD8kwx44yRZgFkA==}
     engines: {node: '>=20'}
 
-  '@initia/initia.proto@0.2.5':
-    resolution: {integrity: sha512-luTUKU28TjzFJlrQ2XODbZ6Ah7lytl3R9viuBqjiyKR3d24HkfYIIEnXyThYA8vaQWy/zEcJA2c7J43rSnlo+g==}
+  '@initia/initia.proto@0.2.6':
+    resolution: {integrity: sha512-khiCPUxZTkyAl+SQbQCOlcJId/a0ToUhG+ChrVXN9a+1ypPz5355j2UP2IvnUf+lAix/+zzdekcqO/Lig7htAQ==}
 
   '@initia/opinit.proto@0.0.11':
     resolution: {integrity: sha512-Op9GIlXiV1xhUIjVQ2TFE9a3X8iyFVNtJNHCM34gwLQHJktDNm2KCoW4eHh6pkn4//ECRVH7zuKgV8TdZWogCw==}
@@ -9542,13 +9563,13 @@ packages:
   '@keplr-wallet/types@0.11.64':
     resolution: {integrity: sha512-GgzeLDHHfZFyne3O7UIfFHj/uYqVbxAZI31RbBwt460OBbvwQzjrlZwvJW3vieWRAgxKSITjzEDBl2WneFTQdQ==}
 
-  '@keplr-wallet/types@0.12.179':
-    resolution: {integrity: sha512-foIZyWFHABht2NaE5ad4Tg8Zn+s7Xm5q9BVO26KiN3Xecf+jo9PxkGu1hhn/Kx7ash58KhunXbps4zXmOXIp7g==}
+  '@keplr-wallet/types@0.12.183':
+    resolution: {integrity: sha512-z59MGLg44Bex9CQ65n6Ylioa/Cy67+yBTKvP1WGmftlFuoEh1B9XfM6RUEgo3rA/ugFrVesuEYc9m11PpHXNnQ==}
     peerDependencies:
       starknet: ^6
 
-  '@keplr-wallet/unit@0.12.179':
-    resolution: {integrity: sha512-aRr1qrD/DJU6sus6xK8nXPkq9lmuJvzmh43QIG2baqMmnmfvVzIPJyJAaCddBvYmUT3Wnvih/bfkN7uyTJR/HA==}
+  '@keplr-wallet/unit@0.12.183':
+    resolution: {integrity: sha512-mIcXtOfi+cGpBdBdeh7OYdPP5ucz8nA8stHulRMwT/bS6VUTcByUujNGCfP4CvVjj8bWLcE6qh3HK4/JkSRpjg==}
 
   '@kikobeats/time-span@1.0.5':
     resolution: {integrity: sha512-txRAdmi35N1wnsLS1AO5mTlbY5Cv5/61WXqek2y3L9Q7u4mgdUVq819so5xe753hL5gYeLzlWoJ/VJfXg9nx8g==}
@@ -9560,8 +9581,8 @@ packages:
   '@kwsites/promise-deferred@1.1.1':
     resolution: {integrity: sha512-GaHYm+c0O9MjZRu0ongGBRbinu8gVAMd2UZjji6jVmqKtZluZnptXGWhz1E8j8D2HJ3f/yMxKAUC0b+57wncIw==}
 
-  '@langchain/core@0.3.37':
-    resolution: {integrity: sha512-LFk9GqHxcyCFx0oXvCBP7vDZIOUHYzzNU7JR+2ofIMnfkBLzcCKzBLySQDfPtd13PrpGHkaeOeLq8H1Tqi9lSw==}
+  '@langchain/core@0.3.38':
+    resolution: {integrity: sha512-o7mowk/0oIsYsPxRAJ3TKX6OG674HqcaNRged0sxaTegLAMyZDBDRXEAt3qoe5UfkHnqXAggDLjNVDhpMwECmg==}
     engines: {node: '>=18'}
 
   '@langchain/groq@0.1.3':
@@ -9748,8 +9769,8 @@ packages:
   '@lit-protocol/access-control-conditions@6.11.3':
     resolution: {integrity: sha512-Rm5heGZA8qEMpJx4J7XFLUHz3RZohKKtOj620NOdiuYVWadjYqo2YNS8jWn3Xn65xBK+Vhjny4/cPVQXccp+3A==}
 
-  '@lit-protocol/access-control-conditions@7.0.4':
-    resolution: {integrity: sha512-zkggnXs0K2OEWLV8YKZyzGtSFhVq/XdbeXCQmd4apAw/YQCMxit94iILG1vJvDH3GFS3Xq/YPUAVECmt2lh/+A==}
+  '@lit-protocol/access-control-conditions@7.0.5':
+    resolution: {integrity: sha512-RcLOYhZsCriQnBc8TbTSN6mXU6XzEBqZu2dcXEE0MYJNzGAasaZJwY9DSigxtNi6Pny0+iMRQtZRDBxfY8c/Jg==}
 
   '@lit-protocol/accs-schemas@0.0.19':
     resolution: {integrity: sha512-O7hrDPUA6x5fgOx8HKRAV1k/8VMzwehfNHUwb2UGMbw4g3kKpokbR/ne7OPdIUYMgvRATc0WjL5gbh/w33pkOQ==}
@@ -9774,17 +9795,17 @@ packages:
       util: ^0.12.4
       web-vitals: ^3.0.4
 
-  '@lit-protocol/auth-browser@7.0.4':
-    resolution: {integrity: sha512-872fDuJ9eY24ev3uO63J49u0XKq4wnVyJ3Kx3LHp7mk1JZqcay1AnXqZWR6M6vp8huMY/4lzMbNc3VF0hZa4Dw==}
+  '@lit-protocol/auth-browser@7.0.5':
+    resolution: {integrity: sha512-7obeafYFz5ovNoYv7+v/NGCuIKsdPfcwwBB1qD2Z+0ubyNo+FBgNe5fS6YOnyjrSj8ZBQT+avpPdDqrhtofwvw==}
 
   '@lit-protocol/auth-helpers@6.11.3':
     resolution: {integrity: sha512-aVDyH3At3rv+S8dAmDp3/jq47+yb8wBahGaLDmbdOjoXS80sLVJ/o38Ni1j+uQaDu/l/OeVd3Avgs7QUFYJQVw==}
 
-  '@lit-protocol/auth-helpers@7.0.4':
-    resolution: {integrity: sha512-oOHB+XkqMh9JKelnE67n3pGaszMCEr5v/ZATt9I9kpeoZ6MhShNf/4Wg6lGgBrRJhtHROM3zIJRZKl9Zmy7aSg==}
+  '@lit-protocol/auth-helpers@7.0.5':
+    resolution: {integrity: sha512-074fV8H3MiySlyePuNCxpE3f4lv1cufwbU+8OE5JhXGY266UZvddE6gSajrFsV1+RP+31dqBAZzLaUECBDqvkA==}
 
-  '@lit-protocol/aw-tool@0.1.0-17':
-    resolution: {integrity: sha512-hltk2uTMMTof+ng++48CqW54Jx7oSH8CJJDIxmvwOoeN6ZENcsIFlB6pq/JvXIJe7RA7cy7mB+11G/Oocz2GZQ==}
+  '@lit-protocol/aw-tool@0.1.0-19':
+    resolution: {integrity: sha512-CxxlsZcdTdYZNvPV1hORJ4X9BdNdJu8x7o8G6o07auPUVsKrFlbY5ZhAbhQsBnvY5ydWDqOQV/uUCAX1zyN4SQ==}
 
   '@lit-protocol/bls-sdk@2.1.62':
     resolution: {integrity: sha512-UjNjycoNXOEoLH/foIJx1L9PLL5OxmHcCD/mFXr4KSeQV/v4srvGNpY/4ng7+k9sJEbvwRwv+FB07ng3/Ihacg==}
@@ -9803,8 +9824,8 @@ packages:
   '@lit-protocol/constants@7.0.2':
     resolution: {integrity: sha512-A2tpsB7pCGHiC+VrPAHBaEGyb/9crCkcSIj8BtGPrLRszFZO8EHKWziM7WiMM2c2mYb+B4dKtGGUkxxCAarqaQ==}
 
-  '@lit-protocol/constants@7.0.4':
-    resolution: {integrity: sha512-yyCqLZ0bXw+kvrNcIHZOMaeL6CqA/oQxEX7cRRRaeEF+jSEnbWw2xi+kMcuD3oIiSSi48eBoADzrokNenFAq6Q==}
+  '@lit-protocol/constants@7.0.5':
+    resolution: {integrity: sha512-BDqdrBFjwGdf38cvOkWG7mnp0QDZXOgd1QNa8GliuscTLvFJq20c2VRuyVoyc0kA7JtKDQG4S3Btjoc3M7Oggw==}
 
   '@lit-protocol/contracts-sdk@6.11.3':
     resolution: {integrity: sha512-5vwdMRVSo+SDD6ZFWNm4m4kLuyDj4pX6gwXw2lj6trD66zT2ODby2lRv8K7m0OVk0HnWONDhWe3933bgu4ltQQ==}
@@ -9813,8 +9834,8 @@ packages:
       date-and-time: ^2.4.1
       multiformats: ^9.7.1
 
-  '@lit-protocol/contracts-sdk@7.0.4':
-    resolution: {integrity: sha512-4kVNjUlgDCMKa9EoKqUrFIoJQOr5C5cUuYaAT9QSosgjIKAlgBu9kDcU17FpG3kOaNPAzAxh0+KnCw3t933SgA==}
+  '@lit-protocol/contracts-sdk@7.0.5':
+    resolution: {integrity: sha512-H1llDljqw9GQtQj+xiqMN48Wr0IGsTq1T0CA+o8xRDLpSf/uO/+cdC+BNAr+zBSQ7YR2rwgSlY36eYe1/V5lhQ==}
 
   '@lit-protocol/contracts@0.0.63':
     resolution: {integrity: sha512-CAorNt72ybIY/g//dDeR837izNGuYQR99XwPSK2X2AJ6c+aZX1kdXCrOnxsbY40BzFrOk/dIFo+ymJ9E3qh48w==}
@@ -9829,8 +9850,8 @@ packages:
   '@lit-protocol/core@6.11.3':
     resolution: {integrity: sha512-BdOvaxe/cmoxpjcCJ5SE0ttL1Ibvz5HpCcYaV+rjJH8LaoUF18f+eOudfR7JFxSp49+qzMrpL+aK5XkDsL7U/A==}
 
-  '@lit-protocol/core@7.0.4':
-    resolution: {integrity: sha512-vWHe5nCwYJsgcYR1pGH94UizgPyGOTs9dtgSxWH9JcEMxattKwZky8+i+NJ3Xa0ITrSIqbMvQtcsYQz5oaUEmg==}
+  '@lit-protocol/core@7.0.5':
+    resolution: {integrity: sha512-ruOdRTzGKhbZtTZcMVGo8ofUzhtt+wqHQrDrG1RiI809MV+QNadOQ38ULM0p2UB0YtDs9O4wIPc0r16LYa9Tmw==}
 
   '@lit-protocol/crypto@2.1.62':
     resolution: {integrity: sha512-pWte+VQOPmSFvfoMxvobmj5JjkGSD44XMkkTXGubpGTBr27hK9CuDxpVHTsI9NsGFSJRdPBpRou+YD5I22yDiA==}
@@ -9838,8 +9859,8 @@ packages:
   '@lit-protocol/crypto@6.11.3':
     resolution: {integrity: sha512-RRvUAMN6KDD3dk+K5ZGjNIwX9gbnnJSC/jkF7dLpvLh0/YpRi4FT6SYqUSfz7X4VWPWTOSyDgvUYqPOUPyZIlw==}
 
-  '@lit-protocol/crypto@7.0.4':
-    resolution: {integrity: sha512-pt9tUQs4rDc4MRuWdb5NATIjZcQVIqXaDirLrxvcuNkbwuLzsVVVcsF1Sbr7S4Tkz4Okh4PptWkztLj3nTvDtw==}
+  '@lit-protocol/crypto@7.0.5':
+    resolution: {integrity: sha512-OGU+nV8SuFyaF82NxLN3+qimA8crz4yxNwJRo9FstHuKgiMZa0j/crmf4E9lSSxs8U0HKQO2P3XXtaSnWRLUiQ==}
 
   '@lit-protocol/ecdsa-sdk@2.1.62':
     resolution: {integrity: sha512-VWYAQh31e5Vu6YXvw7iDQja/f2Je6Obj8VoXLweWWfSpUnKqe1JJKGDLxOAuQUT3ZSaX7bYrq7hLIJdwdWmJQw==}
@@ -9855,25 +9876,25 @@ packages:
   '@lit-protocol/encryption@6.11.3':
     resolution: {integrity: sha512-MDpaTiNMypZ22ZsrupUINQnkIp9roJncFAnD94LsKAmY0LHHniGy5SC93lmMRZD/Sk4Yb7cmrpWergpQ4q007w==}
 
-  '@lit-protocol/encryption@7.0.4':
-    resolution: {integrity: sha512-E8JsI/S6kxWo77t4YDaO5G2DYn4lQbvWtZGwrTO3zE4m+u1rNgchu57yzwBCbDWdO34zNLJq+qwk0I+zbByJvg==}
+  '@lit-protocol/encryption@7.0.5':
+    resolution: {integrity: sha512-SIW+DX0wEH7QvlqJullcf0jcn26NvXjGm3/tzoowYgc6Qjgs1eYGUZLsYITLi+reJQzCPka+c6Ry4GiCOs/IOg==}
 
-  '@lit-protocol/lit-auth-client@7.0.4':
-    resolution: {integrity: sha512-T5lF2QKQrIkPhDHSK0Yx95xrTcSRzr9nALtnnoFRLQpMuoBkCSAS2jI91IscKL6+HmK6FiCWhjIeT6SC003nxw==}
+  '@lit-protocol/lit-auth-client@7.0.5':
+    resolution: {integrity: sha512-iNe+uoOiuVLwK7M2vuzWjyQ1vl2K4du8yBWOjSOxo0T5Md3YsDvsdiRVmbOWkbM+NxlOdFGDhfAOYeQqHHUhlg==}
 
   '@lit-protocol/lit-node-client-nodejs@6.11.3':
     resolution: {integrity: sha512-Cza5JpTIG5RGieJ+WpL2Rm79sAw9JwRel3ImR6ntUHWs854D8fjEzypnk3oxF4WYp7KM9CBH6XBW7tcq0sZqWA==}
 
-  '@lit-protocol/lit-node-client-nodejs@7.0.4':
-    resolution: {integrity: sha512-tIz6nn4Nd29lCAwHRxM3AkgqDoFJ0CGOJDaHUp4baniIlLGO5QFqrN7/wwydUvCsytFxapYoUS12TRMNsIyHvA==}
+  '@lit-protocol/lit-node-client-nodejs@7.0.5':
+    resolution: {integrity: sha512-DcDQ7y7WwWkhmJYusACukF8ooKNq1Z/CFW3I52KaDfmqHVu1M+N/LIBM/zaYjk4QG5l0f2pulIfKfW1rAw78bw==}
 
   '@lit-protocol/lit-node-client@6.11.3':
     resolution: {integrity: sha512-WBojLz8pXXf6PdOq9OOasiX4YNFHut978v2vXTMLpNY+MQJ6FZaNoS8ssYC/78nU0WboDtQInySvtjdKXzqggA==}
     peerDependencies:
       tslib: ^2.3.0
 
-  '@lit-protocol/lit-node-client@7.0.4':
-    resolution: {integrity: sha512-HyW/0R4KibIhafa1f03KifFx7ggsMeV9Zo5BBV+iepACKhQfv/aX+giA7nnyL7jnhF56WoUOdRU/ETxRE3Wocw==}
+  '@lit-protocol/lit-node-client@7.0.5':
+    resolution: {integrity: sha512-51HAY9sOzKCxZm/dDIrhhwZjKYxGDrnTc3i6GVr2OjkaVwPu8vP5LSzOuFzDH7fuKofENyt+lILLfKmtAumwbQ==}
 
   '@lit-protocol/lit-third-party-libs@2.1.62':
     resolution: {integrity: sha512-js8Z3uG4v30Dw9HNqnjxkzMcB3cp3UcF6tfsWGo99+g5OqqKnkCDbb4IXeqnGbslVPn6ll6XouRQPmCcuzeGaw==}
@@ -9881,8 +9902,8 @@ packages:
   '@lit-protocol/logger@6.11.3':
     resolution: {integrity: sha512-vyi/8Jkij1HFpZB0QSWgt72Oxm7C5fg3HjlHY3FQW0KbYWALpaeWeqNHEXt7jH6bxDp/wjyg4Qf1rvFKlHan6g==}
 
-  '@lit-protocol/logger@7.0.4':
-    resolution: {integrity: sha512-PhCdek4ssUD8LOg1bor/glCOouiUwqDFdiT2rkFaTph7KU8igN1FTdRSeFTqhNlHZk2x9+G+K+kwYbGzbaW+Rg==}
+  '@lit-protocol/logger@7.0.5':
+    resolution: {integrity: sha512-vsWBJ5/qbJRzKEIwnifgB59ONRZ0dRbPl4ikG/a1h+FmD4x9jLXXxlhTvM8OuPpaWUhd9U2Nj2fuIqsTIlMQgQ==}
 
   '@lit-protocol/misc-browser@2.1.62':
     resolution: {integrity: sha512-2NX//tUe5ChrWCN4Msi4RE8DlYjTMGqyPYJHS86r7nKHG7sHSPCucn84LiTmVGA3DVKzspeGJdMbEF/W8Ogn6w==}
@@ -9890,8 +9911,8 @@ packages:
   '@lit-protocol/misc-browser@6.11.3':
     resolution: {integrity: sha512-lJlWB7vMmHX11S/2xqdPKRlETkV3Baf1eBaN97fRwnw+y8AZpYfD1pxge5dF+ZpmxEk2gvXvO1KZHj2dCK/1eA==}
 
-  '@lit-protocol/misc-browser@7.0.4':
-    resolution: {integrity: sha512-fwMIxhGvrAOhDMj/rS1uBl19TF5khfpekZnf5K90Db81chv8HzKkR2oeRNRW4h7bcbj96osRPDJG6Z22EBO6CA==}
+  '@lit-protocol/misc-browser@7.0.5':
+    resolution: {integrity: sha512-e297uTcmZBRXEbZFlvmUaw2Is7uOSjppdfxv2bQl//NlANj5HlGWtobw0kYE86ICEmN/JgE7WOUJGonToNJRmA==}
 
   '@lit-protocol/misc@2.1.62':
     resolution: {integrity: sha512-i6A/kxiJQgy8BZJGH7H8V2kxqOA2xboAjH2BzAbE/pMezfHG7wybkXT9cnXnXOZsAnuGnOKd93u+j7bskuDd2w==}
@@ -9899,8 +9920,8 @@ packages:
   '@lit-protocol/misc@6.11.3':
     resolution: {integrity: sha512-ige9iE8/M6ZT4VSsRzehjgcjPL7gHdRU9iCddrBYrEixMaKdV+cfIXKS9txfVeAcfK0JHjbOTRKhtp/DWRAB2g==}
 
-  '@lit-protocol/misc@7.0.4':
-    resolution: {integrity: sha512-OprocF89yyipVjVYJYz6JXc08WsYuRs3Mb8J0qdDTWAXziVjQByixmkOsC4sjkGDu+UVmxQI45dwF94Yu6Iuiw==}
+  '@lit-protocol/misc@7.0.5':
+    resolution: {integrity: sha512-C+wh5hLI3wn3LLpORdLHOWC9bPefn1M4tiJ3c/SvYydfl6km9hCjcrS7M8lxkk6GfDYuFAPCwZyINqIwfhjsiA==}
 
   '@lit-protocol/nacl@2.1.62':
     resolution: {integrity: sha512-0v9fa6Sd4xphjlYMZ9L8TTyR7G4YLvp323E8OJ76giuaPla4HXuwSiGMzUOaC6NKraArSrd54CKkHJ/bxEqVDA==}
@@ -9908,8 +9929,8 @@ packages:
   '@lit-protocol/nacl@6.11.3':
     resolution: {integrity: sha512-Qs3lIjP1gQB+JOBwpNdZ9N0lUBquwYY2rcgITtOnENTZXI8hspmNOC2QWmji7kIRzM7jaiMdJC/YO5airxDfQg==}
 
-  '@lit-protocol/nacl@7.0.4':
-    resolution: {integrity: sha512-HhFkuweyyK0elthxDtBoyVZt9N7LYSLszvuOjrp4r7Qu+jVQK+C+xWGqjr1b84ZPH7jQDC41JwYXeH0/C78gNQ==}
+  '@lit-protocol/nacl@7.0.5':
+    resolution: {integrity: sha512-Cf1Rh45CdFT45a6xd1KKfecn6ls5kREE6KL8R81PNo3yLSkeZXR4Q5Ku4R/SDSaNZAa00FVPVQYv3ebT4LIUaQ==}
 
   '@lit-protocol/node-client@2.1.62':
     resolution: {integrity: sha512-rLEUleDoJ+AATZfWNWXvy7UdSrUXMyCjpyB5bevVfk9YjIa5rd9BBXdFENCIA+9kLgVOgtND/R1PpEI/vZkMmw==}
@@ -9917,8 +9938,8 @@ packages:
   '@lit-protocol/pkp-base@6.11.3':
     resolution: {integrity: sha512-T6zquDKOu647yVkeS0CM2091zn5HbOl+qiPyO8ThTnvp74gbIjua+quoFvaagvhNRQAweWk4iBvnZ7247+1NfA==}
 
-  '@lit-protocol/pkp-base@7.0.4':
-    resolution: {integrity: sha512-TMhpx3ADOCAtyo8vGHiftEM27iYijZrfDQclPE587SA5sSDtszrYZmjmT/6SrnZidmP2Ks7xk3vGqKxzDjq5BA==}
+  '@lit-protocol/pkp-base@7.0.5':
+    resolution: {integrity: sha512-LtfEhub9W5uKp8VLspz+sNw0pGg5oxvP772AUWd/W/pXaYXv28aXySNThspuus4j3M1wiimxHlFEA2ZFNbkh5Q==}
 
   '@lit-protocol/pkp-client@6.11.3':
     resolution: {integrity: sha512-KMWkwfowXOJROC8vF9n4xK/NmIeMzZyJMTUOkQ+1yzS08W4/6aD4LguBzDb2Acxno/PSzX1xffSWZ+TZbsNAeA==}
@@ -9929,8 +9950,8 @@ packages:
   '@lit-protocol/pkp-ethers@6.11.3':
     resolution: {integrity: sha512-E7yjKEcTypRhOtVQtRyPtfZRbuZ1QPQ9ARCvaxCWthcjHIa6vfWp390hkS70hhZnZAYxIg3anafdGvJ8YBlppQ==}
 
-  '@lit-protocol/pkp-ethers@7.0.4':
-    resolution: {integrity: sha512-Zd5M2QgCoPxN3862C4TkPuzVAnTHRbe+gyEUxgd8KiWmfDxbZPWmFQvuRVH6IznaGlnnsY92of6R9ZTRsz/dhw==}
+  '@lit-protocol/pkp-ethers@7.0.5':
+    resolution: {integrity: sha512-8lkc+DPm231+X32vL60KXOQEEKGMRqgaEyCDrzhxBfOsuShmO4Sw1Ss+TNLn/qfn/CU6pDSEVcvJqHAg42SjxA==}
 
   '@lit-protocol/sev-snp-utils-sdk@6.11.3':
     resolution: {integrity: sha512-TR86ONpBK/oo4z51aJW0Jo/GJUZt/zmbIeduOyjnks7t0GHthkBbwA4/vE0uehJZH/xl+v+H3Zc9SkHUASKGuw==}
@@ -9949,8 +9970,8 @@ packages:
   '@lit-protocol/types@7.0.2':
     resolution: {integrity: sha512-rEBZoeSByaMxXiP7w3g6/d180d8AbL4xpLqIlZchfJfAcSFkTseByV1d4h/J3LHl+3Q10wQsJT0N+qIi9kZbqA==}
 
-  '@lit-protocol/types@7.0.4':
-    resolution: {integrity: sha512-UKNuWJUCzO7EWw+7iS2rb6kDK8LxHZLyBKEndA+FaU35uK0o+0g7NFJYn1B4xM350bQUHVOUoY7JYgeC2gXlbg==}
+  '@lit-protocol/types@7.0.5':
+    resolution: {integrity: sha512-npdN0bmRcv6GFBR1xvOjAWIs3FequQL4Hs4dVCX5bPP01AeSz9+beGoRfN9A07rOaBF4+uVCq6z9iggzQ4Uu1Q==}
 
   '@lit-protocol/uint8arrays@2.1.62':
     resolution: {integrity: sha512-Q9Leppzyb9Y2jwe+i8btAUkTXqgnu21PFql83v6N70dkELSC+fKBzRSRqUpFqruW7dcrG8mNWsOCQbQ0kL/w/w==}
@@ -9958,14 +9979,14 @@ packages:
   '@lit-protocol/uint8arrays@6.11.3':
     resolution: {integrity: sha512-TA7M9j3dEmaRctf3lhaY65n0cMCPaZV2KW8hfvB8rv6EnPpV9jr+KH4YjKyxs9MsaeDFzesocg2PRAWzZdSAPg==}
 
-  '@lit-protocol/uint8arrays@7.0.4':
-    resolution: {integrity: sha512-fB9ktSLArF4c+Sq7Axt8cS8m/OHLfpL0RbjldV+VoyjqsTs4U9lUjqJzbk1RRqjBrCsEfvPhiKpPtOCSA9F4/A==}
+  '@lit-protocol/uint8arrays@7.0.5':
+    resolution: {integrity: sha512-+FFmO5QbwmOO5QoVtFDfX5BOBjMbCIuaxS0SdH+CNqcoJ7pFIQAdWAjXVxRyIMy8DNCca9uiWDYExSCcAJr9Ag==}
 
-  '@lit-protocol/wasm@7.0.4':
-    resolution: {integrity: sha512-QACm4as3CWasaSgPej0FhMBObeJUsiAmi3p/28pfh4yZgGLbvhg4NgBgoNVO8wnb671jdS2l1UNm3qyYIbmUYw==}
+  '@lit-protocol/wasm@7.0.5':
+    resolution: {integrity: sha512-isU4lTYhAOqJszgPxGGhfTg2ezH3s5SiWQ1Xg8sK1GeLLacTj6brc6uq9LjfaapbbyiKnKCq1weP0gTMws0Mzg==}
 
-  '@lit-protocol/wrapped-keys@7.0.4':
-    resolution: {integrity: sha512-FzNfxLMk83bOsM3I09B8pgaEyfNdZ1RcEkQb6JamAT5L32VpoespVa6xf4paK2TUp5/GbetNCLNIsicbIpKqDQ==}
+  '@lit-protocol/wrapped-keys@7.0.5':
+    resolution: {integrity: sha512-MakpAfpfdpsDsMl6c8wuxN5hrAWfCZkq4l6moAlLnOK9+jw0EpAwDSnBhXXhe2Xb8XNst5WrNDXp7mYgJNQ08Q==}
 
   '@lit/reactive-element@1.6.3':
     resolution: {integrity: sha512-QuTgnG52Poic7uM1AN5yJ09QMe0O28e10XzSvWDz02TJiiKee4stsiownEIadWm8nYzyDAyT+gKzUoZmiWQtsQ==}
@@ -10191,8 +10212,8 @@ packages:
   '@meteora-ag/dlmm@1.3.0':
     resolution: {integrity: sha512-k3VdtisuNaSavTY+M8vLsB3wqqpC/dyFPujp6MScz85Nj0Beuua6PRg5XSjzhAt8rbuXcnTSKWCTYzc24UMHmA==}
 
-  '@meteora-ag/dlmm@1.3.10':
-    resolution: {integrity: sha512-SafqbyviTYa2x1BWaay1jFERv2jnpLzurX6PFYW5ZeSpmy+BjyD64rKitJLrEJ/gsdZIGYs+fwU8btRntsqn8w==}
+  '@meteora-ag/dlmm@1.3.11':
+    resolution: {integrity: sha512-fr6dc/40axt9ixZR17fLuCpknCBkr0J5Zbebb5ngYwXX0h1CGH8uFP37MJoa/BwXfbbw9H88s/c7Ta7y19aYkg==}
 
   '@meteora-ag/m3m3@1.0.4':
     resolution: {integrity: sha512-tjNsQ7qCE9LAyZ8TpyNsg8kOiaarAQ91ckAGObKO/gcDkUfm5m/qrDo3qypN9aCAcFnNmvsuJecrJnLhRGq33g==}
@@ -10384,8 +10405,8 @@ packages:
       '@nestjs/websockets':
         optional: true
 
-  '@neynar/nodejs-sdk@2.9.0':
-    resolution: {integrity: sha512-jYFDhIXxiZUa4/FQ1WooKtdGPVdjPe0YXZZgU9va3drqk0gejRrGuxQ60ibsjMwtWsvrhvFPPACYk0zN08znGQ==}
+  '@neynar/nodejs-sdk@2.10.0':
+    resolution: {integrity: sha512-C9eZ4BSQ70rzYnNf7+/7KJfOVKqKhZRZxDDx4wtQepC4sgjrA0M/l9G1Ppquncj88oBeWTTcjgDZ7KjQebjRFw==}
     engines: {node: '>=19.9.0'}
 
   '@noble/ciphers@1.2.1':
@@ -11080,10 +11101,90 @@ packages:
     resolution: {integrity: sha512-UK4qVuesmUcpPZXMeO8FwRqpCNwJRBTHcae4j+3Mr3bxrNqilZIIowdrzgcgn8fSQ2Dg/P4/0NoPkxAvf9D5rw==}
     hasBin: true
 
+  '@opentelemetry/api-logs@0.57.1':
+    resolution: {integrity: sha512-I4PHczeujhQAQv6ZBzqHYEUiggZL4IdSMixtVD3EYqbdrjujE7kRfI5QohjlPoJm8BvenoW5YaTMWRrbpot6tg==}
+    engines: {node: '>=14'}
+
   '@opentelemetry/api@1.9.0':
     resolution: {integrity: sha512-3giAOQvZiH5F9bMlMiv8+GSPMeqg0dbaeo58/0SlA9sxSqZhnUtxzX9/2FzyhS9sWQf5S0GJE0AKBrFqjpeYcg==}
     engines: {node: '>=8.0.0'}
 
+  '@opentelemetry/context-async-hooks@1.30.1':
+    resolution: {integrity: sha512-s5vvxXPVdjqS3kTLKMeBMvop9hbWkwzBpu+mUO2M7sZtlkyDJGwFe33wRKnbaYDo8ExRVBIIdwIGrqpxHuKttA==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.0.0 <1.10.0'
+
+  '@opentelemetry/core@1.30.1':
+    resolution: {integrity: sha512-OOCM2C/QIURhJMuKaekP3TRBxBKxG/TWWA0TL2J6nXUtDnuCtccy49LUJF8xPFXMX+0LMcxFpCo8M9cGY1W6rQ==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.0.0 <1.10.0'
+
+  '@opentelemetry/exporter-trace-otlp-http@0.57.1':
+    resolution: {integrity: sha512-43dLEjlf6JGxpVt9RaRlJAvjHG1wGsbAuNd67RIDy/95zfKk2aNovtiGUgFdS/kcvgvS90upIUbgn0xUd9JjMg==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/otlp-exporter-base@0.57.1':
+    resolution: {integrity: sha512-GNBJAEYfeiYJQ3O2dvXgiNZ/qjWrBxSb1L1s7iV/jKBRGMN3Nv+miTk2SLeEobF5E5ZK4rVcHKlBZ71bPVIv/g==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/otlp-transformer@0.57.1':
+    resolution: {integrity: sha512-EX67y+ukNNfFrOLyjYGw8AMy0JPIlEX1dW60SGUNZWW2hSQyyolX7EqFuHP5LtXLjJHNfzx5SMBVQ3owaQCNDw==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': ^1.3.0
+
+  '@opentelemetry/propagator-b3@1.30.1':
+    resolution: {integrity: sha512-oATwWWDIJzybAZ4pO76ATN5N6FFbOA1otibAVlS8v90B4S1wClnhRUk7K+2CHAwN1JKYuj4jh/lpCEG5BAqFuQ==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.0.0 <1.10.0'
+
+  '@opentelemetry/propagator-jaeger@1.30.1':
+    resolution: {integrity: sha512-Pj/BfnYEKIOImirH76M4hDaBSx6HyZ2CXUqk+Kj02m6BB80c/yo4BdWkn/1gDFfU+YPY+bPR2U0DKBfdxCKwmg==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.0.0 <1.10.0'
+
+  '@opentelemetry/resources@1.30.1':
+    resolution: {integrity: sha512-5UxZqiAgLYGFjS4s9qm5mBVo433u+dSPUFWVWXmLAD4wB65oMCoXaJP1KJa9DIYYMeHu3z4BZcStG3LC593cWA==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.0.0 <1.10.0'
+
+  '@opentelemetry/sdk-logs@0.57.1':
+    resolution: {integrity: sha512-jGdObb/BGWu6Peo3cL3skx/Rl1Ak/wDDO3vpPrrThGbqE7isvkCsX6uE+OAt8Ayjm9YC8UGkohWbLR09JmM0FA==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.4.0 <1.10.0'
+
+  '@opentelemetry/sdk-metrics@1.30.1':
+    resolution: {integrity: sha512-q9zcZ0Okl8jRgmy7eNW3Ku1XSgg3sDLa5evHZpCwjspw7E8Is4K/haRPDJrBcX3YSn/Y7gUvFnByNYEKQNbNog==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.3.0 <1.10.0'
+
+  '@opentelemetry/sdk-trace-base@1.30.1':
+    resolution: {integrity: sha512-jVPgBbH1gCy2Lb7X0AVQ8XAfgg0pJ4nvl8/IiQA6nxOsPvS+0zMJaFSs2ltXe0J6C8dqjcnpyqINDJmU30+uOg==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.0.0 <1.10.0'
+
+  '@opentelemetry/sdk-trace-node@1.30.1':
+    resolution: {integrity: sha512-cBjYOINt1JxXdpw1e5MlHmFRc5fgj4GW/86vsKFxJCJ8AL4PdVtYH41gWwl4qd4uQjqEL1oJVrXkSy5cnduAnQ==}
+    engines: {node: '>=14'}
+    peerDependencies:
+      '@opentelemetry/api': '>=1.0.0 <1.10.0'
+
+  '@opentelemetry/semantic-conventions@1.28.0':
+    resolution: {integrity: sha512-lp4qAiMTD4sNWW4DbKLBkfiMZ4jbAboJIGOQr5DvciMRI494OapieI9qiODpOt0XBr1LjIDy1xAGAnVs5supTA==}
+    engines: {node: '>=14'}
+
   '@openzeppelin/contracts@5.2.0':
     resolution: {integrity: sha512-bxjNie5z89W1Ea0NZLZluFh8PrFNn9DH8DQlujEok2yjsOlraUPKID5p1Wk3qdNbf6XkQ1Os2RvfiHrrXLHWKA==}
 
@@ -11645,8 +11746,8 @@ packages:
       '@types/react-dom':
         optional: true
 
-  '@radix-ui/react-avatar@1.1.2':
-    resolution: {integrity: sha512-GaC7bXQZ5VgZvVvsJ5mu/AEbjYLnhhkoidOboC50Z6FFlLA03wG2ianUoH+zgDQ31/9gCF59bE4+2bBgTyMiig==}
+  '@radix-ui/react-arrow@1.1.2':
+    resolution: {integrity: sha512-G+KcpzXHq24iH0uGG/pF8LyzpFJYGD4RfLjCIBfGdSLXvjLHST31RUiRVrupIBMvIppMgSzQ6l66iAxl03tdlg==}
     peerDependencies:
       '@types/react': '*'
       '@types/react-dom': '*'
@@ -11658,8 +11759,8 @@ packages:
       '@types/react-dom':
         optional: true
 
-  '@radix-ui/react-collapsible@1.1.2':
-    resolution: {integrity: sha512-PliMB63vxz7vggcyq0IxNYk8vGDrLXVWw4+W4B8YnwI1s18x7YZYqlG9PLX7XxAJUi0g2DxP4XKJMFHh/iVh9A==}
+  '@radix-ui/react-avatar@1.1.3':
+    resolution: {integrity: sha512-Paen00T4P8L8gd9bNsRMw7Cbaz85oxiv+hzomsRZgFm2byltPFDtfcoqlWJ8GyZlIBWgLssJlzLCnKU0G0302g==}
     peerDependencies:
       '@types/react': '*'
       '@types/react-dom': '*'
@@ -11671,8 +11772,21 @@ packages:
       '@types/react-dom':
         optional: true
 
-  '@radix-ui/react-collection@1.1.1':
-    resolution: {integrity: sha512-LwT3pSho9Dljg+wY2KN2mrrh6y3qELfftINERIzBUO9e0N+t0oMTyn3k9iv+ZqgrwGkRnLpNJrsMv9BZlt2yuA==}
+  '@radix-ui/react-collapsible@1.1.3':
+    resolution: {integrity: sha512-jFSerheto1X03MUC0g6R7LedNW9EEGWdg9W1+MlpkMLwGkgkbUXLPBH/KIuWKXUoeYRVY11llqbTBDzuLg7qrw==}
+    peerDependencies:
+      '@types/react': '*'
+      '@types/react-dom': '*'
+      react: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
+      react-dom: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
+    peerDependenciesMeta:
+      '@types/react':
+        optional: true
+      '@types/react-dom':
+        optional: true
+
+  '@radix-ui/react-collection@1.1.2':
+    resolution: {integrity: sha512-9z54IEKRxIa9VityapoEYMuByaG42iSy1ZXlY2KcuLSEtq8x4987/N6m15ppoMffgZX72gER2uHe1D9Y6Unlcw==}
     peerDependencies:
       '@types/react': '*'
       '@types/react-dom': '*'
@@ -11715,6 +11829,19 @@ packages:
       '@types/react-dom':
         optional: true
 
+  '@radix-ui/react-dialog@1.1.6':
+    resolution: {integrity: sha512-/IVhJV5AceX620DUJ4uYVMymzsipdKBzo3edo+omeskCKGm9FRHM0ebIdbPnlQVJqyuHbuBltQUOG2mOTq2IYw==}
+    peerDependencies:
+      '@types/react': '*'
+      '@types/react-dom': '*'
+      react: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
+      react-dom: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
+    peerDependenciesMeta:
+      '@types/react':
+        optional: true
+      '@types/react-dom':
+        optional: true
+
   '@radix-ui/react-direction@1.1.0':
     resolution: {integrity: sha512-BUuBvgThEiAXh2DWu93XsT+a3aWrGqolGlqqw5VU1kG7p/ZH2cuDlM1sRLNnY3QcBS69UIz2mcKhMxDsdewhjg==}
     peerDependencies:
@@ -11737,6 +11864,19 @@ packages:
       '@types/react-dom':
         optional: true
 
+  '@radix-ui/react-dismissable-layer@1.1.5':
+    resolution: {integrity: sha512-E4TywXY6UsXNRhFrECa5HAvE5/4BFcGyfTyK36gP+pAW1ed7UTK4vKwdr53gAJYwqbfCWC6ATvJa3J3R/9+Qrg==}
+    peerDependencies:
+      '@types/react': '*'
+      '@types/react-dom': '*'
+      react: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
+      react-dom: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
+    peerDependenciesMeta:
+      '@types/react':
+        optional: true
+      '@types/react-dom':
+        optional: true
+
   '@radix-ui/react-focus-guards@1.1.1':
     resolution: {integrity: sha512-pSIwfrT1a6sIoDASCSpFwOasEwKTZWDw/iBdtnqKO7v6FeOzYJ7U53cPzYFVR3geGGXgVHaH+CdngrrAzqUGxg==}
     peerDependencies:
@@ -11759,6 +11899,19 @@ packages:
       '@types/react-dom':
         optional: true
 
+  '@radix-ui/react-focus-scope@1.1.2':
+    resolution: {integrity: sha512-zxwE80FCU7lcXUGWkdt6XpTTCKPitG1XKOwViTxHVKIJhZl9MvIl2dVHeZENCWD9+EdWv05wlaEkRXUykU27RA==}
+    peerDependencies:
+      '@types/react': '*'
+      '@types/react-dom': '*'
+      react: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
+      react-dom: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
+    peerDependenciesMeta:
+      '@types/react':
+        optional: true
+      '@types/react-dom':
+        optional: true
+
   '@radix-ui/react-icons@1.3.2':
     resolution: {integrity: sha512-fyQIhGDhzfc9pK2kH6Pl9c4BDJGfMkPqkyIgYDthyNYoNg3wVhoJMMh19WS4Up/1KMPFVpNsT2q3WmXn2N1m6g==}
     peerDependencies:
@@ -11773,8 +11926,8 @@ packages:
       '@types/react':
         optional: true
 
-  '@radix-ui/react-label@2.1.1':
-    resolution: {integrity: sha512-UUw5E4e/2+4kFMH7+YxORXGWggtY6sM8WIwh5RZchhLuUg2H1hc98Py+pr8HMz6rdaYrK2t296ZEjYLOCO5uUw==}
+  '@radix-ui/react-label@2.1.2':
+    resolution: {integrity: sha512-zo1uGMTaNlHehDyFQcDZXRJhUPDuukcnHz0/jnrup0JA6qL+AFpAnty+7VKa9esuU5xTblAZzTGYJKSKaBxBhw==}
     peerDependencies:
       '@types/react': '*'
       '@types/react-dom': '*'
@@ -11799,6 +11952,19 @@ packages:
       '@types/react-dom':
         optional: true
 
+  '@radix-ui/react-popper@1.2.2':
+    resolution: {integrity: sha512-Rvqc3nOpwseCyj/rgjlJDYAgyfw7OC1tTkKn2ivhaMGcYt8FSBlahHOZak2i3QwkRXUXgGgzeEe2RuqeEHuHgA==}
+    peerDependencies:
+      '@types/react': '*'
+      '@types/react-dom': '*'
+      react: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
+      react-dom: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
+    peerDependenciesMeta:
+      '@types/react':
+        optional: true
+      '@types/react-dom':
+        optional: true
+
   '@radix-ui/react-portal@1.1.3':
     resolution: {integrity: sha512-NciRqhXnGojhT93RPyDaMPfLH3ZSl4jjIFbZQ1b/vxvZEdHsBZ49wP9w8L3HzUQwep01LcWtkUvm0OVB5JAHTw==}
     peerDependencies:
@@ -11812,6 +11978,19 @@ packages:
       '@types/react-dom':
         optional: true
 
+  '@radix-ui/react-portal@1.1.4':
+    resolution: {integrity: sha512-sn2O9k1rPFYVyKd5LAJfo96JlSGVFpa1fS6UuBJfrZadudiw5tAmru+n1x7aMRQ84qDM71Zh1+SzK5QwU0tJfA==}
+    peerDependencies:
+      '@types/react': '*'
+      '@types/react-dom': '*'
+      react: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
+      react-dom: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
+    peerDependenciesMeta:
+      '@types/react':
+        optional: true
+      '@types/react-dom':
+        optional: true
+
   '@radix-ui/react-presence@1.1.2':
     resolution: {integrity: sha512-18TFr80t5EVgL9x1SwF/YGtfG+l0BS0PRAlCWBDoBEiDQjeKgnNZRVJp/oVBl24sr3Gbfwc/Qpj4OcWTQMsAEg==}
     peerDependencies:
@@ -11838,8 +12017,8 @@ packages:
       '@types/react-dom':
         optional: true
 
-  '@radix-ui/react-roving-focus@1.1.1':
-    resolution: {integrity: sha512-QE1RoxPGJ/Nm8Qmk0PxP8ojmoaS67i0s7hVssS7KuI2FQoc/uzVlZsqKfQvxPE6D8hICCPHJ4D88zNhT3OOmkw==}
+  '@radix-ui/react-primitive@2.0.2':
+    resolution: {integrity: sha512-Ec/0d38EIuvDF+GZjcMU/Ze6MxntVJYO/fRlCPhCaVUyPY9WTalHJw54tp9sXeJo3tlShWpy41vQRgLRGOuz+w==}
     peerDependencies:
       '@types/react': '*'
       '@types/react-dom': '*'
@@ -11851,8 +12030,21 @@ packages:
       '@types/react-dom':
         optional: true
 
-  '@radix-ui/react-separator@1.1.1':
-    resolution: {integrity: sha512-RRiNRSrD8iUiXriq/Y5n4/3iE8HzqgLHsusUSg5jVpU2+3tqcUFPJXHDymwEypunc2sWxDUS3UC+rkZRlHedsw==}
+  '@radix-ui/react-roving-focus@1.1.2':
+    resolution: {integrity: sha512-zgMQWkNO169GtGqRvYrzb0Zf8NhMHS2DuEB/TiEmVnpr5OqPU3i8lfbxaAmC2J/KYuIQxyoQQ6DxepyXp61/xw==}
+    peerDependencies:
+      '@types/react': '*'
+      '@types/react-dom': '*'
+      react: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
+      react-dom: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
+    peerDependenciesMeta:
+      '@types/react':
+        optional: true
+      '@types/react-dom':
+        optional: true
+
+  '@radix-ui/react-separator@1.1.2':
+    resolution: {integrity: sha512-oZfHcaAp2Y6KFBX6I5P1u7CQoy4lheCGiYj+pGFrHy8E/VNRb5E39TkTr3JrV520csPBTZjkuKFdEsjS5EUNKQ==}
     peerDependencies:
       '@types/react': '*'
       '@types/react-dom': '*'
@@ -11873,8 +12065,17 @@ packages:
       '@types/react':
         optional: true
 
-  '@radix-ui/react-tabs@1.1.2':
-    resolution: {integrity: sha512-9u/tQJMcC2aGq7KXpGivMm1mgq7oRJKXphDwdypPd/j21j/2znamPU8WkXgnhUaTrSFNIt8XhOyCAupg8/GbwQ==}
+  '@radix-ui/react-slot@1.1.2':
+    resolution: {integrity: sha512-YAKxaiGsSQJ38VzKH86/BPRC4rh+b1Jpa+JneA5LRE7skmLPNAyeG8kPJj/oo4STLvlrs8vkf/iYyc3A5stYCQ==}
+    peerDependencies:
+      '@types/react': '*'
+      react: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
+    peerDependenciesMeta:
+      '@types/react':
+        optional: true
+
+  '@radix-ui/react-tabs@1.1.3':
+    resolution: {integrity: sha512-9mFyI30cuRDImbmFF6O2KUJdgEOsGh9Vmx9x/Dh9tOhL7BngmQPQfwW4aejKm5OHpfWIdmeV6ySyuxoOGjtNng==}
     peerDependencies:
       '@types/react': '*'
       '@types/react-dom': '*'
@@ -11886,8 +12087,8 @@ packages:
       '@types/react-dom':
         optional: true
 
-  '@radix-ui/react-toast@1.2.5':
-    resolution: {integrity: sha512-ZzUsAaOx8NdXZZKcFNDhbSlbsCUy8qQWmzTdgrlrhhZAOx2ofLtKrBDW9fkqhFvXgmtv560Uj16pkLkqML7SHA==}
+  '@radix-ui/react-toast@1.2.6':
+    resolution: {integrity: sha512-gN4dpuIVKEgpLn1z5FhzT9mYRUitbfZq9XqN/7kkBMUgFTzTG8x/KszWJugJXHcwxckY8xcKDZPz7kG3o6DsUA==}
     peerDependencies:
       '@types/react': '*'
       '@types/react-dom': '*'
@@ -11912,6 +12113,19 @@ packages:
       '@types/react-dom':
         optional: true
 
+  '@radix-ui/react-tooltip@1.1.8':
+    resolution: {integrity: sha512-YAA2cu48EkJZdAMHC0dqo9kialOcRStbtiY4nJPaht7Ptrhcvpo+eDChaM6BIs8kL6a8Z5l5poiqLnXcNduOkA==}
+    peerDependencies:
+      '@types/react': '*'
+      '@types/react-dom': '*'
+      react: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
+      react-dom: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
+    peerDependenciesMeta:
+      '@types/react':
+        optional: true
+      '@types/react-dom':
+        optional: true
+
   '@radix-ui/react-use-callback-ref@1.1.0':
     resolution: {integrity: sha512-CasTfvsy+frcFkbXtSJ2Zu9JHpN8TYKxkgJGWbjiZhFivxaeW7rMeZt7QELGVLaYVfFMsKHjb7Ak0nMEe+2Vfw==}
     peerDependencies:
@@ -11979,6 +12193,19 @@ packages:
       '@types/react-dom':
         optional: true
 
+  '@radix-ui/react-visually-hidden@1.1.2':
+    resolution: {integrity: sha512-1SzA4ns2M1aRlvxErqhLHsBHoS5eI5UUcI2awAMgGUp4LoaoWOKYmvqDY2s/tltuPkh3Yk77YF/r3IRj+Amx4Q==}
+    peerDependencies:
+      '@types/react': '*'
+      '@types/react-dom': '*'
+      react: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
+      react-dom: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
+    peerDependenciesMeta:
+      '@types/react':
+        optional: true
+      '@types/react-dom':
+        optional: true
+
   '@radix-ui/rect@1.1.0':
     resolution: {integrity: sha512-A9+lCBZoaMJlVKcRBz2YByCG+Cp2t6nAnMnNba+XiWxnj6r4JUFqfsgwocMBZU9LPtdxC6wB56ySYpc7LQIoJg==}
 
@@ -12214,98 +12441,98 @@ packages:
       rollup:
         optional: true
 
-  '@rollup/rollup-android-arm-eabi@4.34.1':
-    resolution: {integrity: sha512-kwctwVlswSEsr4ljpmxKrRKp1eG1v2NAhlzFzDf1x1OdYaMjBYjDCbHkzWm57ZXzTwqn8stMXgROrnMw8dJK3w==}
+  '@rollup/rollup-android-arm-eabi@4.34.4':
+    resolution: {integrity: sha512-gGi5adZWvjtJU7Axs//CWaQbQd/vGy8KGcnEaCWiyCqxWYDxwIlAHFuSe6Guoxtd0SRvSfVTDMPd5H+4KE2kKA==}
     cpu: [arm]
     os: [android]
 
-  '@rollup/rollup-android-arm64@4.34.1':
-    resolution: {integrity: sha512-4H5ZtZitBPlbPsTv6HBB8zh1g5d0T8TzCmpndQdqq20Ugle/nroOyDMf9p7f88Gsu8vBLU78/cuh8FYHZqdXxw==}
+  '@rollup/rollup-android-arm64@4.34.4':
+    resolution: {integrity: sha512-1aRlh1gqtF7vNPMnlf1vJKk72Yshw5zknR/ZAVh7zycRAGF2XBMVDAHmFQz/Zws5k++nux3LOq/Ejj1WrDR6xg==}
     cpu: [arm64]
     os: [android]
 
-  '@rollup/rollup-darwin-arm64@4.34.1':
-    resolution: {integrity: sha512-f2AJ7Qwx9z25hikXvg+asco8Sfuc5NCLg8rmqQBIOUoWys5sb/ZX9RkMZDPdnnDevXAMJA5AWLnRBmgdXGEUiA==}
+  '@rollup/rollup-darwin-arm64@4.34.4':
+    resolution: {integrity: sha512-drHl+4qhFj+PV/jrQ78p9ch6A0MfNVZScl/nBps5a7u01aGf/GuBRrHnRegA9bP222CBDfjYbFdjkIJ/FurvSQ==}
     cpu: [arm64]
     os: [darwin]
 
-  '@rollup/rollup-darwin-x64@4.34.1':
-    resolution: {integrity: sha512-+/2JBrRfISCsWE4aEFXxd+7k9nWGXA8+wh7ZUHn/u8UDXOU9LN+QYKKhd57sIn6WRcorOnlqPMYFIwie/OHXWw==}
+  '@rollup/rollup-darwin-x64@4.34.4':
+    resolution: {integrity: sha512-hQqq/8QALU6t1+fbNmm6dwYsa0PDD4L5r3TpHx9dNl+aSEMnIksHZkSO3AVH+hBMvZhpumIGrTFj8XCOGuIXjw==}
     cpu: [x64]
     os: [darwin]
 
-  '@rollup/rollup-freebsd-arm64@4.34.1':
-    resolution: {integrity: sha512-SUeB0pYjIXwT2vfAMQ7E4ERPq9VGRrPR7Z+S4AMssah5EHIilYqjWQoTn5dkDtuIJUSTs8H+C9dwoEcg3b0sCA==}
+  '@rollup/rollup-freebsd-arm64@4.34.4':
+    resolution: {integrity: sha512-/L0LixBmbefkec1JTeAQJP0ETzGjFtNml2gpQXA8rpLo7Md+iXQzo9kwEgzyat5Q+OG/C//2B9Fx52UxsOXbzw==}
     cpu: [arm64]
     os: [freebsd]
 
-  '@rollup/rollup-freebsd-x64@4.34.1':
-    resolution: {integrity: sha512-L3T66wAZiB/ooiPbxz0s6JEX6Sr2+HfgPSK+LMuZkaGZFAFCQAHiP3dbyqovYdNaiUXcl9TlgnIbcsIicAnOZg==}
+  '@rollup/rollup-freebsd-x64@4.34.4':
+    resolution: {integrity: sha512-6Rk3PLRK+b8L/M6m/x6Mfj60LhAUcLJ34oPaxufA+CfqkUrDoUPQYFdRrhqyOvtOKXLJZJwxlOLbQjNYQcRQfw==}
     cpu: [x64]
     os: [freebsd]
 
-  '@rollup/rollup-linux-arm-gnueabihf@4.34.1':
-    resolution: {integrity: sha512-UBXdQ4+ATARuFgsFrQ+tAsKvBi/Hly99aSVdeCUiHV9dRTTpMU7OrM3WXGys1l40wKVNiOl0QYY6cZQJ2xhKlQ==}
+  '@rollup/rollup-linux-arm-gnueabihf@4.34.4':
+    resolution: {integrity: sha512-kmT3x0IPRuXY/tNoABp2nDvI9EvdiS2JZsd4I9yOcLCCViKsP0gB38mVHOhluzx+SSVnM1KNn9k6osyXZhLoCA==}
     cpu: [arm]
     os: [linux]
 
-  '@rollup/rollup-linux-arm-musleabihf@4.34.1':
-    resolution: {integrity: sha512-m/yfZ25HGdcCSwmopEJm00GP7xAUyVcBPjttGLRAqZ60X/bB4Qn6gP7XTwCIU6bITeKmIhhwZ4AMh2XLro+4+w==}
+  '@rollup/rollup-linux-arm-musleabihf@4.34.4':
+    resolution: {integrity: sha512-3iSA9tx+4PZcJH/Wnwsvx/BY4qHpit/u2YoZoXugWVfc36/4mRkgGEoRbRV7nzNBSCOgbWMeuQ27IQWgJ7tRzw==}
     cpu: [arm]
     os: [linux]
 
-  '@rollup/rollup-linux-arm64-gnu@4.34.1':
-    resolution: {integrity: sha512-Wy+cUmFuvziNL9qWRRzboNprqSQ/n38orbjRvd6byYWridp5TJ3CD+0+HUsbcWVSNz9bxkDUkyASGP0zS7GAvg==}
+  '@rollup/rollup-linux-arm64-gnu@4.34.4':
+    resolution: {integrity: sha512-7CwSJW+sEhM9sESEk+pEREF2JL0BmyCro8UyTq0Kyh0nu1v0QPNY3yfLPFKChzVoUmaKj8zbdgBxUhBRR+xGxg==}
     cpu: [arm64]
     os: [linux]
 
-  '@rollup/rollup-linux-arm64-musl@4.34.1':
-    resolution: {integrity: sha512-CQ3MAGgiFmQW5XJX5W3wnxOBxKwFlUAgSXFA2SwgVRjrIiVt5LHfcQLeNSHKq5OEZwv+VCBwlD1+YKCjDG8cpg==}
+  '@rollup/rollup-linux-arm64-musl@4.34.4':
+    resolution: {integrity: sha512-GZdafB41/4s12j8Ss2izofjeFXRAAM7sHCb+S4JsI9vaONX/zQ8cXd87B9MRU/igGAJkKvmFmJJBeeT9jJ5Cbw==}
     cpu: [arm64]
     os: [linux]
 
-  '@rollup/rollup-linux-loongarch64-gnu@4.34.1':
-    resolution: {integrity: sha512-rSzb1TsY4lSwH811cYC3OC2O2mzNMhM13vcnA7/0T6Mtreqr3/qs6WMDriMRs8yvHDI54qxHgOk8EV5YRAHFbw==}
+  '@rollup/rollup-linux-loongarch64-gnu@4.34.4':
+    resolution: {integrity: sha512-uuphLuw1X6ur11675c2twC6YxbzyLSpWggvdawTUamlsoUv81aAXRMPBC1uvQllnBGls0Qt5Siw8reSIBnbdqQ==}
     cpu: [loong64]
     os: [linux]
 
-  '@rollup/rollup-linux-powerpc64le-gnu@4.34.1':
-    resolution: {integrity: sha512-fwr0n6NS0pG3QxxlqVYpfiY64Fd1Dqd8Cecje4ILAV01ROMp4aEdCj5ssHjRY3UwU7RJmeWd5fi89DBqMaTawg==}
+  '@rollup/rollup-linux-powerpc64le-gnu@4.34.4':
+    resolution: {integrity: sha512-KvLEw1os2gSmD6k6QPCQMm2T9P2GYvsMZMRpMz78QpSoEevHbV/KOUbI/46/JRalhtSAYZBYLAnT9YE4i/l4vg==}
     cpu: [ppc64]
     os: [linux]
 
-  '@rollup/rollup-linux-riscv64-gnu@4.34.1':
-    resolution: {integrity: sha512-4uJb9qz7+Z/yUp5RPxDGGGUcoh0PnKF33QyWgEZ3X/GocpWb6Mb+skDh59FEt5d8+Skxqs9mng6Swa6B2AmQZg==}
+  '@rollup/rollup-linux-riscv64-gnu@4.34.4':
+    resolution: {integrity: sha512-wcpCLHGM9yv+3Dql/CI4zrY2mpQ4WFergD3c9cpRowltEh5I84pRT/EuHZsG0In4eBPPYthXnuR++HrFkeqwkA==}
     cpu: [riscv64]
     os: [linux]
 
-  '@rollup/rollup-linux-s390x-gnu@4.34.1':
-    resolution: {integrity: sha512-QlIo8ndocWBEnfmkYqj8vVtIUpIqJjfqKggjy7IdUncnt8BGixte1wDON7NJEvLg3Kzvqxtbo8tk+U1acYEBlw==}
+  '@rollup/rollup-linux-s390x-gnu@4.34.4':
+    resolution: {integrity: sha512-nLbfQp2lbJYU8obhRQusXKbuiqm4jSJteLwfjnunDT5ugBKdxqw1X9KWwk8xp1OMC6P5d0WbzxzhWoznuVK6XA==}
     cpu: [s390x]
     os: [linux]
 
-  '@rollup/rollup-linux-x64-gnu@4.34.1':
-    resolution: {integrity: sha512-hzpleiKtq14GWjz3ahWvJXgU1DQC9DteiwcsY4HgqUJUGxZThlL66MotdUEK9zEo0PK/2ADeZGM9LIondE302A==}
+  '@rollup/rollup-linux-x64-gnu@4.34.4':
+    resolution: {integrity: sha512-JGejzEfVzqc/XNiCKZj14eb6s5w8DdWlnQ5tWUbs99kkdvfq9btxxVX97AaxiUX7xJTKFA0LwoS0KU8C2faZRg==}
     cpu: [x64]
     os: [linux]
 
-  '@rollup/rollup-linux-x64-musl@4.34.1':
-    resolution: {integrity: sha512-jqtKrO715hDlvUcEsPn55tZt2TEiBvBtCMkUuU0R6fO/WPT7lO9AONjPbd8II7/asSiNVQHCMn4OLGigSuxVQA==}
+  '@rollup/rollup-linux-x64-musl@4.34.4':
+    resolution: {integrity: sha512-/iFIbhzeyZZy49ozAWJ1ZR2KW6ZdYUbQXLT4O5n1cRZRoTpwExnHLjlurDXXPKEGxiAg0ujaR9JDYKljpr2fDg==}
     cpu: [x64]
     os: [linux]
 
-  '@rollup/rollup-win32-arm64-msvc@4.34.1':
-    resolution: {integrity: sha512-RnHy7yFf2Wz8Jj1+h8klB93N0NHNHXFhNwAmiy9zJdpY7DE01VbEVtPdrK1kkILeIbHGRJjvfBDBhnxBr8kD4g==}
+  '@rollup/rollup-win32-arm64-msvc@4.34.4':
+    resolution: {integrity: sha512-qORc3UzoD5UUTneiP2Afg5n5Ti1GAW9Gp5vHPxzvAFFA3FBaum9WqGvYXGf+c7beFdOKNos31/41PRMUwh1tpA==}
     cpu: [arm64]
     os: [win32]
 
-  '@rollup/rollup-win32-ia32-msvc@4.34.1':
-    resolution: {integrity: sha512-i7aT5HdiZIcd7quhzvwQ2oAuX7zPYrYfkrd1QFfs28Po/i0q6kas/oRrzGlDhAEyug+1UfUtkWdmoVlLJj5x9Q==}
+  '@rollup/rollup-win32-ia32-msvc@4.34.4':
+    resolution: {integrity: sha512-5g7E2PHNK2uvoD5bASBD9aelm44nf1w4I5FEI7MPHLWcCSrR8JragXZWgKPXk5i2FU3JFfa6CGZLw2RrGBHs2Q==}
     cpu: [ia32]
     os: [win32]
 
-  '@rollup/rollup-win32-x64-msvc@4.34.1':
-    resolution: {integrity: sha512-k3MVFD9Oq+laHkw2N2v7ILgoa9017ZMF/inTtHzyTVZjYs9cSH18sdyAf6spBAJIGwJ5UaC7et2ZH1WCdlhkMw==}
+  '@rollup/rollup-win32-x64-msvc@4.34.4':
+    resolution: {integrity: sha512-p0scwGkR4kZ242xLPBuhSckrJ734frz6v9xZzD+kHVYRAkSUmdSLCIJRfql6H5//aF8Q10K+i7q8DiPfZp0b7A==}
     cpu: [x64]
     os: [win32]
 
@@ -13521,8 +13748,8 @@ packages:
   '@swc/types@0.1.17':
     resolution: {integrity: sha512-V5gRru+aD8YVyCOMAjMpWR1Ui577DD5KSJsHP8RAxopAH22jFz6GZd/qxqjO6MJHQhcsjvjOFXyDhyLQUnMveQ==}
 
-  '@switchboard-xyz/common@2.5.17':
-    resolution: {integrity: sha512-RxG+eCc7+SYKK5TMamY/FU+vlOwZgQTFJXN2dvo3PqN/3f/rWUvqa/WSzeyzw8gnaK+6eDw3gyaXVMs234zuhw==}
+  '@switchboard-xyz/common@2.5.18':
+    resolution: {integrity: sha512-IPrdMrLWUnvPlE3AO2gead19qxYOG8giPRxUHaf9+Jq6jsFCPOS6EFeNBCflf+Ozd01zImQqrE5I6nkUoBjXeg==}
     engines: {node: '>=12'}
 
   '@switchboard-xyz/on-demand@1.2.42':
@@ -13537,17 +13764,9 @@ packages:
     resolution: {integrity: sha512-+PmQX0PiAYPMeVYe237LJAYvOMYW1j2rH5YROyS3b4CTVJum34HfRvKvAzozHAQG0TnHNdUfY9nCeUyRAs//cw==}
     engines: {node: '>=14.16'}
 
-  '@tanstack/query-core@5.65.0':
-    resolution: {integrity: sha512-Bnnq/1axf00r2grRT6gUyIkZRKzhHs+p4DijrCQ3wMlA3D3TTT71gtaSLtqnzGddj73/7X5JDGyjiSLdjvQN4w==}
-
   '@tanstack/query-core@5.66.0':
     resolution: {integrity: sha512-J+JeBtthiKxrpzUu7rfIPDzhscXF2p5zE/hVdrqkACBP8Yu0M96mwJ5m/8cPPYQE9aRNvXztXHlNwIh4FEeMZw==}
 
-  '@tanstack/react-query@5.65.1':
-    resolution: {integrity: sha512-BSpjo4RQdJ75Mw3pqM1AJYNhanNxJE3ct7RmCZUAv9cUJg/Qmonzc/Xy2kKXeQA1InuKATSuc6pOZciWOF8TYQ==}
-    peerDependencies:
-      react: ^18 || ^19
-
   '@tanstack/react-query@5.66.0':
     resolution: {integrity: sha512-z3sYixFQJe8hndFnXgWu7C79ctL+pI0KAelYyW+khaNJ1m22lWrhJU2QrsTcRKMuVPtoZvfBYrTStIdKo+x0Xw==}
     peerDependencies:
@@ -13764,8 +13983,8 @@ packages:
   '@types/d3-interpolate@3.0.4':
     resolution: {integrity: sha512-mgLPETlrpVV1YRJIglr4Ez47g7Yxjl1lj7YKsiMCb27VJH9W8NVM6Bb9d8kkpG/uAQS5AmbA48q2IAolKKo1MA==}
 
-  '@types/d3-path@3.1.0':
-    resolution: {integrity: sha512-P2dlU/q51fkOc/Gfl3Ul9kicV7l+ra934qBFXCFhrZMOL6du1TM0pm1ThYvENukyOn5h9v+yMJ9Fn5JK4QozrQ==}
+  '@types/d3-path@3.1.1':
+    resolution: {integrity: sha512-VMZBYyQvbGmWyWVea0EHs/BwLgxc+MKi1zLDCONksozI4YJMcTt8ZEuIR4Sb1MMTE8MMW49v0IwI5+b7RmfWlg==}
 
   '@types/d3-polygon@3.0.2':
     resolution: {integrity: sha512-ZuWOtMaHCkN9xoeEMr1ubW2nGWsp4nIql+OPQRstu4ypeZ+zk3YKqQT0CXVe/PYqrKpZAi+J9mTs05TKwjXSRA==}
@@ -13779,8 +13998,8 @@ packages:
   '@types/d3-scale-chromatic@3.1.0':
     resolution: {integrity: sha512-iWMJgwkK7yTRmWqRB5plb1kadXyQ5Sj8V/zYlFGMUBbIPKQScw+Dku9cAAMgJG+z5GYDoMjWGLVOvjghDEFnKQ==}
 
-  '@types/d3-scale@4.0.8':
-    resolution: {integrity: sha512-gkK1VVTr5iNiYJ7vWDI+yUFFlszhNMtVeneJ6lUTKPjprsvLLI9/tgEGiXJOnlINJA8FyA88gfnQsHbybVZrYQ==}
+  '@types/d3-scale@4.0.9':
+    resolution: {integrity: sha512-dLmtwB8zkAeO/juAMfnV+sItKjlsw2lKdZVVy6LRr0cBmegxSABiLEpGVmSJJ8O08i4+sGR6qQtb6WtuwJdvVw==}
 
   '@types/d3-selection@3.0.11':
     resolution: {integrity: sha512-bhAXu23DJWsrI45xafYpkQ4NtcKMwWnAC/vKrd2l+nxMFuvOT3XMYTIj2opv8vq8AO5Yh7Qac/nSeP/3zjTK0w==}
@@ -14010,8 +14229,8 @@ packages:
   '@types/node@12.20.55':
     resolution: {integrity: sha512-J8xLz7q2OFulZ2cyGTLE1TbbZcjpno7FaN6zdJNrgAdrJ+DZzh/uFR6YrTb4C+nXakvud8Q4+rbhoIWlYQbUFQ==}
 
-  '@types/node@16.18.125':
-    resolution: {integrity: sha512-w7U5ojboSPfZP4zD98d+/cjcN2BDW6lKH2M0ubipt8L8vUC7qUAC6ENKGSJL4tEktH2Saw2K4y1uwSjyRGKMhw==}
+  '@types/node@16.18.126':
+    resolution: {integrity: sha512-OTcgaiwfGFBKacvfwuHzzn1KLxH/er8mluiy8/uM3sGXHaRe73RrSIj01jow9t4kJEW633Ov+cOexXeiApTyAw==}
 
   '@types/node@17.0.45':
     resolution: {integrity: sha512-w+tIMs3rq2afQdsPJlODhoUEKzFP1ayaoyl1CcnwtIlsVe7K7bA1NGm4s3PraqTLlXnbIN84zuBlxBWo1u9BLw==}
@@ -14019,14 +14238,14 @@ packages:
   '@types/node@18.15.13':
     resolution: {integrity: sha512-N+0kuo9KgrUQ1Sn/ifDXsvg0TTleP7rIy4zOBGECxAljqvqfqpTfzx0Q1NUedOixRMBfe2Whhb056a42cWs26Q==}
 
-  '@types/node@18.19.74':
-    resolution: {integrity: sha512-HMwEkkifei3L605gFdV+/UwtpxP6JSzM+xFk2Ia6DNFSwSVBRh9qp5Tgf4lNFOMfPVuU0WnkcWpXZpgn5ufO4A==}
+  '@types/node@18.19.75':
+    resolution: {integrity: sha512-UIksWtThob6ZVSyxcOqCLOUNg/dyO1Qvx4McgeuhrEtHTLFTf7BBhEazaE4K806FGTPtzd/2sE90qn4fVr7cyw==}
 
   '@types/node@20.17.9':
     resolution: {integrity: sha512-0JOXkRyLanfGPE2QRCwgxhzlBAvaRdCNMcvbd7jFfpmD4eEXll7LRwy5ymJmyeZqk7Nh7eD2LeUyQ68BbndmXw==}
 
-  '@types/node@22.13.0':
-    resolution: {integrity: sha512-ClIbNe36lawluuvq3+YYhnIN2CELi+6q8NpnM7PYp4hBn/TatfboPgVSm2rwKRfnV2M+Ty9GWDFI64KEe+kysA==}
+  '@types/node@22.13.1':
+    resolution: {integrity: sha512-jK8uzQlrvXqEU91UxiK5J7pKHyzgnI1Qnl0QDHIgVGuolJhRb9EEl28Cj9b3rGR8B2lhFCtvIm5os8lFnO/1Ew==}
 
   '@types/node@22.7.5':
     resolution: {integrity: sha512-jML7s2NAzMWc//QSJ1a3prpk78cOPchGvXJsC3C6R6PSMoooztvRVQEz89gmBTBY1SPMaqo5teB4uNHPdetShQ==}
@@ -14722,8 +14941,8 @@ packages:
     resolution: {integrity: sha512-RaI5qZo6D2CVS6sTHFKg1v5Ohq/+Bo2LZ5gzUEwZ/WkHhwtGTCB/sVLw8ijOkAUxasZ+WshN/Rzj4ywsABJ5ZA==}
     engines: {node: '>=v14.0.0', npm: '>=7.0.0'}
 
-  '@voltr/vault-sdk@0.1.4':
-    resolution: {integrity: sha512-QP4GaLmRDAUs1AKt5Vcj++ZXAaSlSwqSnPtGezaZ2JBko/WVBAiRmdMs+L6FgsZq2n1W5jHvT7I94hDtFt1VMw==}
+  '@voltr/vault-sdk@0.1.5':
+    resolution: {integrity: sha512-m0nlq36IqGZEU2U1yH5tNwHgCcTpR76cDlESEixmQo5+mDAVtOkhpbUEzaegsyt7amQyjrG+1wkF7ktLeVrotA==}
 
   '@vue/compiler-core@3.5.13':
     resolution: {integrity: sha512-oOdAkwqUfW1WqpwSYJce06wvt6HljgY3fGeM9NcVA1HaYOij3mZG9Rkysn0OHuyUAGMbEbARIpsG+LPVlBJ5/Q==}
@@ -15302,8 +15521,8 @@ packages:
     peerDependencies:
       algoliasearch: '>= 3.1 < 6'
 
-  algoliasearch@5.20.0:
-    resolution: {integrity: sha512-groO71Fvi5SWpxjI9Ia+chy0QBwT61mg6yxJV27f5YFf+Mw+STT75K6SHySpP8Co5LsCrtsbCH5dJZSRtkSKaQ==}
+  algoliasearch@5.20.1:
+    resolution: {integrity: sha512-SiCOCVBCQUg/aWkfMnjT+8TQxNNFlPZTI7v8y4+aZXzJg6zDIzKy9KcYVS4sc+xk5cwW5hyJ+9z836f4+wvgzA==}
     engines: {node: '>= 14.0.0'}
 
   algosdk@1.24.1:
@@ -15580,8 +15799,8 @@ packages:
     resolution: {integrity: sha512-Izi8RQcffqCeNVgFigKli1ssklIbpHnCYc6AknXGYoB6grJqyeby7jv12JUQgmTAnIDnbck1uxksT4dzN3PWBA==}
     engines: {node: '>=12'}
 
-  assertion-tools@8.0.0-gamma.2:
-    resolution: {integrity: sha512-X9uyTTZiux5NClP25AG0RjhMD2AB8FVy15NW/2JbdJEDKRwUsLTddzYRDdQWFtMv4+TOq+GWe6P2CkCzqN096Q==}
+  assertion-tools@8.0.1:
+    resolution: {integrity: sha512-9LJf5O3X30/UcDs5FyBJ+pLJl3dWbIKgTC3REMuJjhqtTMu7W3Dl0AOPg/HBxWYIYMPjBQtSK6KUKdpX6QrHHg==}
 
   ast-types-flow@0.0.8:
     resolution: {integrity: sha512-OH/2E5Fg20h2aPrbe+QL8JZQFko0YZaF+j4mnQ7BGhfavO7OpSLa8a0y9sBwomHdSbkhTS8TQNayBfnW5DwbvQ==}
@@ -16368,8 +16587,8 @@ packages:
   caniuse-api@3.0.0:
     resolution: {integrity: sha512-bsTwuIg/BZZK/vreVTYYbSWoe2F+71P7K5QGEX+pT250DZbfU1MQ5prOKpPR+LL6uWKK3KMwMCAS74QB3Um1uw==}
 
-  caniuse-lite@1.0.30001696:
-    resolution: {integrity: sha512-pDCPkvzfa39ehJtJ+OwGT/2yvT2SbjfHhiIW2LWOAcMQ7BzwxT/XuyUp4OTOd0XFWA6BKw0JalnBHgSi5DGJBQ==}
+  caniuse-lite@1.0.30001697:
+    resolution: {integrity: sha512-GwNPlWJin8E+d7Gxq96jxM6w0w+VFeyyXRsjU58emtkYqnbwHqXm5uT2uCmO0RQE9htWknOP4xtBlLmM/gWxvQ==}
 
   canonicalize@1.0.8:
     resolution: {integrity: sha512-0CNTVCLZggSh7bc5VkX5WWPWO+cyZbNd07IHIsSXLia/eAq+r836hgk+8BKoEh7949Mda87VUOitx5OddVj64A==}
@@ -16409,8 +16628,8 @@ packages:
     resolution: {integrity: sha512-aGtmf24DW6MLHHG5gCx4zaI3uBq3KRtxeVs0DjFH6Z0rDNbsvTxFASFvdj79pxjxZ8/5u3PIiN3IwEIQkiiuPw==}
     engines: {node: '>=12'}
 
-  chain-registry@1.69.113:
-    resolution: {integrity: sha512-BFnSEy9bod47qEzpDrV+BGSe5Tlno/afjBG2X7J2IrNC13w3bJ6EF/1vOlQobpLprFrr3z1kCGy0HORujdRP8A==}
+  chain-registry@1.69.116:
+    resolution: {integrity: sha512-2HQg9Zi2kbPl+Uz416yn6Du7te37St7X6bTmVFoewi1zDGhSFJN9aHyjsugQ2e2likVXzsSVvYuZ1zbg3yW3Rg==}
 
   chalk@1.1.3:
     resolution: {integrity: sha512-U3lRVLMSlsCfjqYPbLyVv11M9CPW4I728d6TCKMAOJueEeB9/8o+eSsMnxPJD+Q+K909sdESg7C+tIkoH6on1A==}
@@ -18071,8 +18290,8 @@ packages:
     engines: {node: '>=0.10.0'}
     hasBin: true
 
-  electron-to-chromium@1.5.91:
-    resolution: {integrity: sha512-sNSHHyq048PFmZY4S90ax61q+gLCs0X0YmcOII9wG9S2XwbVr+h4VW2wWhnbp/Eys3cCwTxVF292W3qPaxIapQ==}
+  electron-to-chromium@1.5.93:
+    resolution: {integrity: sha512-M+29jTcfNNoR9NV7la4SwUqzWAxEwnc7ThA5e1m6LRSotmpfpCpLcIfgtSCVL+MllNLgAyM/5ru86iMRemPzDQ==}
 
   elliptic@6.5.4:
     resolution: {integrity: sha512-iLhC6ULemrljPZb+QutR5TQGB+pdW6KGD5RSegS+8sorOZT+rdQFbsQFJgvN3eRqNALqJer4oQ16YvJHlU8hzQ==}
@@ -18134,8 +18353,8 @@ packages:
     resolution: {integrity: sha512-HqD3yTBfnBxIrbnM1DoD6Pcq8NECnh8d4As1Qgh0z5Gg3jRRIqijury0CL3ghu/edArpUYiYqQiDUQBIs4np3Q==}
     engines: {node: '>=10.0.0'}
 
-  enhanced-resolve@5.18.0:
-    resolution: {integrity: sha512-0/r0MySGYG8YqlayBZ6MuCfECmHFdJ5qyPh8s8wa5Hnm6SaFLSK1VYCbj+NKp090Nm1caZhD+QTnmxO7esYGyQ==}
+  enhanced-resolve@5.18.1:
+    resolution: {integrity: sha512-ZSW3ma5GkcQBIpwZTSRAI8N71Uuwgs93IezB7mf7R60tC8ZbJideoDNKjHn2O9KIlx6rkGTTEk1xUCK2E1Y2Yg==}
     engines: {node: '>=10.13.0'}
 
   enquirer@2.3.6:
@@ -18975,8 +19194,8 @@ packages:
   find@0.3.0:
     resolution: {integrity: sha512-iSd+O4OEYV/I36Zl8MdYJO0xD82wH528SaCieTVHhclgiYNe9y+yPKSwK+A7/WsmHL1EZ+pYUJBXWTL5qofksw==}
 
-  flash-sdk@2.27.1:
-    resolution: {integrity: sha512-MjQnnOv9K5JFms4AZ6MjP2BjDepTa/5XLQY5of1Xyt0Svdmtx8HYgKwRU3K1E/EzFOaxDOaOjxHICpQaojqfvw==}
+  flash-sdk@2.28.10:
+    resolution: {integrity: sha512-xTmEgxYrHOiUScHIzdMzog45T39BIaQxYiT5eooxuCb+pVqchmdXbcazEqwOMyKDhbQSGx6idlhXsdnnLbBDYg==}
 
   flat-cache@3.2.0:
     resolution: {integrity: sha512-CYcENa+FtcUKLmhhqyctpclsq7QF38pKjZHsGNiSQF5r4FtoKDWabFDl3hzaEQMvT1LHEysw5twgLvpYYb4vbw==}
@@ -20182,8 +20401,8 @@ packages:
     resolution: {integrity: sha512-ZMERYes6pDydyuGidse7OsHxtbI7WVeUEozgR/g7rd0xUimYNlvZRE/K2MgZTjWy725IfelLeVcEM97mmtRGXw==}
     engines: {node: '>=8'}
 
-  is-boolean-object@1.2.1:
-    resolution: {integrity: sha512-l9qO6eFlUETHtuihLcYOaLKByJ1f+N4kthcU9YjHy3N+B3hWv0y/2Nd0mu/7lTFnRQHTrSdXF50HQ3bl5fEnng==}
+  is-boolean-object@1.2.2:
+    resolution: {integrity: sha512-wa56o2/ElJMYqjCjGkXri7it5FbebW5usLw/nPmCMs5DeZ7eziSYZhSmPRn0txqeW4LnAmQQU7FgqLpsEFKM4A==}
     engines: {node: '>= 0.4'}
 
   is-buffer@1.1.6:
@@ -20477,8 +20696,8 @@ packages:
     resolution: {integrity: sha512-K5pXYOm9wqY1RgjpL3YTkF39tni1XajUIkawTLUo9EZEVUFga5gSQJF8nNS7ZwJQ02y+1YCNYcMh+HIf1ZqE+w==}
     engines: {node: '>= 0.4'}
 
-  is-weakref@1.1.0:
-    resolution: {integrity: sha512-SXM8Nwyys6nT5WP6pltOwKytLV7FqQ4UiibxVmW+EIosHcmCqkkjViTb5SNssDlkCiEYRP1/pdWUKVvZBmsR2Q==}
+  is-weakref@1.1.1:
+    resolution: {integrity: sha512-6i9mGWSlqzNMEqpCp93KwRS1uUOodk2OJ6b+sq7ZPDSy2WuI5NFIxp/254TytR8ftefexkWn5xNiHUNpPOfSew==}
     engines: {node: '>= 0.4'}
 
   is-weakset@2.0.4:
@@ -21324,8 +21543,8 @@ packages:
       openai:
         optional: true
 
-  langsmith@0.3.4:
-    resolution: {integrity: sha512-Klyy7HtOEh3RqQsKStUfVwE8NMrLCp1+ng50ddeEjJyF5WI+LsgBDIpJGRVjmgNbNeX+rGnUk0kBKIU5gZjVFQ==}
+  langsmith@0.3.6:
+    resolution: {integrity: sha512-FXWbZOZPZsjNfY5DKOO0ORlPhBdysj11cHpO13qf94+R022Rkt+h5YPmiEDqrBI62X4j0mvjLrJ6VN6/HSbPig==}
     peerDependencies:
       openai: '*'
     peerDependenciesMeta:
@@ -21497,6 +21716,10 @@ packages:
     resolution: {integrity: sha512-9rrA30MRRP3gBD3HTGnC6cDFpaE1kVDWxWgqWJUN0RvDNAo+Nz/9GxB+nHOH0ifbVFy0hSA1V6vFDvnx54lTEQ==}
     engines: {node: '>=14'}
 
+  local-pkg@1.0.0:
+    resolution: {integrity: sha512-bbgPw/wmroJsil/GgL4qjDzs5YLTBMQ99weRsok1XCDccQeehbHA/I1oRvk2NPtr7KGZgT/Y5tPRnAtMqeG2Kg==}
+    engines: {node: '>=14'}
+
   locate-character@3.0.0:
     resolution: {integrity: sha512-SW13ws7BjaeJ6p7Q6CO2nchbYEc3X3J6WrmTTDto7yMPqVSZTUyY5Tjbid+Ab8gLnATtygYtiDIJGQRRn2ZOiA==}
 
@@ -22869,8 +23092,8 @@ packages:
     resolution: {integrity: sha512-RSn9F68PjH9HqtltsSnqYC1XXoWe9Bju5+213R98cNGttag9q9yAOTzdbsqvIa7aNm5WffBZFpWYr2aWrklWAw==}
     engines: {node: '>= 6'}
 
-  object-inspect@1.13.3:
-    resolution: {integrity: sha512-kDCGIbxkDSXE3euJZZXzc6to7fCrKHNI/hSRQnRuQ+BWjFNzZwiFF8fj/6o2t2G9/jTj8PSIYTfCLelLZEeRpA==}
+  object-inspect@1.13.4:
+    resolution: {integrity: sha512-W67iLl4J2EXEGTbfeHCffrjDfitvLANg0UlX3wFUUSTx92KXRFegMHUVgSqE+wvhAbi4WqjGg9czysTV2Epbew==}
     engines: {node: '>= 0.4'}
 
   object-is@1.1.6:
@@ -25293,8 +25516,8 @@ packages:
     engines: {node: '>=14.18.0', npm: '>=8.0.0'}
     hasBin: true
 
-  rollup@4.34.1:
-    resolution: {integrity: sha512-iYZ/+PcdLYSGfH3S+dGahlW/RWmsqDhLgj1BT9DH/xXJ0ggZN7xkdP9wipPNjjNLczI+fmMLmTB9pye+d2r4GQ==}
+  rollup@4.34.4:
+    resolution: {integrity: sha512-spF66xoyD7rz3o08sHP7wogp1gZ6itSq22SGa/IZTcUDXDlOyrShwMwkVSB+BUxFRZZCUYqdb3KWDEOMVQZxuw==}
     engines: {node: '>=18.0.0', npm: '>=8.0.0'}
     hasBin: true
 
@@ -26252,8 +26475,8 @@ packages:
   stylis@4.2.0:
     resolution: {integrity: sha512-Orov6g6BB1sDfYgzWfTHDOxamtX1bE/zo104Dh9e6fqJ3PooipYyfJ0pUmrZO2wAvO8YbEyeFrkV91XTsGMSrw==}
 
-  stylis@4.3.5:
-    resolution: {integrity: sha512-K7npNOKGRYuhAFFzkzMGfxFDpN6gDwf8hcMiE+uveTVbBgm93HrNP3ZDUpKqzZ4pG7TP6fmb+EMAQPjq9FqqvA==}
+  stylis@4.3.6:
+    resolution: {integrity: sha512-yQ3rwFWRfwNUY7H5vpU0wfdkNSnvnJinhF9830Swlaxl03zsOjCfmX0ugac+3LtK0lYSgwL/KXc8oYL3mG4YFQ==}
 
   subarg@1.0.0:
     resolution: {integrity: sha512-RIrIdRY0X1xojthNcVtgT9sjpOGagEUKpZdgBUi054OEPFo282yg+zE+t1Rj3+RqKq2xStL7uUHhY+AjbC4BXg==}
@@ -26308,8 +26531,8 @@ packages:
     resolution: {integrity: sha512-ot0WnXS9fgdkgIcePe6RHNk1WA8+muPa6cSjeR3V8K27q9BB1rTE3R1p7Hv0z1ZyAc8s6Vvv8DIyWf681MAt0w==}
     engines: {node: '>= 0.4'}
 
-  svelte@5.19.7:
-    resolution: {integrity: sha512-I0UUp2MpB5gF8aqHJVklOcRcoLgQNnBolSwLMMqDepE9gVwmGeYBmJp1/obzae72QpxdPIymA4AunIm2x70LBg==}
+  svelte@5.19.8:
+    resolution: {integrity: sha512-56Vd/nwJrljV0w7RCV1A8sB4/yjSbWW5qrGDTAzp7q42OxwqEWT+6obWzDt41tHjIW+C9Fs2ygtejjJrXR+ZPA==}
     engines: {node: '>=18'}
 
   svg-parser@2.0.4:
@@ -26323,8 +26546,8 @@ packages:
   swarm-js@0.1.42:
     resolution: {integrity: sha512-BV7c/dVlA3R6ya1lMlSSNPLYrntt0LUq4YMgy3iwpCIc6rZnS5W2wUoctarZ5pXlpKtxDDf9hNziEkcfrxdhqQ==}
 
-  swr@2.3.0:
-    resolution: {integrity: sha512-NyZ76wA4yElZWBHzSgEJc28a0u6QZvhb6w0azeL2k7+Q1gAzVK+IqQYXhVOC/mzi+HZIozrZvBVeSeOZNR2bqA==}
+  swr@2.3.2:
+    resolution: {integrity: sha512-RosxFpiabojs75IwQ316DGoDRmOqtiAj0tg8wCcbEu4CiLZBs/a9QNtHV7TUfDXmmlgqij/NqzKq/eLelyv9xA==}
     peerDependencies:
       react: ^16.11.0 || ^17.0.0 || ^18.0.0 || ^19.0.0
 
@@ -26454,8 +26677,8 @@ packages:
       uglify-js:
         optional: true
 
-  terser@5.37.0:
-    resolution: {integrity: sha512-B8wRRkmre4ERucLM/uXx4MOV5cbnOlVAqUst+1+iLKPI0dOgFO28f84ptoQt9HEI537PMzfYa/d+GEPKTRXmYA==}
+  terser@5.38.0:
+    resolution: {integrity: sha512-a4GD5R1TjEeuCT6ZRiYMHmIf7okbCPEuhQET8bczV6FrQMMlFXA1n+G0KKjdlFCm3TEHV77GxfZB3vZSUQGFpg==}
     engines: {node: '>=10'}
     hasBin: true
 
@@ -26497,8 +26720,8 @@ packages:
   thenify@3.3.1:
     resolution: {integrity: sha512-RVZSIV5IG10Hk3enotrhvz0T9em6cyHBLkH/YAZuKqd8hRkKhSfCGIcP2KUY0EPxndzANBmNllzWPwak+bheSw==}
 
-  thirdweb@5.87.2:
-    resolution: {integrity: sha512-PqDIFCceV1Mpp/N9utLDPxz54gr+AzbBPMbNqy9ZWlB7We8U3oHax0u3pDGqOWzr4R18W9OZdP4HSvsTd855PQ==}
+  thirdweb@5.87.4:
+    resolution: {integrity: sha512-ZVKmSMeOAZQQX/E7Qn+t1d0M0WT2oSm8jCw28zh01j47VKGOYP/teIwkz9PX162BEh2DODuBUUL1p+rUaXihtA==}
     engines: {node: '>=18'}
     hasBin: true
     peerDependencies:
@@ -26580,8 +26803,8 @@ packages:
   thunky@1.1.0:
     resolution: {integrity: sha512-eHY7nBftgThBqOyHGVN+l8gF0BucP09fMo0oO/Lb0w1OF80dJv+lDVpXG60WMQvkcxAkNybKsrEIE3ZtKGmPrA==}
 
-  tiktoken@1.0.19:
-    resolution: {integrity: sha512-vgFTegKSjNIQ9oTMpNTForC6zvOfulgQFAj3h+FMI+wTVXEszhud3W1jllVbvfWcWN6rGPRryCnEfqUIOMpzGw==}
+  tiktoken@1.0.20:
+    resolution: {integrity: sha512-zVIpXp84kth/Ni2me1uYlJgl2RZ2EjxwDaWLeDY/s6fZiyO9n1QoTOM5P7ZSYfToPvAvwYNMbg5LETVYVKyzfQ==}
 
   time-span@5.1.0:
     resolution: {integrity: sha512-75voc/9G4rDIJleOo4jPvN4/YC4GRZrY8yy1uU4lwrB3XEQbWve8zXoO5No4eFrGcTAMYyoY67p8jRQdtA1HbA==}
@@ -26910,8 +27133,8 @@ packages:
   ts-xor@1.3.0:
     resolution: {integrity: sha512-RLXVjliCzc1gfKQFLRpfeD0rrWmjnSTgj7+RFhoq3KRkUYa8LE/TIidYOzM5h+IdFBDSjjSgk9Lto9sdMfDFEA==}
 
-  tsconfck@3.1.4:
-    resolution: {integrity: sha512-kdqWFGVJqe+KGYvlSO9NIaWn9jT1Ny4oKVzAJsKii5eoE9snzTJzL4+MMVOMn+fikWGFmKEylcXL710V/kIPJQ==}
+  tsconfck@3.1.5:
+    resolution: {integrity: sha512-CLDfGgUp7XPswWnezWwsCRxNmgQjhYq3VXHM0/XIRxhVrKw0M1if9agzryh1QS3nxjCROvV+xWxoJO1YctzzWg==}
     engines: {node: ^18 || >=20}
     hasBin: true
     peerDependencies:
@@ -27699,8 +27922,8 @@ packages:
       typescript:
         optional: true
 
-  valibot@1.0.0-beta.14:
-    resolution: {integrity: sha512-tLyV2rE5QL6U29MFy3xt4AqMrn+/HErcp2ZThASnQvPMwfSozjV1uBGKIGiegtZIGjinJqn0SlBdannf18wENA==}
+  valibot@1.0.0-beta.15:
+    resolution: {integrity: sha512-BKy8XosZkDHWmYC+cJG74LBzP++Gfntwi33pP3D3RKztz2XV9jmFWnkOi21GoqARP8wAWARwhV6eTr1JcWzjGw==}
     peerDependencies:
       typescript: '>=5'
     peerDependenciesMeta:
@@ -27879,8 +28102,8 @@ packages:
       terser:
         optional: true
 
-  vite@6.0.11:
-    resolution: {integrity: sha512-4VL9mQPKoHy4+FE0NnRE/kbY51TOfaknxAjt3fJbGJxhIpBZiqVzlZDEesWWsuREXHwNdAoOFZ9MkPEVXczHwg==}
+  vite@6.1.0:
+    resolution: {integrity: sha512-RjjMipCKVoR4hVfPY6GQTgveinjNuyLw+qruksLDvA5ktI1150VmcMBKmQaEWJhg/j6Uaf6dNCNA0AfdzUb/hQ==}
     engines: {node: ^18.0.0 || ^20.0.0 || >=22.0.0}
     hasBin: true
     peerDependencies:
@@ -28943,13 +29166,13 @@ snapshots:
 
   '@0x/contract-addresses@8.13.0': {}
 
-  '@0x/swap-ts-sdk@2.1.1(@types/express@5.0.0)(@types/node@22.13.0)(encoding@0.1.13)':
+  '@0x/swap-ts-sdk@2.1.1(@types/express@5.0.0)(@types/node@22.13.1)(encoding@0.1.13)':
     dependencies:
       '@0x/contract-addresses': 8.13.0
       '@0x/utils': 7.0.0(encoding@0.1.13)
       '@trpc/client': 10.40.0(@trpc/server@10.40.0)
       '@trpc/server': 10.40.0
-      trpc-openapi: 1.2.0(@trpc/server@10.40.0)(@types/express@5.0.0)(@types/node@22.13.0)(zod@3.22.4)
+      trpc-openapi: 1.2.0(@trpc/server@10.40.0)(@types/express@5.0.0)(@types/node@22.13.1)(zod@3.22.4)
       zod: 3.22.4
     transitivePeerDependencies:
       - '@types/express'
@@ -29057,7 +29280,7 @@ snapshots:
       - typescript
       - utf-8-validate
 
-  '@3land/listings-sdk@0.0.7(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(arweave@1.15.5)(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10)':
+  '@3land/listings-sdk@0.0.7(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(arweave@1.15.5)(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10)':
     dependencies:
       '@coral-xyz/borsh': 0.30.1(@solana/web3.js@1.95.5(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))
       '@irys/sdk': 0.2.11(arweave@1.15.5)(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
@@ -29075,7 +29298,7 @@ snapshots:
       fs: 0.0.1-security
       irys: 0.0.1
       node-fetch: 3.3.2
-      ts-node: 10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.7.3)
+      ts-node: 10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.7.3)
       tweetnacl: 1.0.3
     transitivePeerDependencies:
       - '@swc/core'
@@ -29205,7 +29428,7 @@ snapshots:
     dependencies:
       '@ai-sdk/provider-utils': 2.1.6(zod@3.23.8)
       '@ai-sdk/ui-utils': 0.0.50(zod@3.23.8)
-      swr: 2.3.0(react@19.0.0)
+      swr: 2.3.2(react@19.0.0)
       throttleit: 2.1.0
     optionalDependencies:
       react: 19.0.0
@@ -29215,7 +29438,7 @@ snapshots:
     dependencies:
       '@ai-sdk/provider-utils': 2.1.6(zod@3.23.8)
       '@ai-sdk/ui-utils': 1.1.8(zod@3.23.8)
-      swr: 2.3.0(react@19.0.0)
+      swr: 2.3.2(react@19.0.0)
       throttleit: 2.1.0
     optionalDependencies:
       react: 19.0.0
@@ -29225,7 +29448,7 @@ snapshots:
     dependencies:
       '@ai-sdk/provider-utils': 2.1.6(zod@3.24.1)
       '@ai-sdk/ui-utils': 1.1.8(zod@3.24.1)
-      swr: 2.3.0(react@19.0.0)
+      swr: 2.3.2(react@19.0.0)
       throttleit: 2.1.0
     optionalDependencies:
       react: 19.0.0
@@ -29238,13 +29461,13 @@ snapshots:
     transitivePeerDependencies:
       - zod
 
-  '@ai-sdk/svelte@0.0.57(svelte@5.19.7)(zod@3.23.8)':
+  '@ai-sdk/svelte@0.0.57(svelte@5.19.8)(zod@3.23.8)':
     dependencies:
       '@ai-sdk/provider-utils': 2.1.6(zod@3.23.8)
       '@ai-sdk/ui-utils': 0.0.50(zod@3.23.8)
-      sswr: 2.1.0(svelte@5.19.7)
+      sswr: 2.1.0(svelte@5.19.8)
     optionalDependencies:
-      svelte: 5.19.7
+      svelte: 5.19.8
     transitivePeerDependencies:
       - zod
 
@@ -29284,14 +29507,14 @@ snapshots:
     transitivePeerDependencies:
       - zod
 
-  '@akashnetwork/akash-api@1.4.0(@grpc/grpc-js@1.12.5)':
+  '@akashnetwork/akash-api@1.4.0(@grpc/grpc-js@1.12.6)':
     dependencies:
-      '@grpc/grpc-js': 1.12.5
+      '@grpc/grpc-js': 1.12.6
       rxjs: 7.8.1
 
-  '@akashnetwork/akashjs@0.10.1(@grpc/grpc-js@1.12.5)(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)':
+  '@akashnetwork/akashjs@0.10.1(@grpc/grpc-js@1.12.6)(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)':
     dependencies:
-      '@akashnetwork/akash-api': 1.4.0(@grpc/grpc-js@1.12.5)
+      '@akashnetwork/akash-api': 1.4.0(@grpc/grpc-js@1.12.6)
       '@cosmjs/amino': 0.32.4
       '@cosmjs/launchpad': 0.27.1
       '@cosmjs/proto-signing': 0.32.4
@@ -29318,118 +29541,118 @@ snapshots:
       - encoding
       - utf-8-validate
 
-  '@algolia/autocomplete-core@1.17.9(@algolia/client-search@5.20.0)(algoliasearch@5.20.0)(search-insights@2.17.3)':
+  '@algolia/autocomplete-core@1.17.9(@algolia/client-search@5.20.1)(algoliasearch@5.20.1)(search-insights@2.17.3)':
     dependencies:
-      '@algolia/autocomplete-plugin-algolia-insights': 1.17.9(@algolia/client-search@5.20.0)(algoliasearch@5.20.0)(search-insights@2.17.3)
-      '@algolia/autocomplete-shared': 1.17.9(@algolia/client-search@5.20.0)(algoliasearch@5.20.0)
+      '@algolia/autocomplete-plugin-algolia-insights': 1.17.9(@algolia/client-search@5.20.1)(algoliasearch@5.20.1)(search-insights@2.17.3)
+      '@algolia/autocomplete-shared': 1.17.9(@algolia/client-search@5.20.1)(algoliasearch@5.20.1)
     transitivePeerDependencies:
       - '@algolia/client-search'
       - algoliasearch
       - search-insights
 
-  '@algolia/autocomplete-plugin-algolia-insights@1.17.9(@algolia/client-search@5.20.0)(algoliasearch@5.20.0)(search-insights@2.17.3)':
+  '@algolia/autocomplete-plugin-algolia-insights@1.17.9(@algolia/client-search@5.20.1)(algoliasearch@5.20.1)(search-insights@2.17.3)':
     dependencies:
-      '@algolia/autocomplete-shared': 1.17.9(@algolia/client-search@5.20.0)(algoliasearch@5.20.0)
+      '@algolia/autocomplete-shared': 1.17.9(@algolia/client-search@5.20.1)(algoliasearch@5.20.1)
       search-insights: 2.17.3
     transitivePeerDependencies:
       - '@algolia/client-search'
       - algoliasearch
 
-  '@algolia/autocomplete-preset-algolia@1.17.9(@algolia/client-search@5.20.0)(algoliasearch@5.20.0)':
+  '@algolia/autocomplete-preset-algolia@1.17.9(@algolia/client-search@5.20.1)(algoliasearch@5.20.1)':
     dependencies:
-      '@algolia/autocomplete-shared': 1.17.9(@algolia/client-search@5.20.0)(algoliasearch@5.20.0)
-      '@algolia/client-search': 5.20.0
-      algoliasearch: 5.20.0
+      '@algolia/autocomplete-shared': 1.17.9(@algolia/client-search@5.20.1)(algoliasearch@5.20.1)
+      '@algolia/client-search': 5.20.1
+      algoliasearch: 5.20.1
 
-  '@algolia/autocomplete-shared@1.17.9(@algolia/client-search@5.20.0)(algoliasearch@5.20.0)':
+  '@algolia/autocomplete-shared@1.17.9(@algolia/client-search@5.20.1)(algoliasearch@5.20.1)':
     dependencies:
-      '@algolia/client-search': 5.20.0
-      algoliasearch: 5.20.0
+      '@algolia/client-search': 5.20.1
+      algoliasearch: 5.20.1
 
-  '@algolia/client-abtesting@5.20.0':
+  '@algolia/client-abtesting@5.20.1':
     dependencies:
-      '@algolia/client-common': 5.20.0
-      '@algolia/requester-browser-xhr': 5.20.0
-      '@algolia/requester-fetch': 5.20.0
-      '@algolia/requester-node-http': 5.20.0
+      '@algolia/client-common': 5.20.1
+      '@algolia/requester-browser-xhr': 5.20.1
+      '@algolia/requester-fetch': 5.20.1
+      '@algolia/requester-node-http': 5.20.1
 
-  '@algolia/client-analytics@5.20.0':
+  '@algolia/client-analytics@5.20.1':
     dependencies:
-      '@algolia/client-common': 5.20.0
-      '@algolia/requester-browser-xhr': 5.20.0
-      '@algolia/requester-fetch': 5.20.0
-      '@algolia/requester-node-http': 5.20.0
+      '@algolia/client-common': 5.20.1
+      '@algolia/requester-browser-xhr': 5.20.1
+      '@algolia/requester-fetch': 5.20.1
+      '@algolia/requester-node-http': 5.20.1
 
-  '@algolia/client-common@5.20.0': {}
+  '@algolia/client-common@5.20.1': {}
 
-  '@algolia/client-insights@5.20.0':
+  '@algolia/client-insights@5.20.1':
     dependencies:
-      '@algolia/client-common': 5.20.0
-      '@algolia/requester-browser-xhr': 5.20.0
-      '@algolia/requester-fetch': 5.20.0
-      '@algolia/requester-node-http': 5.20.0
+      '@algolia/client-common': 5.20.1
+      '@algolia/requester-browser-xhr': 5.20.1
+      '@algolia/requester-fetch': 5.20.1
+      '@algolia/requester-node-http': 5.20.1
 
-  '@algolia/client-personalization@5.20.0':
+  '@algolia/client-personalization@5.20.1':
     dependencies:
-      '@algolia/client-common': 5.20.0
-      '@algolia/requester-browser-xhr': 5.20.0
-      '@algolia/requester-fetch': 5.20.0
-      '@algolia/requester-node-http': 5.20.0
+      '@algolia/client-common': 5.20.1
+      '@algolia/requester-browser-xhr': 5.20.1
+      '@algolia/requester-fetch': 5.20.1
+      '@algolia/requester-node-http': 5.20.1
 
-  '@algolia/client-query-suggestions@5.20.0':
+  '@algolia/client-query-suggestions@5.20.1':
     dependencies:
-      '@algolia/client-common': 5.20.0
-      '@algolia/requester-browser-xhr': 5.20.0
-      '@algolia/requester-fetch': 5.20.0
-      '@algolia/requester-node-http': 5.20.0
+      '@algolia/client-common': 5.20.1
+      '@algolia/requester-browser-xhr': 5.20.1
+      '@algolia/requester-fetch': 5.20.1
+      '@algolia/requester-node-http': 5.20.1
 
-  '@algolia/client-search@5.20.0':
+  '@algolia/client-search@5.20.1':
     dependencies:
-      '@algolia/client-common': 5.20.0
-      '@algolia/requester-browser-xhr': 5.20.0
-      '@algolia/requester-fetch': 5.20.0
-      '@algolia/requester-node-http': 5.20.0
+      '@algolia/client-common': 5.20.1
+      '@algolia/requester-browser-xhr': 5.20.1
+      '@algolia/requester-fetch': 5.20.1
+      '@algolia/requester-node-http': 5.20.1
 
   '@algolia/events@4.0.1': {}
 
-  '@algolia/ingestion@1.20.0':
+  '@algolia/ingestion@1.20.1':
     dependencies:
-      '@algolia/client-common': 5.20.0
-      '@algolia/requester-browser-xhr': 5.20.0
-      '@algolia/requester-fetch': 5.20.0
-      '@algolia/requester-node-http': 5.20.0
+      '@algolia/client-common': 5.20.1
+      '@algolia/requester-browser-xhr': 5.20.1
+      '@algolia/requester-fetch': 5.20.1
+      '@algolia/requester-node-http': 5.20.1
 
-  '@algolia/monitoring@1.20.0':
+  '@algolia/monitoring@1.20.1':
     dependencies:
-      '@algolia/client-common': 5.20.0
-      '@algolia/requester-browser-xhr': 5.20.0
-      '@algolia/requester-fetch': 5.20.0
-      '@algolia/requester-node-http': 5.20.0
+      '@algolia/client-common': 5.20.1
+      '@algolia/requester-browser-xhr': 5.20.1
+      '@algolia/requester-fetch': 5.20.1
+      '@algolia/requester-node-http': 5.20.1
 
-  '@algolia/recommend@5.20.0':
+  '@algolia/recommend@5.20.1':
     dependencies:
-      '@algolia/client-common': 5.20.0
-      '@algolia/requester-browser-xhr': 5.20.0
-      '@algolia/requester-fetch': 5.20.0
-      '@algolia/requester-node-http': 5.20.0
+      '@algolia/client-common': 5.20.1
+      '@algolia/requester-browser-xhr': 5.20.1
+      '@algolia/requester-fetch': 5.20.1
+      '@algolia/requester-node-http': 5.20.1
 
-  '@algolia/requester-browser-xhr@5.20.0':
+  '@algolia/requester-browser-xhr@5.20.1':
     dependencies:
-      '@algolia/client-common': 5.20.0
+      '@algolia/client-common': 5.20.1
 
-  '@algolia/requester-fetch@5.20.0':
+  '@algolia/requester-fetch@5.20.1':
     dependencies:
-      '@algolia/client-common': 5.20.0
+      '@algolia/client-common': 5.20.1
 
-  '@algolia/requester-node-http@5.20.0':
+  '@algolia/requester-node-http@5.20.1':
     dependencies:
-      '@algolia/client-common': 5.20.0
+      '@algolia/client-common': 5.20.1
 
   '@alloc/quick-lru@5.2.0': {}
 
   '@alloralabs/allora-sdk@0.1.0':
     dependencies:
-      '@types/node': 22.13.0
+      '@types/node': 22.13.1
       typescript: 5.7.3
 
   '@ampproject/remapping@2.3.0':
@@ -29437,16 +29660,16 @@ snapshots:
       '@jridgewell/gen-mapping': 0.3.8
       '@jridgewell/trace-mapping': 0.3.25
 
-  '@antfu/install-pkg@0.4.1':
+  '@antfu/install-pkg@1.0.0':
     dependencies:
       package-manager-detector: 0.2.9
       tinyexec: 0.3.2
 
-  '@antfu/utils@0.7.10': {}
+  '@antfu/utils@8.1.0': {}
 
   '@anthropic-ai/sdk@0.30.1(encoding@0.1.13)':
     dependencies:
-      '@types/node': 18.19.74
+      '@types/node': 18.19.75
       '@types/node-fetch': 2.6.12
       abort-controller: 3.0.0
       agentkeepalive: 4.6.0
@@ -31268,7 +31491,7 @@ snapshots:
     dependencies:
       '@soncodi/signal': 2.0.7
 
-  '@cetusprotocol/aggregator-sdk@0.3.21(@jest/transform@29.7.0)(@jest/types@29.6.3)(babel-plugin-macros@3.1.0)(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@6.0.5)':
+  '@cetusprotocol/aggregator-sdk@0.3.22(@jest/transform@29.7.0)(@jest/types@29.6.3)(babel-plugin-macros@3.1.0)(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@6.0.5)':
     dependencies:
       '@babel/core': 7.26.7
       '@babel/preset-env': 7.26.7(@babel/core@7.26.7)
@@ -31301,11 +31524,11 @@ snapshots:
 
   '@cfworker/json-schema@4.1.1': {}
 
-  '@chain-registry/types@0.50.62': {}
+  '@chain-registry/types@0.50.65': {}
 
-  '@chain-registry/utils@1.51.62':
+  '@chain-registry/utils@1.51.65':
     dependencies:
-      '@chain-registry/types': 0.50.62
+      '@chain-registry/types': 0.50.65
       bignumber.js: 9.1.2
       sha.js: 2.4.11
 
@@ -31571,7 +31794,7 @@ snapshots:
     dependencies:
       '@coinbase/cdp-agentkit-core': 0.0.10(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@6.0.5)
       '@coinbase/coinbase-sdk': 0.15.0(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@6.0.5)(zod@3.23.8)
-      '@langchain/core': 0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))(zod@3.23.8))
+      '@langchain/core': 0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))(zod@3.23.8))
       zod: 3.23.8
     transitivePeerDependencies:
       - bufferutil
@@ -31678,11 +31901,11 @@ snapshots:
   '@colors/colors@1.5.0':
     optional: true
 
-  '@commitlint/cli@18.6.1(@types/node@22.13.0)(typescript@5.6.3)':
+  '@commitlint/cli@18.6.1(@types/node@22.13.1)(typescript@5.6.3)':
     dependencies:
       '@commitlint/format': 18.6.1
       '@commitlint/lint': 18.6.1
-      '@commitlint/load': 18.6.1(@types/node@22.13.0)(typescript@5.6.3)
+      '@commitlint/load': 18.6.1(@types/node@22.13.1)(typescript@5.6.3)
       '@commitlint/read': 18.6.1
       '@commitlint/types': 18.6.1
       execa: 5.1.1
@@ -31732,7 +31955,7 @@ snapshots:
       '@commitlint/rules': 18.6.1
       '@commitlint/types': 18.6.1
 
-  '@commitlint/load@18.6.1(@types/node@22.13.0)(typescript@5.6.3)':
+  '@commitlint/load@18.6.1(@types/node@22.13.1)(typescript@5.6.3)':
     dependencies:
       '@commitlint/config-validator': 18.6.1
       '@commitlint/execute-rule': 18.6.1
@@ -31740,7 +31963,7 @@ snapshots:
       '@commitlint/types': 18.6.1
       chalk: 4.1.2
       cosmiconfig: 8.3.6(typescript@5.6.3)
-      cosmiconfig-typescript-loader: 5.1.0(@types/node@22.13.0)(cosmiconfig@8.3.6(typescript@5.6.3))(typescript@5.6.3)
+      cosmiconfig-typescript-loader: 5.1.0(@types/node@22.13.1)(cosmiconfig@8.3.6(typescript@5.6.3))(typescript@5.6.3)
       lodash.isplainobject: 4.0.6
       lodash.merge: 4.6.2
       lodash.uniq: 4.5.0
@@ -32851,7 +33074,7 @@ snapshots:
   '@deepgram/sdk@3.10.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@6.0.5)':
     dependencies:
       '@deepgram/captions': 1.2.0
-      '@types/node': 18.19.74
+      '@types/node': 18.19.75
       cross-fetch: 3.2.0(encoding@0.1.13)
       deepmerge: 4.3.1
       events: 3.3.0
@@ -32997,12 +33220,12 @@ snapshots:
 
   '@docsearch/css@3.8.3': {}
 
-  '@docsearch/react@3.8.3(@algolia/client-search@5.20.0)(@types/react@19.0.8)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(search-insights@2.17.3)':
+  '@docsearch/react@3.8.3(@algolia/client-search@5.20.1)(@types/react@19.0.8)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(search-insights@2.17.3)':
     dependencies:
-      '@algolia/autocomplete-core': 1.17.9(@algolia/client-search@5.20.0)(algoliasearch@5.20.0)(search-insights@2.17.3)
-      '@algolia/autocomplete-preset-algolia': 1.17.9(@algolia/client-search@5.20.0)(algoliasearch@5.20.0)
+      '@algolia/autocomplete-core': 1.17.9(@algolia/client-search@5.20.1)(algoliasearch@5.20.1)(search-insights@2.17.3)
+      '@algolia/autocomplete-preset-algolia': 1.17.9(@algolia/client-search@5.20.1)(algoliasearch@5.20.1)
       '@docsearch/css': 3.8.3
-      algoliasearch: 5.20.0
+      algoliasearch: 5.20.1
     optionalDependencies:
       '@types/react': 19.0.8
       react: 18.3.1
@@ -33570,7 +33793,7 @@ snapshots:
       - vue-template-compiler
       - webpack-cli
 
-  '@docusaurus/preset-classic@3.7.0(@algolia/client-search@5.20.0)(@mdx-js/react@3.0.1(@types/react@19.0.8)(react@18.3.1))(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/react@19.0.8)(acorn@8.14.0)(bufferutil@4.0.9)(eslint@9.19.0(jiti@2.4.2))(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(search-insights@2.17.3)(typescript@5.7.3)(utf-8-validate@5.0.10)':
+  '@docusaurus/preset-classic@3.7.0(@algolia/client-search@5.20.1)(@mdx-js/react@3.0.1(@types/react@19.0.8)(react@18.3.1))(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/react@19.0.8)(acorn@8.14.0)(bufferutil@4.0.9)(eslint@9.19.0(jiti@2.4.2))(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(search-insights@2.17.3)(typescript@5.7.3)(utf-8-validate@5.0.10)':
     dependencies:
       '@docusaurus/core': 3.7.0(@mdx-js/react@3.0.1(@types/react@19.0.8)(react@18.3.1))(@swc/core@1.10.14(@swc/helpers@0.5.15))(acorn@8.14.0)(bufferutil@4.0.9)(eslint@9.19.0(jiti@2.4.2))(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@docusaurus/plugin-content-blog': 3.7.0(@docusaurus/plugin-content-docs@3.7.0(@mdx-js/react@3.0.1(@types/react@19.0.8)(react@18.3.1))(@swc/core@1.10.14(@swc/helpers@0.5.15))(acorn@8.14.0)(bufferutil@4.0.9)(eslint@9.19.0(jiti@2.4.2))(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(typescript@5.7.3)(utf-8-validate@5.0.10))(@mdx-js/react@3.0.1(@types/react@19.0.8)(react@18.3.1))(@swc/core@1.10.14(@swc/helpers@0.5.15))(acorn@8.14.0)(bufferutil@4.0.9)(eslint@9.19.0(jiti@2.4.2))(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(typescript@5.7.3)(utf-8-validate@5.0.10)
@@ -33584,7 +33807,7 @@ snapshots:
       '@docusaurus/plugin-svgr': 3.7.0(@mdx-js/react@3.0.1(@types/react@19.0.8)(react@18.3.1))(@swc/core@1.10.14(@swc/helpers@0.5.15))(acorn@8.14.0)(bufferutil@4.0.9)(eslint@9.19.0(jiti@2.4.2))(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@docusaurus/theme-classic': 3.7.0(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/react@19.0.8)(acorn@8.14.0)(bufferutil@4.0.9)(eslint@9.19.0(jiti@2.4.2))(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@docusaurus/theme-common': 3.7.0(@docusaurus/plugin-content-docs@3.7.0(@mdx-js/react@3.0.1(@types/react@19.0.8)(react@18.3.1))(@swc/core@1.10.14(@swc/helpers@0.5.15))(acorn@8.14.0)(bufferutil@4.0.9)(eslint@9.19.0(jiti@2.4.2))(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(typescript@5.7.3)(utf-8-validate@5.0.10))(@swc/core@1.10.14(@swc/helpers@0.5.15))(acorn@8.14.0)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
-      '@docusaurus/theme-search-algolia': 3.7.0(@algolia/client-search@5.20.0)(@mdx-js/react@3.0.1(@types/react@19.0.8)(react@18.3.1))(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/react@19.0.8)(acorn@8.14.0)(bufferutil@4.0.9)(eslint@9.19.0(jiti@2.4.2))(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(search-insights@2.17.3)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@docusaurus/theme-search-algolia': 3.7.0(@algolia/client-search@5.20.1)(@mdx-js/react@3.0.1(@types/react@19.0.8)(react@18.3.1))(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/react@19.0.8)(acorn@8.14.0)(bufferutil@4.0.9)(eslint@9.19.0(jiti@2.4.2))(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(search-insights@2.17.3)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@docusaurus/types': 3.7.0(@swc/core@1.10.14(@swc/helpers@0.5.15))(acorn@8.14.0)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
       react: 18.3.1
       react-dom: 18.3.1(react@18.3.1)
@@ -33732,9 +33955,9 @@ snapshots:
       - vue-template-compiler
       - webpack-cli
 
-  '@docusaurus/theme-search-algolia@3.7.0(@algolia/client-search@5.20.0)(@mdx-js/react@3.0.1(@types/react@19.0.8)(react@18.3.1))(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/react@19.0.8)(acorn@8.14.0)(bufferutil@4.0.9)(eslint@9.19.0(jiti@2.4.2))(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(search-insights@2.17.3)(typescript@5.7.3)(utf-8-validate@5.0.10)':
+  '@docusaurus/theme-search-algolia@3.7.0(@algolia/client-search@5.20.1)(@mdx-js/react@3.0.1(@types/react@19.0.8)(react@18.3.1))(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/react@19.0.8)(acorn@8.14.0)(bufferutil@4.0.9)(eslint@9.19.0(jiti@2.4.2))(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(search-insights@2.17.3)(typescript@5.7.3)(utf-8-validate@5.0.10)':
     dependencies:
-      '@docsearch/react': 3.8.3(@algolia/client-search@5.20.0)(@types/react@19.0.8)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(search-insights@2.17.3)
+      '@docsearch/react': 3.8.3(@algolia/client-search@5.20.1)(@types/react@19.0.8)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(search-insights@2.17.3)
       '@docusaurus/core': 3.7.0(@mdx-js/react@3.0.1(@types/react@19.0.8)(react@18.3.1))(@swc/core@1.10.14(@swc/helpers@0.5.15))(acorn@8.14.0)(bufferutil@4.0.9)(eslint@9.19.0(jiti@2.4.2))(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@docusaurus/logger': 3.7.0
       '@docusaurus/plugin-content-docs': 3.7.0(@mdx-js/react@3.0.1(@types/react@19.0.8)(react@18.3.1))(@swc/core@1.10.14(@swc/helpers@0.5.15))(acorn@8.14.0)(bufferutil@4.0.9)(eslint@9.19.0(jiti@2.4.2))(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(typescript@5.7.3)(utf-8-validate@5.0.10)
@@ -33742,8 +33965,8 @@ snapshots:
       '@docusaurus/theme-translations': 3.7.0
       '@docusaurus/utils': 3.7.0(@swc/core@1.10.14(@swc/helpers@0.5.15))(acorn@8.14.0)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
       '@docusaurus/utils-validation': 3.7.0(@swc/core@1.10.14(@swc/helpers@0.5.15))(acorn@8.14.0)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
-      algoliasearch: 5.20.0
-      algoliasearch-helper: 3.24.1(algoliasearch@5.20.0)
+      algoliasearch: 5.20.1
+      algoliasearch-helper: 3.24.1(algoliasearch@5.20.1)
       clsx: 2.1.1
       eta: 2.2.0
       fs-extra: 11.2.0
@@ -33873,7 +34096,7 @@ snapshots:
       '@coral-xyz/anchor': 0.28.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
       '@coral-xyz/anchor-30': '@coral-xyz/anchor@0.30.1(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)'
       '@ellipsis-labs/phoenix-sdk': 1.4.5(@solana/web3.js@1.92.3(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
-      '@grpc/grpc-js': 1.12.5
+      '@grpc/grpc-js': 1.12.6
       '@openbook-dex/openbook-v2': 0.2.10(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.6.3)(utf-8-validate@5.0.10)
       '@project-serum/serum': 0.13.65(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
       '@pythnetwork/client': 2.5.3(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
@@ -33908,7 +34131,7 @@ snapshots:
       '@coral-xyz/anchor': 0.28.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
       '@coral-xyz/anchor-30': '@coral-xyz/anchor@0.30.1(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)'
       '@ellipsis-labs/phoenix-sdk': 1.4.5(@solana/web3.js@1.92.3(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
-      '@grpc/grpc-js': 1.12.5
+      '@grpc/grpc-js': 1.12.6
       '@openbook-dex/openbook-v2': 0.2.10(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@project-serum/serum': 0.13.65(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
       '@pythnetwork/client': 2.5.3(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
@@ -33943,7 +34166,7 @@ snapshots:
       '@coral-xyz/anchor': 0.28.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
       '@coral-xyz/anchor-30': '@coral-xyz/anchor@0.30.1(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)'
       '@ellipsis-labs/phoenix-sdk': 1.4.5(@solana/web3.js@1.92.3(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
-      '@grpc/grpc-js': 1.12.5
+      '@grpc/grpc-js': 1.12.6
       '@openbook-dex/openbook-v2': 0.2.10(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.6.3)(utf-8-validate@5.0.10)
       '@project-serum/serum': 0.13.65(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
       '@pythnetwork/client': 2.5.3(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
@@ -34001,7 +34224,7 @@ snapshots:
       - supports-color
       - utf-8-validate
 
-  '@drift-labs/vaults-sdk@0.2.68(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(arweave@1.15.5)(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(utf-8-validate@5.0.10)':
+  '@drift-labs/vaults-sdk@0.2.68(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(arweave@1.15.5)(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(utf-8-validate@5.0.10)':
     dependencies:
       '@coral-xyz/anchor': 0.28.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
       '@drift-labs/sdk': 2.108.0-beta.3(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.6.3)(utf-8-validate@5.0.10)
@@ -34015,7 +34238,7 @@ snapshots:
       dotenv: 16.4.5
       rpc-websockets: 7.5.1
       strict-event-emitter-types: 2.0.0
-      ts-node: 10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.6.3)
+      ts-node: 10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.6.3)
       typescript: 5.6.3
     transitivePeerDependencies:
       - '@swc/core'
@@ -34062,9 +34285,9 @@ snapshots:
 
   '@electric-sql/pglite@0.2.16': {}
 
-  '@elizaos/adapter-sqlite@0.1.7-alpha.2(@google-cloud/vertexai@1.9.3(encoding@0.1.13))(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(@langchain/groq@0.1.3(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5)))(axios@1.7.9)(encoding@0.1.13)(react@19.0.0)(sswr@2.1.0(svelte@5.19.7))(svelte@5.19.7)(whatwg-url@14.1.0)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))':
+  '@elizaos/adapter-sqlite@0.1.7-alpha.2(@google-cloud/vertexai@1.9.3(encoding@0.1.13))(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(@langchain/groq@0.1.3(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5)))(axios@1.7.9)(encoding@0.1.13)(react@19.0.0)(sswr@2.1.0(svelte@5.19.8))(svelte@5.19.8)(whatwg-url@14.1.0)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))':
     dependencies:
-      '@elizaos/core': 0.1.7-alpha.2(@google-cloud/vertexai@1.9.3(encoding@0.1.13))(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(@langchain/groq@0.1.3(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5)))(axios@1.7.9)(encoding@0.1.13)(react@19.0.0)(sswr@2.1.0(svelte@5.19.7))(svelte@5.19.7)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))
+      '@elizaos/core': 0.1.7-alpha.2(@google-cloud/vertexai@1.9.3(encoding@0.1.13))(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(@langchain/groq@0.1.3(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5)))(axios@1.7.9)(encoding@0.1.13)(react@19.0.0)(sswr@2.1.0(svelte@5.19.8))(svelte@5.19.8)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))
       '@types/better-sqlite3': 7.6.12
       better-sqlite3: 11.6.0
       sqlite-vec: 0.1.6
@@ -34126,7 +34349,7 @@ snapshots:
       - vue
       - ws
 
-  '@elizaos/core@0.1.7-alpha.2(@google-cloud/vertexai@1.9.3(encoding@0.1.13))(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(@langchain/groq@0.1.3(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5)))(axios@1.7.9)(encoding@0.1.13)(react@19.0.0)(sswr@2.1.0(svelte@5.19.7))(svelte@5.19.7)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))':
+  '@elizaos/core@0.1.7-alpha.2(@google-cloud/vertexai@1.9.3(encoding@0.1.13))(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(@langchain/groq@0.1.3(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5)))(axios@1.7.9)(encoding@0.1.13)(react@19.0.0)(sswr@2.1.0(svelte@5.19.8))(svelte@5.19.8)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))':
     dependencies:
       '@ai-sdk/anthropic': 0.0.56(zod@3.23.8)
       '@ai-sdk/google': 0.0.55(zod@3.23.8)
@@ -34136,7 +34359,7 @@ snapshots:
       '@anthropic-ai/sdk': 0.30.1(encoding@0.1.13)
       '@fal-ai/client': 1.2.0
       '@types/uuid': 10.0.0
-      ai: 3.4.33(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))(react@19.0.0)(sswr@2.1.0(svelte@5.19.7))(svelte@5.19.7)(vue@3.5.13(typescript@5.7.3))(zod@3.23.8)
+      ai: 3.4.33(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))(react@19.0.0)(sswr@2.1.0(svelte@5.19.8))(svelte@5.19.8)(vue@3.5.13(typescript@5.7.3))(zod@3.23.8)
       anthropic-vertex-ai: 1.0.2(encoding@0.1.13)(zod@3.23.8)
       fastembed: 1.14.1
       fastestsmallesttextencoderdecoder: 1.0.22
@@ -34145,7 +34368,7 @@ snapshots:
       handlebars: 4.7.8
       js-sha1: 0.7.0
       js-tiktoken: 1.0.15
-      langchain: 0.3.6(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(@langchain/groq@0.1.3(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5)))(axios@1.7.9)(encoding@0.1.13)(handlebars@4.7.8)(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))
+      langchain: 0.3.6(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(@langchain/groq@0.1.3(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5)))(axios@1.7.9)(encoding@0.1.13)(handlebars@4.7.8)(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))
       ollama-ai-provider: 0.16.1(zod@3.23.8)
       openai: 4.73.0(encoding@0.1.13)(zod@3.23.8)
       tinyld: 1.3.4
@@ -34177,7 +34400,7 @@ snapshots:
       - vue
       - ws
 
-  '@elizaos/core@0.1.9(@google-cloud/vertexai@1.9.3(encoding@0.1.13))(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(@langchain/groq@0.1.3(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10)))(axios@1.7.9)(encoding@0.1.13)(react@19.0.0)(sswr@2.1.0(svelte@5.19.7))(svelte@5.19.7)(vue@3.5.13(typescript@5.7.3))(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))':
+  '@elizaos/core@0.1.9(@google-cloud/vertexai@1.9.3(encoding@0.1.13))(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(@langchain/groq@0.1.3(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10)))(axios@1.7.9)(encoding@0.1.13)(react@19.0.0)(sswr@2.1.0(svelte@5.19.8))(svelte@5.19.8)(vue@3.5.13(typescript@5.7.3))(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))':
     dependencies:
       '@ai-sdk/amazon-bedrock': 1.1.0(zod@3.23.8)
       '@ai-sdk/anthropic': 0.0.56(zod@3.23.8)
@@ -34189,7 +34412,7 @@ snapshots:
       '@fal-ai/client': 1.2.0
       '@tavily/core': 0.0.2
       '@types/uuid': 10.0.0
-      ai: 3.4.33(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))(react@19.0.0)(sswr@2.1.0(svelte@5.19.7))(svelte@5.19.7)(vue@3.5.13(typescript@5.7.3))(zod@3.23.8)
+      ai: 3.4.33(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))(react@19.0.0)(sswr@2.1.0(svelte@5.19.8))(svelte@5.19.8)(vue@3.5.13(typescript@5.7.3))(zod@3.23.8)
       anthropic-vertex-ai: 1.0.2(encoding@0.1.13)(zod@3.23.8)
       dotenv: 16.4.5
       fastembed: 1.14.1
@@ -34199,7 +34422,7 @@ snapshots:
       handlebars: 4.7.8
       js-sha1: 0.7.0
       js-tiktoken: 1.0.15
-      langchain: 0.3.6(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(@langchain/groq@0.1.3(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10)))(axios@1.7.9)(encoding@0.1.13)(handlebars@4.7.8)(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
+      langchain: 0.3.6(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(@langchain/groq@0.1.3(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10)))(axios@1.7.9)(encoding@0.1.13)(handlebars@4.7.8)(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
       ollama-ai-provider: 0.16.1(zod@3.23.8)
       openai: 4.73.0(encoding@0.1.13)(zod@3.23.8)
       pino: 9.6.0
@@ -34247,7 +34470,7 @@ snapshots:
       '@fal-ai/client': 1.2.0
       '@tavily/core': 0.0.2
       '@types/uuid': 10.0.0
-      ai: 3.4.33(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))(react@19.0.0)(sswr@2.1.0(svelte@5.19.7))(svelte@5.19.7)(vue@3.5.13(typescript@5.7.3))(zod@3.23.8)
+      ai: 3.4.33(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))(react@19.0.0)(sswr@2.1.0(svelte@5.19.8))(svelte@5.19.8)(vue@3.5.13(typescript@5.7.3))(zod@3.23.8)
       anthropic-vertex-ai: 1.0.2(encoding@0.1.13)(zod@3.23.8)
       dotenv: 16.4.5
       fastembed: 1.14.1
@@ -34305,7 +34528,7 @@ snapshots:
       '@fal-ai/client': 1.2.0
       '@tavily/core': 0.0.2
       '@types/uuid': 10.0.0
-      ai: 3.4.33(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))(react@19.0.0)(sswr@2.1.0(svelte@5.19.7))(svelte@5.19.7)(vue@3.5.13(typescript@5.7.3))(zod@3.23.8)
+      ai: 3.4.33(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))(react@19.0.0)(sswr@2.1.0(svelte@5.19.8))(svelte@5.19.8)(vue@3.5.13(typescript@5.7.3))(zod@3.23.8)
       anthropic-vertex-ai: 1.0.2(encoding@0.1.13)(zod@3.23.8)
       dotenv: 16.4.5
       fastembed: 1.14.1
@@ -34407,7 +34630,7 @@ snapshots:
       '@metaplex-foundation/rustbin': 0.3.5
       '@metaplex-foundation/solita': 0.12.2(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
       '@solana/spl-token': 0.3.7(@solana/web3.js@1.92.3(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
-      '@types/node': 18.19.74
+      '@types/node': 18.19.75
       bn.js: 5.2.1
       borsh: 0.7.0
       bs58: 5.0.0
@@ -35331,23 +35554,23 @@ snapshots:
 
   '@floating-ui/utils@0.2.9': {}
 
-  '@fuel-ts/abi-coder@0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))':
+  '@fuel-ts/abi-coder@0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))':
     dependencies:
-      '@fuel-ts/crypto': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+      '@fuel-ts/crypto': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       '@fuel-ts/errors': 0.97.2
-      '@fuel-ts/hasher': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+      '@fuel-ts/hasher': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       '@fuel-ts/interfaces': 0.97.2
       '@fuel-ts/math': 0.97.2
-      '@fuel-ts/utils': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+      '@fuel-ts/utils': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       type-fest: 4.33.0
     transitivePeerDependencies:
       - vitest
 
-  '@fuel-ts/abi-typegen@0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))':
+  '@fuel-ts/abi-typegen@0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))':
     dependencies:
       '@fuel-ts/errors': 0.97.2
       '@fuel-ts/interfaces': 0.97.2
-      '@fuel-ts/utils': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+      '@fuel-ts/utils': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       '@fuel-ts/versions': 0.97.2
       commander: 12.1.0
       glob: 10.4.5
@@ -35358,18 +35581,18 @@ snapshots:
     transitivePeerDependencies:
       - vitest
 
-  '@fuel-ts/account@0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))':
+  '@fuel-ts/account@0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))':
     dependencies:
-      '@fuel-ts/abi-coder': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/address': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/crypto': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+      '@fuel-ts/abi-coder': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/address': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/crypto': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       '@fuel-ts/errors': 0.97.2
-      '@fuel-ts/hasher': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+      '@fuel-ts/hasher': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       '@fuel-ts/interfaces': 0.97.2
       '@fuel-ts/math': 0.97.2
-      '@fuel-ts/merkle': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/transactions': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/utils': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+      '@fuel-ts/merkle': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/transactions': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/utils': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       '@fuel-ts/versions': 0.97.2
       '@fuels/vm-asm': 0.58.2
       '@noble/curves': 1.8.1
@@ -35382,30 +35605,30 @@ snapshots:
       - encoding
       - vitest
 
-  '@fuel-ts/address@0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))':
+  '@fuel-ts/address@0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))':
     dependencies:
-      '@fuel-ts/crypto': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+      '@fuel-ts/crypto': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       '@fuel-ts/errors': 0.97.2
       '@fuel-ts/interfaces': 0.97.2
-      '@fuel-ts/utils': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+      '@fuel-ts/utils': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       '@noble/hashes': 1.7.1
       bech32: 2.0.0
     transitivePeerDependencies:
       - vitest
 
-  '@fuel-ts/contract@0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))':
+  '@fuel-ts/contract@0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))':
     dependencies:
-      '@fuel-ts/abi-coder': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/account': 0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/crypto': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+      '@fuel-ts/abi-coder': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/account': 0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/crypto': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       '@fuel-ts/errors': 0.97.2
-      '@fuel-ts/hasher': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+      '@fuel-ts/hasher': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       '@fuel-ts/interfaces': 0.97.2
       '@fuel-ts/math': 0.97.2
-      '@fuel-ts/merkle': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/program': 0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/transactions': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/utils': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+      '@fuel-ts/merkle': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/program': 0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/transactions': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/utils': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       '@fuel-ts/versions': 0.97.2
       '@fuels/vm-asm': 0.58.2
       ramda: 0.30.1
@@ -35413,12 +35636,12 @@ snapshots:
       - encoding
       - vitest
 
-  '@fuel-ts/crypto@0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))':
+  '@fuel-ts/crypto@0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))':
     dependencies:
       '@fuel-ts/errors': 0.97.2
       '@fuel-ts/interfaces': 0.97.2
       '@fuel-ts/math': 0.97.2
-      '@fuel-ts/utils': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+      '@fuel-ts/utils': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       '@noble/hashes': 1.7.1
     transitivePeerDependencies:
       - vitest
@@ -35427,11 +35650,11 @@ snapshots:
     dependencies:
       '@fuel-ts/versions': 0.97.2
 
-  '@fuel-ts/hasher@0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))':
+  '@fuel-ts/hasher@0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))':
     dependencies:
-      '@fuel-ts/crypto': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+      '@fuel-ts/crypto': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       '@fuel-ts/interfaces': 0.97.2
-      '@fuel-ts/utils': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+      '@fuel-ts/utils': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       '@noble/hashes': 1.7.1
     transitivePeerDependencies:
       - vitest
@@ -35444,78 +35667,78 @@ snapshots:
       '@types/bn.js': 5.1.6
       bn.js: 5.2.1
 
-  '@fuel-ts/merkle@0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))':
+  '@fuel-ts/merkle@0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))':
     dependencies:
-      '@fuel-ts/hasher': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+      '@fuel-ts/hasher': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       '@fuel-ts/math': 0.97.2
     transitivePeerDependencies:
       - vitest
 
-  '@fuel-ts/program@0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))':
+  '@fuel-ts/program@0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))':
     dependencies:
-      '@fuel-ts/abi-coder': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/account': 0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/address': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+      '@fuel-ts/abi-coder': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/account': 0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/address': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       '@fuel-ts/errors': 0.97.2
       '@fuel-ts/interfaces': 0.97.2
       '@fuel-ts/math': 0.97.2
-      '@fuel-ts/transactions': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/utils': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+      '@fuel-ts/transactions': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/utils': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       '@fuels/vm-asm': 0.58.2
       ramda: 0.30.1
     transitivePeerDependencies:
       - encoding
       - vitest
 
-  '@fuel-ts/recipes@0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))':
+  '@fuel-ts/recipes@0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))':
     dependencies:
-      '@fuel-ts/abi-coder': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/abi-typegen': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/account': 0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/contract': 0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+      '@fuel-ts/abi-coder': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/abi-typegen': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/account': 0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/contract': 0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       '@fuel-ts/interfaces': 0.97.2
-      '@fuel-ts/program': 0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/transactions': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/utils': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+      '@fuel-ts/program': 0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/transactions': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/utils': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
     transitivePeerDependencies:
       - encoding
       - vitest
 
-  '@fuel-ts/script@0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))':
+  '@fuel-ts/script@0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))':
     dependencies:
-      '@fuel-ts/abi-coder': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/account': 0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/address': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+      '@fuel-ts/abi-coder': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/account': 0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/address': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       '@fuel-ts/errors': 0.97.2
       '@fuel-ts/interfaces': 0.97.2
       '@fuel-ts/math': 0.97.2
-      '@fuel-ts/program': 0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/transactions': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/utils': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+      '@fuel-ts/program': 0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/transactions': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/utils': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
     transitivePeerDependencies:
       - encoding
       - vitest
 
-  '@fuel-ts/transactions@0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))':
+  '@fuel-ts/transactions@0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))':
     dependencies:
-      '@fuel-ts/abi-coder': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/address': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+      '@fuel-ts/abi-coder': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/address': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       '@fuel-ts/errors': 0.97.2
-      '@fuel-ts/hasher': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+      '@fuel-ts/hasher': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       '@fuel-ts/interfaces': 0.97.2
       '@fuel-ts/math': 0.97.2
-      '@fuel-ts/utils': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+      '@fuel-ts/utils': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
     transitivePeerDependencies:
       - vitest
 
-  '@fuel-ts/utils@0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))':
+  '@fuel-ts/utils@0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))':
     dependencies:
       '@fuel-ts/errors': 0.97.2
       '@fuel-ts/interfaces': 0.97.2
       '@fuel-ts/math': 0.97.2
       '@fuel-ts/versions': 0.97.2
       fflate: 0.8.2
-      vitest: 2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+      vitest: 2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   '@fuel-ts/versions@0.97.2':
     dependencies:
@@ -35709,7 +35932,7 @@ snapshots:
       '@grpc/proto-loader': 0.7.13
       '@js-sdsl/ordered-map': 4.4.2
 
-  '@grpc/grpc-js@1.12.5':
+  '@grpc/grpc-js@1.12.6':
     dependencies:
       '@grpc/proto-loader': 0.7.13
       '@js-sdsl/ordered-map': 4.4.2
@@ -35767,15 +35990,15 @@ snapshots:
 
   '@iconify/types@2.0.0': {}
 
-  '@iconify/utils@2.2.1':
+  '@iconify/utils@2.3.0':
     dependencies:
-      '@antfu/install-pkg': 0.4.1
-      '@antfu/utils': 0.7.10
+      '@antfu/install-pkg': 1.0.0
+      '@antfu/utils': 8.1.0
       '@iconify/types': 2.0.0
       debug: 4.4.0(supports-color@8.1.1)
       globals: 15.14.0
       kolorist: 1.8.0
-      local-pkg: 0.5.1
+      local-pkg: 1.0.0
       mlly: 1.7.4
     transitivePeerDependencies:
       - supports-color
@@ -35863,7 +36086,7 @@ snapshots:
   '@initia/initia.js@0.2.26(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@6.0.5)':
     dependencies:
       '@bitcoinerlab/secp256k1': 1.2.0
-      '@initia/initia.proto': 0.2.5
+      '@initia/initia.proto': 0.2.6
       '@initia/opinit.proto': 0.0.11
       '@ledgerhq/hw-transport': 6.31.4
       '@ledgerhq/hw-transport-webhid': 6.30.0
@@ -35886,7 +36109,7 @@ snapshots:
       - typescript
       - utf-8-validate
 
-  '@initia/initia.proto@0.2.5':
+  '@initia/initia.proto@0.2.6':
     dependencies:
       '@improbable-eng/grpc-web': 0.15.0(google-protobuf@3.21.4)
       google-protobuf: 3.21.4
@@ -36542,7 +36765,7 @@ snapshots:
       jest-util: 29.7.0
       slash: 3.0.0
 
-  '@jest/core@27.5.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@16.18.125)(typescript@5.7.3))(utf-8-validate@5.0.10)':
+  '@jest/core@27.5.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@16.18.126)(typescript@5.7.3))(utf-8-validate@5.0.10)':
     dependencies:
       '@jest/console': 27.5.1
       '@jest/reporters': 27.5.1
@@ -36556,7 +36779,7 @@ snapshots:
       exit: 0.1.2
       graceful-fs: 4.2.11
       jest-changed-files: 27.5.1
-      jest-config: 27.5.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@16.18.125)(typescript@5.7.3))(utf-8-validate@5.0.10)
+      jest-config: 27.5.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@16.18.126)(typescript@5.7.3))(utf-8-validate@5.0.10)
       jest-haste-map: 27.5.1
       jest-message-util: 27.5.1
       jest-regex-util: 27.5.1
@@ -36579,7 +36802,7 @@ snapshots:
       - ts-node
       - utf-8-validate
 
-  '@jest/core@29.7.0(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.74)(typescript@5.7.3))':
+  '@jest/core@29.7.0(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.75)(typescript@5.7.3))':
     dependencies:
       '@jest/console': 29.7.0
       '@jest/reporters': 29.7.0
@@ -36593,7 +36816,7 @@ snapshots:
       exit: 0.1.2
       graceful-fs: 4.2.11
       jest-changed-files: 29.7.0
-      jest-config: 29.7.0(@types/node@20.17.9)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.74)(typescript@5.7.3))
+      jest-config: 29.7.0(@types/node@20.17.9)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.75)(typescript@5.7.3))
       jest-haste-map: 29.7.0
       jest-message-util: 29.7.0
       jest-regex-util: 29.6.3
@@ -36944,14 +37167,14 @@ snapshots:
     transitivePeerDependencies:
       - debug
 
-  '@keplr-wallet/types@0.12.179(starknet@6.18.0(encoding@0.1.13))':
+  '@keplr-wallet/types@0.12.183(starknet@6.18.0(encoding@0.1.13))':
     dependencies:
       long: 4.0.0
       starknet: 6.18.0(encoding@0.1.13)
 
-  '@keplr-wallet/unit@0.12.179(starknet@6.18.0(encoding@0.1.13))':
+  '@keplr-wallet/unit@0.12.183(starknet@6.18.0(encoding@0.1.13))':
     dependencies:
-      '@keplr-wallet/types': 0.12.179(starknet@6.18.0(encoding@0.1.13))
+      '@keplr-wallet/types': 0.12.183(starknet@6.18.0(encoding@0.1.13))
       big-integer: 1.6.52
       utility-types: 3.11.0
     transitivePeerDependencies:
@@ -36967,14 +37190,14 @@ snapshots:
 
   '@kwsites/promise-deferred@1.1.1': {}
 
-  '@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))':
+  '@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))':
     dependencies:
       '@cfworker/json-schema': 4.1.1
       ansi-styles: 5.2.0
       camelcase: 6.3.0
       decamelize: 1.2.0
       js-tiktoken: 1.0.15
-      langsmith: 0.3.4(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))
+      langsmith: 0.3.6(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))
       mustache: 4.2.0
       p-queue: 6.6.2
       p-retry: 4.6.2
@@ -36984,14 +37207,14 @@ snapshots:
     transitivePeerDependencies:
       - openai
 
-  '@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8))':
+  '@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8))':
     dependencies:
       '@cfworker/json-schema': 4.1.1
       ansi-styles: 5.2.0
       camelcase: 6.3.0
       decamelize: 1.2.0
       js-tiktoken: 1.0.15
-      langsmith: 0.3.4(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8))
+      langsmith: 0.3.6(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8))
       mustache: 4.2.0
       p-queue: 6.6.2
       p-retry: 4.6.2
@@ -37001,14 +37224,14 @@ snapshots:
     transitivePeerDependencies:
       - openai
 
-  '@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1))':
+  '@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1))':
     dependencies:
       '@cfworker/json-schema': 4.1.1
       ansi-styles: 5.2.0
       camelcase: 6.3.0
       decamelize: 1.2.0
       js-tiktoken: 1.0.15
-      langsmith: 0.3.4(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1))
+      langsmith: 0.3.6(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1))
       mustache: 4.2.0
       p-queue: 6.6.2
       p-retry: 4.6.2
@@ -37018,14 +37241,14 @@ snapshots:
     transitivePeerDependencies:
       - openai
 
-  '@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))(zod@3.23.8))':
+  '@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))(zod@3.23.8))':
     dependencies:
       '@cfworker/json-schema': 4.1.1
       ansi-styles: 5.2.0
       camelcase: 6.3.0
       decamelize: 1.2.0
       js-tiktoken: 1.0.15
-      langsmith: 0.3.4(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))(zod@3.23.8))
+      langsmith: 0.3.6(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))(zod@3.23.8))
       mustache: 4.2.0
       p-queue: 6.6.2
       p-retry: 4.6.2
@@ -37035,10 +37258,10 @@ snapshots:
     transitivePeerDependencies:
       - openai
 
-  '@langchain/groq@0.1.3(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))':
+  '@langchain/groq@0.1.3(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))':
     dependencies:
-      '@langchain/core': 0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))
-      '@langchain/openai': 0.3.17(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
+      '@langchain/core': 0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))
+      '@langchain/openai': 0.3.17(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
       groq-sdk: 0.5.0(encoding@0.1.13)
       zod: 3.23.8
       zod-to-json-schema: 3.24.1(zod@3.23.8)
@@ -37047,10 +37270,10 @@ snapshots:
       - ws
     optional: true
 
-  '@langchain/groq@0.1.3(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))':
+  '@langchain/groq@0.1.3(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))':
     dependencies:
-      '@langchain/core': 0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))
-      '@langchain/openai': 0.3.17(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))
+      '@langchain/core': 0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))
+      '@langchain/openai': 0.3.17(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))
       groq-sdk: 0.5.0(encoding@0.1.13)
       zod: 3.23.8
       zod-to-json-schema: 3.24.1(zod@3.23.8)
@@ -37059,10 +37282,10 @@ snapshots:
       - ws
     optional: true
 
-  '@langchain/groq@0.1.3(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)))(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))':
+  '@langchain/groq@0.1.3(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)))(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))':
     dependencies:
-      '@langchain/core': 0.3.37(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8))
-      '@langchain/openai': 0.3.17(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)))(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))
+      '@langchain/core': 0.3.38(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8))
+      '@langchain/openai': 0.3.17(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)))(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))
       groq-sdk: 0.5.0(encoding@0.1.13)
       zod: 3.23.8
       zod-to-json-schema: 3.24.1(zod@3.23.8)
@@ -37071,10 +37294,10 @@ snapshots:
       - ws
     optional: true
 
-  '@langchain/groq@0.1.3(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))':
+  '@langchain/groq@0.1.3(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))':
     dependencies:
-      '@langchain/core': 0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1))
-      '@langchain/openai': 0.3.17(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
+      '@langchain/core': 0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1))
+      '@langchain/openai': 0.3.17(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
       groq-sdk: 0.5.0(encoding@0.1.13)
       zod: 3.23.8
       zod-to-json-schema: 3.24.1(zod@3.23.8)
@@ -37082,9 +37305,9 @@ snapshots:
       - encoding
       - ws
 
-  '@langchain/langgraph-checkpoint@0.0.15(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))':
+  '@langchain/langgraph-checkpoint@0.0.15(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))':
     dependencies:
-      '@langchain/core': 0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1))
+      '@langchain/core': 0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1))
       uuid: 10.0.0
 
   '@langchain/langgraph-sdk@0.0.36':
@@ -37094,17 +37317,17 @@ snapshots:
       p-retry: 4.6.2
       uuid: 9.0.1
 
-  '@langchain/langgraph@0.2.44(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))':
+  '@langchain/langgraph@0.2.44(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))':
     dependencies:
-      '@langchain/core': 0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1))
-      '@langchain/langgraph-checkpoint': 0.0.15(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))
+      '@langchain/core': 0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1))
+      '@langchain/langgraph-checkpoint': 0.0.15(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))
       '@langchain/langgraph-sdk': 0.0.36
       uuid: 10.0.0
       zod: 3.23.8
 
-  '@langchain/openai@0.3.17(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))':
+  '@langchain/openai@0.3.17(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))':
     dependencies:
-      '@langchain/core': 0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))
+      '@langchain/core': 0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))
       js-tiktoken: 1.0.15
       openai: 4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)
       zod: 3.23.8
@@ -37113,9 +37336,9 @@ snapshots:
       - encoding
       - ws
 
-  '@langchain/openai@0.3.17(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))':
+  '@langchain/openai@0.3.17(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))':
     dependencies:
-      '@langchain/core': 0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))
+      '@langchain/core': 0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))
       js-tiktoken: 1.0.15
       openai: 4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))(zod@3.23.8)
       zod: 3.23.8
@@ -37124,9 +37347,9 @@ snapshots:
       - encoding
       - ws
 
-  '@langchain/openai@0.3.17(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)))(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))':
+  '@langchain/openai@0.3.17(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)))(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))':
     dependencies:
-      '@langchain/core': 0.3.37(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8))
+      '@langchain/core': 0.3.38(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8))
       js-tiktoken: 1.0.15
       openai: 4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)
       zod: 3.23.8
@@ -37135,9 +37358,9 @@ snapshots:
       - encoding
       - ws
 
-  '@langchain/openai@0.3.17(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))':
+  '@langchain/openai@0.3.17(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))':
     dependencies:
-      '@langchain/core': 0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1))
+      '@langchain/core': 0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1))
       js-tiktoken: 1.0.15
       openai: 4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)
       zod: 3.23.8
@@ -37146,19 +37369,19 @@ snapshots:
       - encoding
       - ws
 
-  '@langchain/textsplitters@0.1.0(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))':
+  '@langchain/textsplitters@0.1.0(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))':
     dependencies:
-      '@langchain/core': 0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))
+      '@langchain/core': 0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))
       js-tiktoken: 1.0.15
 
-  '@langchain/textsplitters@0.1.0(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)))':
+  '@langchain/textsplitters@0.1.0(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)))':
     dependencies:
-      '@langchain/core': 0.3.37(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8))
+      '@langchain/core': 0.3.38(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8))
       js-tiktoken: 1.0.15
 
-  '@langchain/textsplitters@0.1.0(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))':
+  '@langchain/textsplitters@0.1.0(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))':
     dependencies:
-      '@langchain/core': 0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1))
+      '@langchain/core': 0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1))
       js-tiktoken: 1.0.15
 
   '@ledgerhq/devices@6.27.1':
@@ -37604,18 +37827,18 @@ snapshots:
       - typescript
       - utf-8-validate
 
-  '@lit-protocol/access-control-conditions@7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)':
+  '@lit-protocol/access-control-conditions@7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)':
     dependencies:
       '@ethersproject/abstract-provider': 5.7.0
       '@ethersproject/contracts': 5.7.0
       '@ethersproject/providers': 5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10)
       '@lit-protocol/accs-schemas': 0.0.22
-      '@lit-protocol/constants': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/constants': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/contracts': 0.0.74(typescript@5.7.3)
-      '@lit-protocol/logger': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/misc': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/types': 7.0.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
-      '@lit-protocol/uint8arrays': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/logger': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/misc': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/types': 7.0.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)
+      '@lit-protocol/uint8arrays': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@openagenda/verror': 3.1.4
       ajv: 8.17.1
       bech32: 2.0.0
@@ -37718,7 +37941,7 @@ snapshots:
       - typescript
       - utf-8-validate
 
-  '@lit-protocol/auth-browser@7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)':
+  '@lit-protocol/auth-browser@7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)':
     dependencies:
       '@ethersproject/abstract-provider': 5.7.0
       '@ethersproject/bytes': 5.7.0
@@ -37727,12 +37950,12 @@ snapshots:
       '@ethersproject/strings': 5.7.0
       '@ethersproject/wallet': 5.7.0
       '@lit-protocol/accs-schemas': 0.0.22
-      '@lit-protocol/constants': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/logger': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/misc': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/misc-browser': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/types': 7.0.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
-      '@lit-protocol/uint8arrays': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/constants': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/logger': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/misc': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/misc-browser': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/types': 7.0.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)
+      '@lit-protocol/uint8arrays': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@openagenda/verror': 3.1.4
       ajv: 8.17.1
       bech32: 2.0.0
@@ -37769,19 +37992,19 @@ snapshots:
       - typescript
       - utf-8-validate
 
-  '@lit-protocol/auth-helpers@7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)':
+  '@lit-protocol/auth-helpers@7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)':
     dependencies:
       '@ethersproject/abstract-provider': 5.7.0
       '@ethersproject/contracts': 5.7.0
       '@ethersproject/providers': 5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10)
-      '@lit-protocol/access-control-conditions': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/access-control-conditions': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/accs-schemas': 0.0.22
-      '@lit-protocol/constants': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/constants': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/contracts': 0.0.74(typescript@5.7.3)
-      '@lit-protocol/logger': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/misc': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/types': 7.0.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
-      '@lit-protocol/uint8arrays': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/logger': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/misc': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/types': 7.0.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)
+      '@lit-protocol/uint8arrays': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@openagenda/verror': 3.1.4
       ajv: 8.17.1
       bech32: 2.0.0
@@ -37796,7 +38019,7 @@ snapshots:
       - typescript
       - utf-8-validate
 
-  '@lit-protocol/aw-tool@0.1.0-17(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)':
+  '@lit-protocol/aw-tool@0.1.0-19(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)':
     dependencies:
       '@lit-protocol/constants': 7.0.2(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       tslib: 2.8.1
@@ -37850,12 +38073,12 @@ snapshots:
       - typescript
       - utf-8-validate
 
-  '@lit-protocol/constants@7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)':
+  '@lit-protocol/constants@7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)':
     dependencies:
       '@ethersproject/abstract-provider': 5.7.0
       '@lit-protocol/accs-schemas': 0.0.22
       '@lit-protocol/contracts': 0.0.74(typescript@5.7.3)
-      '@lit-protocol/types': 7.0.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
+      '@lit-protocol/types': 7.0.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)
       '@openagenda/verror': 3.1.4
       depd: 2.0.0
       ethers: 5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10)
@@ -37898,18 +38121,18 @@ snapshots:
       - typescript
       - utf-8-validate
 
-  '@lit-protocol/contracts-sdk@7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)':
+  '@lit-protocol/contracts-sdk@7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)':
     dependencies:
       '@ethersproject/abi': 5.7.0
       '@ethersproject/abstract-provider': 5.7.0
       '@ethersproject/contracts': 5.7.0
       '@ethersproject/providers': 5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10)
       '@lit-protocol/accs-schemas': 0.0.22
-      '@lit-protocol/constants': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/constants': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/contracts': 0.0.74(typescript@5.7.3)
-      '@lit-protocol/logger': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/misc': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/types': 7.0.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
+      '@lit-protocol/logger': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/misc': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/types': 7.0.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)
       '@openagenda/verror': 3.1.4
       ajv: 8.17.1
       bech32: 2.0.0
@@ -37975,24 +38198,24 @@ snapshots:
       - typescript
       - utf-8-validate
 
-  '@lit-protocol/core@7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)':
+  '@lit-protocol/core@7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)':
     dependencies:
       '@ethersproject/abi': 5.7.0
       '@ethersproject/abstract-provider': 5.7.0
       '@ethersproject/contracts': 5.7.0
       '@ethersproject/providers': 5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10)
-      '@lit-protocol/access-control-conditions': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/access-control-conditions': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/accs-schemas': 0.0.22
-      '@lit-protocol/constants': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/constants': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/contracts': 0.0.74(typescript@5.7.3)
-      '@lit-protocol/contracts-sdk': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/crypto': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/logger': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/misc': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/nacl': 7.0.4
-      '@lit-protocol/types': 7.0.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
-      '@lit-protocol/uint8arrays': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/wasm': 7.0.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
+      '@lit-protocol/contracts-sdk': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/crypto': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/logger': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/misc': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/nacl': 7.0.5
+      '@lit-protocol/types': 7.0.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)
+      '@lit-protocol/uint8arrays': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/wasm': 7.0.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)
       '@openagenda/verror': 3.1.4
       ajv: 8.17.1
       bech32: 2.0.0
@@ -38055,20 +38278,20 @@ snapshots:
       - typescript
       - utf-8-validate
 
-  '@lit-protocol/crypto@7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)':
+  '@lit-protocol/crypto@7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)':
     dependencies:
       '@ethersproject/abstract-provider': 5.7.0
       '@ethersproject/contracts': 5.7.0
       '@ethersproject/providers': 5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10)
       '@lit-protocol/accs-schemas': 0.0.22
-      '@lit-protocol/constants': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/constants': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/contracts': 0.0.74(typescript@5.7.3)
-      '@lit-protocol/logger': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/misc': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/nacl': 7.0.4
-      '@lit-protocol/types': 7.0.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
-      '@lit-protocol/uint8arrays': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/wasm': 7.0.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
+      '@lit-protocol/logger': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/misc': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/nacl': 7.0.5
+      '@lit-protocol/types': 7.0.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)
+      '@lit-protocol/uint8arrays': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/wasm': 7.0.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)
       '@openagenda/verror': 3.1.4
       ajv: 8.17.1
       bech32: 2.0.0
@@ -38138,18 +38361,18 @@ snapshots:
       - typescript
       - utf-8-validate
 
-  '@lit-protocol/encryption@7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)':
+  '@lit-protocol/encryption@7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)':
     dependencies:
       '@ethersproject/abstract-provider': 5.7.0
       '@ethersproject/contracts': 5.7.0
       '@ethersproject/providers': 5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10)
       '@lit-protocol/accs-schemas': 0.0.22
-      '@lit-protocol/constants': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/constants': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/contracts': 0.0.74(typescript@5.7.3)
-      '@lit-protocol/logger': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/misc': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/types': 7.0.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
-      '@lit-protocol/uint8arrays': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/logger': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/misc': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/types': 7.0.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)
+      '@lit-protocol/uint8arrays': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@openagenda/verror': 3.1.4
       ajv: 8.17.1
       bech32: 2.0.0
@@ -38163,7 +38386,7 @@ snapshots:
       - typescript
       - utf-8-validate
 
-  '@lit-protocol/lit-auth-client@7.0.4(@walletconnect/modal@2.6.1(react@19.0.0))(bufferutil@4.0.9)(encoding@0.1.13)(ioredis@5.4.2)(typescript@5.7.3)(utf-8-validate@5.0.10)':
+  '@lit-protocol/lit-auth-client@7.0.5(@walletconnect/modal@2.6.1(react@19.0.0))(bufferutil@4.0.9)(encoding@0.1.13)(ioredis@5.4.2)(typescript@5.7.3)(utf-8-validate@5.0.10)':
     dependencies:
       '@ethersproject/abi': 5.7.0
       '@ethersproject/abstract-provider': 5.7.0
@@ -38173,24 +38396,24 @@ snapshots:
       '@ethersproject/strings': 5.7.0
       '@ethersproject/transactions': 5.7.0
       '@ethersproject/wallet': 5.7.0
-      '@lit-protocol/access-control-conditions': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/access-control-conditions': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/accs-schemas': 0.0.22
-      '@lit-protocol/auth-browser': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/auth-helpers': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/constants': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/auth-browser': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/auth-helpers': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/constants': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/contracts': 0.0.74(typescript@5.7.3)
-      '@lit-protocol/contracts-sdk': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/core': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/crypto': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/lit-node-client': 7.0.4(@walletconnect/modal@2.6.1(react@19.0.0))(bufferutil@4.0.9)(encoding@0.1.13)(ioredis@5.4.2)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/lit-node-client-nodejs': 7.0.4(bufferutil@4.0.9)(encoding@0.1.13)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/logger': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/misc': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/misc-browser': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/nacl': 7.0.4
-      '@lit-protocol/types': 7.0.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
-      '@lit-protocol/uint8arrays': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/wasm': 7.0.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
+      '@lit-protocol/contracts-sdk': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/core': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/crypto': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/lit-node-client': 7.0.5(@walletconnect/modal@2.6.1(react@19.0.0))(bufferutil@4.0.9)(encoding@0.1.13)(ioredis@5.4.2)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/lit-node-client-nodejs': 7.0.5(bufferutil@4.0.9)(encoding@0.1.13)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/logger': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/misc': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/misc-browser': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/nacl': 7.0.5
+      '@lit-protocol/types': 7.0.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)
+      '@lit-protocol/uint8arrays': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/wasm': 7.0.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)
       '@openagenda/verror': 3.1.4
       '@walletconnect/ethereum-provider': 2.9.2(@walletconnect/modal@2.6.1(react@19.0.0))(bufferutil@4.0.9)(encoding@0.1.13)(ioredis@5.4.2)(utf-8-validate@5.0.10)
       ajv: 8.17.1
@@ -38284,28 +38507,28 @@ snapshots:
       - typescript
       - utf-8-validate
 
-  '@lit-protocol/lit-node-client-nodejs@7.0.4(bufferutil@4.0.9)(encoding@0.1.13)(typescript@5.7.3)(utf-8-validate@5.0.10)':
+  '@lit-protocol/lit-node-client-nodejs@7.0.5(bufferutil@4.0.9)(encoding@0.1.13)(typescript@5.7.3)(utf-8-validate@5.0.10)':
     dependencies:
       '@ethersproject/abi': 5.7.0
       '@ethersproject/abstract-provider': 5.7.0
       '@ethersproject/contracts': 5.7.0
       '@ethersproject/providers': 5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10)
       '@ethersproject/transactions': 5.7.0
-      '@lit-protocol/access-control-conditions': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/access-control-conditions': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/accs-schemas': 0.0.22
-      '@lit-protocol/auth-helpers': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/constants': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/auth-helpers': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/constants': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/contracts': 0.0.74(typescript@5.7.3)
-      '@lit-protocol/contracts-sdk': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/core': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/crypto': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/logger': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/misc': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/misc-browser': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/nacl': 7.0.4
-      '@lit-protocol/types': 7.0.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
-      '@lit-protocol/uint8arrays': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/wasm': 7.0.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
+      '@lit-protocol/contracts-sdk': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/core': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/crypto': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/logger': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/misc': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/misc-browser': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/nacl': 7.0.5
+      '@lit-protocol/types': 7.0.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)
+      '@lit-protocol/uint8arrays': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/wasm': 7.0.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)
       '@openagenda/verror': 3.1.4
       ajv: 8.17.1
       bech32: 2.0.0
@@ -38405,7 +38628,7 @@ snapshots:
       - utf-8-validate
       - web-vitals
 
-  '@lit-protocol/lit-node-client@7.0.4(@walletconnect/modal@2.6.1(react@19.0.0))(bufferutil@4.0.9)(encoding@0.1.13)(ioredis@5.4.2)(typescript@5.7.3)(utf-8-validate@5.0.10)':
+  '@lit-protocol/lit-node-client@7.0.5(@walletconnect/modal@2.6.1(react@19.0.0))(bufferutil@4.0.9)(encoding@0.1.13)(ioredis@5.4.2)(typescript@5.7.3)(utf-8-validate@5.0.10)':
     dependencies:
       '@ethersproject/abi': 5.7.0
       '@ethersproject/abstract-provider': 5.7.0
@@ -38415,23 +38638,23 @@ snapshots:
       '@ethersproject/strings': 5.7.0
       '@ethersproject/transactions': 5.7.0
       '@ethersproject/wallet': 5.7.0
-      '@lit-protocol/access-control-conditions': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/access-control-conditions': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/accs-schemas': 0.0.22
-      '@lit-protocol/auth-browser': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/auth-helpers': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/constants': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/auth-browser': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/auth-helpers': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/constants': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/contracts': 0.0.74(typescript@5.7.3)
-      '@lit-protocol/contracts-sdk': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/core': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/crypto': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/lit-node-client-nodejs': 7.0.4(bufferutil@4.0.9)(encoding@0.1.13)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/logger': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/misc': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/misc-browser': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/nacl': 7.0.4
-      '@lit-protocol/types': 7.0.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
-      '@lit-protocol/uint8arrays': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/wasm': 7.0.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
+      '@lit-protocol/contracts-sdk': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/core': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/crypto': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/lit-node-client-nodejs': 7.0.5(bufferutil@4.0.9)(encoding@0.1.13)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/logger': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/misc': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/misc-browser': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/nacl': 7.0.5
+      '@lit-protocol/types': 7.0.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)
+      '@lit-protocol/uint8arrays': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/wasm': 7.0.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)
       '@openagenda/verror': 3.1.4
       '@walletconnect/ethereum-provider': 2.9.2(@walletconnect/modal@2.6.1(react@19.0.0))(bufferutil@4.0.9)(encoding@0.1.13)(ioredis@5.4.2)(utf-8-validate@5.0.10)
       ajv: 8.17.1
@@ -38492,13 +38715,13 @@ snapshots:
       - typescript
       - utf-8-validate
 
-  '@lit-protocol/logger@7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)':
+  '@lit-protocol/logger@7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)':
     dependencies:
       '@ethersproject/abstract-provider': 5.7.0
       '@lit-protocol/accs-schemas': 0.0.22
-      '@lit-protocol/constants': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/constants': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/contracts': 0.0.74(typescript@5.7.3)
-      '@lit-protocol/types': 7.0.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
+      '@lit-protocol/types': 7.0.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)
       '@openagenda/verror': 3.1.4
       depd: 2.0.0
       ethers: 5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10)
@@ -38538,14 +38761,14 @@ snapshots:
       - typescript
       - utf-8-validate
 
-  '@lit-protocol/misc-browser@7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)':
+  '@lit-protocol/misc-browser@7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)':
     dependencies:
       '@ethersproject/abstract-provider': 5.7.0
       '@lit-protocol/accs-schemas': 0.0.22
-      '@lit-protocol/constants': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/constants': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/contracts': 0.0.74(typescript@5.7.3)
-      '@lit-protocol/types': 7.0.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
-      '@lit-protocol/uint8arrays': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/types': 7.0.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)
+      '@lit-protocol/uint8arrays': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@openagenda/verror': 3.1.4
       depd: 2.0.0
       ethers: 5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10)
@@ -38583,16 +38806,16 @@ snapshots:
       - typescript
       - utf-8-validate
 
-  '@lit-protocol/misc@7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)':
+  '@lit-protocol/misc@7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)':
     dependencies:
       '@ethersproject/abstract-provider': 5.7.0
       '@ethersproject/contracts': 5.7.0
       '@ethersproject/providers': 5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10)
       '@lit-protocol/accs-schemas': 0.0.22
-      '@lit-protocol/constants': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/constants': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/contracts': 0.0.74(typescript@5.7.3)
-      '@lit-protocol/logger': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/types': 7.0.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
+      '@lit-protocol/logger': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/types': 7.0.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)
       '@openagenda/verror': 3.1.4
       ajv: 8.17.1
       bech32: 2.0.0
@@ -38612,7 +38835,7 @@ snapshots:
     dependencies:
       tslib: 1.14.1
 
-  '@lit-protocol/nacl@7.0.4':
+  '@lit-protocol/nacl@7.0.5':
     dependencies:
       tslib: 1.14.1
 
@@ -38749,7 +38972,7 @@ snapshots:
       - utf-8-validate
       - web-vitals
 
-  '@lit-protocol/pkp-base@7.0.4(@walletconnect/modal@2.6.1(react@19.0.0))(bufferutil@4.0.9)(encoding@0.1.13)(ioredis@5.4.2)(typescript@5.7.3)(utf-8-validate@5.0.10)':
+  '@lit-protocol/pkp-base@7.0.5(@walletconnect/modal@2.6.1(react@19.0.0))(bufferutil@4.0.9)(encoding@0.1.13)(ioredis@5.4.2)(typescript@5.7.3)(utf-8-validate@5.0.10)':
     dependencies:
       '@ethersproject/abi': 5.7.0
       '@ethersproject/abstract-provider': 5.7.0
@@ -38759,24 +38982,24 @@ snapshots:
       '@ethersproject/strings': 5.7.0
       '@ethersproject/transactions': 5.7.0
       '@ethersproject/wallet': 5.7.0
-      '@lit-protocol/access-control-conditions': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/access-control-conditions': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/accs-schemas': 0.0.22
-      '@lit-protocol/auth-browser': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/auth-helpers': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/constants': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/auth-browser': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/auth-helpers': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/constants': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/contracts': 0.0.74(typescript@5.7.3)
-      '@lit-protocol/contracts-sdk': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/core': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/crypto': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/lit-node-client': 7.0.4(@walletconnect/modal@2.6.1(react@19.0.0))(bufferutil@4.0.9)(encoding@0.1.13)(ioredis@5.4.2)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/lit-node-client-nodejs': 7.0.4(bufferutil@4.0.9)(encoding@0.1.13)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/logger': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/misc': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/misc-browser': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/nacl': 7.0.4
-      '@lit-protocol/types': 7.0.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
-      '@lit-protocol/uint8arrays': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/wasm': 7.0.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
+      '@lit-protocol/contracts-sdk': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/core': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/crypto': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/lit-node-client': 7.0.5(@walletconnect/modal@2.6.1(react@19.0.0))(bufferutil@4.0.9)(encoding@0.1.13)(ioredis@5.4.2)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/lit-node-client-nodejs': 7.0.5(bufferutil@4.0.9)(encoding@0.1.13)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/logger': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/misc': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/misc-browser': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/nacl': 7.0.5
+      '@lit-protocol/types': 7.0.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)
+      '@lit-protocol/uint8arrays': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/wasm': 7.0.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)
       '@openagenda/verror': 3.1.4
       '@walletconnect/ethereum-provider': 2.9.2(@walletconnect/modal@2.6.1(react@19.0.0))(bufferutil@4.0.9)(encoding@0.1.13)(ioredis@5.4.2)(utf-8-validate@5.0.10)
       ajv: 8.17.1
@@ -39095,7 +39318,7 @@ snapshots:
       - utf-8-validate
       - web-vitals
 
-  '@lit-protocol/pkp-ethers@7.0.4(@walletconnect/modal@2.6.1(react@19.0.0))(bufferutil@4.0.9)(encoding@0.1.13)(ioredis@5.4.2)(typescript@5.7.3)(utf-8-validate@5.0.10)':
+  '@lit-protocol/pkp-ethers@7.0.5(@walletconnect/modal@2.6.1(react@19.0.0))(bufferutil@4.0.9)(encoding@0.1.13)(ioredis@5.4.2)(typescript@5.7.3)(utf-8-validate@5.0.10)':
     dependencies:
       '@ethersproject/abi': 5.7.0
       '@ethersproject/abstract-provider': 5.7.0
@@ -39115,25 +39338,25 @@ snapshots:
       '@ethersproject/transactions': 5.7.0
       '@ethersproject/wallet': 5.7.0
       '@ethersproject/wordlists': 5.7.0
-      '@lit-protocol/access-control-conditions': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/access-control-conditions': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/accs-schemas': 0.0.22
-      '@lit-protocol/auth-browser': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/auth-helpers': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/constants': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/auth-browser': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/auth-helpers': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/constants': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/contracts': 0.0.74(typescript@5.7.3)
-      '@lit-protocol/contracts-sdk': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/core': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/crypto': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/lit-node-client': 7.0.4(@walletconnect/modal@2.6.1(react@19.0.0))(bufferutil@4.0.9)(encoding@0.1.13)(ioredis@5.4.2)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/lit-node-client-nodejs': 7.0.4(bufferutil@4.0.9)(encoding@0.1.13)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/logger': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/misc': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/misc-browser': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/nacl': 7.0.4
-      '@lit-protocol/pkp-base': 7.0.4(@walletconnect/modal@2.6.1(react@19.0.0))(bufferutil@4.0.9)(encoding@0.1.13)(ioredis@5.4.2)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/types': 7.0.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
-      '@lit-protocol/uint8arrays': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/wasm': 7.0.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
+      '@lit-protocol/contracts-sdk': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/core': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/crypto': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/lit-node-client': 7.0.5(@walletconnect/modal@2.6.1(react@19.0.0))(bufferutil@4.0.9)(encoding@0.1.13)(ioredis@5.4.2)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/lit-node-client-nodejs': 7.0.5(bufferutil@4.0.9)(encoding@0.1.13)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/logger': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/misc': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/misc-browser': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/nacl': 7.0.5
+      '@lit-protocol/pkp-base': 7.0.5(@walletconnect/modal@2.6.1(react@19.0.0))(bufferutil@4.0.9)(encoding@0.1.13)(ioredis@5.4.2)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/types': 7.0.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)
+      '@lit-protocol/uint8arrays': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/wasm': 7.0.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)
       '@metamask/eth-sig-util': 5.0.2
       '@openagenda/verror': 3.1.4
       '@walletconnect/ethereum-provider': 2.9.2(@walletconnect/modal@2.6.1(react@19.0.0))(bufferutil@4.0.9)(encoding@0.1.13)(ioredis@5.4.2)(utf-8-validate@5.0.10)
@@ -39222,7 +39445,7 @@ snapshots:
       - bufferutil
       - utf-8-validate
 
-  '@lit-protocol/types@7.0.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)':
+  '@lit-protocol/types@7.0.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)':
     dependencies:
       '@ethersproject/abstract-provider': 5.7.0
       '@lit-protocol/accs-schemas': 0.0.22
@@ -39250,13 +39473,13 @@ snapshots:
       - typescript
       - utf-8-validate
 
-  '@lit-protocol/uint8arrays@7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)':
+  '@lit-protocol/uint8arrays@7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)':
     dependencies:
       '@ethersproject/abstract-provider': 5.7.0
       '@lit-protocol/accs-schemas': 0.0.22
-      '@lit-protocol/constants': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/constants': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/contracts': 0.0.74(typescript@5.7.3)
-      '@lit-protocol/types': 7.0.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
+      '@lit-protocol/types': 7.0.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)
       '@openagenda/verror': 3.1.4
       depd: 2.0.0
       ethers: 5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10)
@@ -39267,7 +39490,7 @@ snapshots:
       - typescript
       - utf-8-validate
 
-  '@lit-protocol/wasm@7.0.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)':
+  '@lit-protocol/wasm@7.0.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)':
     dependencies:
       ethers: 5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10)
       pako: 2.1.0
@@ -39276,19 +39499,19 @@ snapshots:
       - bufferutil
       - utf-8-validate
 
-  '@lit-protocol/wrapped-keys@7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)':
+  '@lit-protocol/wrapped-keys@7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)':
     dependencies:
       '@ethersproject/abstract-provider': 5.7.0
       '@ethersproject/contracts': 5.7.0
       '@ethersproject/providers': 5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10)
       '@lit-protocol/accs-schemas': 0.0.22
-      '@lit-protocol/constants': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/constants': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lit-protocol/contracts': 0.0.74(typescript@5.7.3)
-      '@lit-protocol/encryption': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/logger': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/misc': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@lit-protocol/types': 7.0.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
-      '@lit-protocol/uint8arrays': 7.0.4(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/encryption': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/logger': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/misc': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@lit-protocol/types': 7.0.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)
+      '@lit-protocol/uint8arrays': 7.0.5(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@openagenda/verror': 3.1.4
       ajv: 8.17.1
       bech32: 2.0.0
@@ -40024,7 +40247,7 @@ snapshots:
       '@solana/buffer-layout': 4.0.1
       '@solana/spl-token': 0.4.9(@solana/web3.js@1.95.5(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.6.3)(utf-8-validate@5.0.10)
       '@solana/web3.js': 1.95.5(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
-      '@types/node': 22.13.0
+      '@types/node': 22.13.1
       decimal.js: 10.5.0
       gaussian: 1.3.0
       js-sha256: 0.11.0
@@ -40045,7 +40268,7 @@ snapshots:
       '@solana/buffer-layout': 4.0.1
       '@solana/spl-token': 0.4.9(@solana/web3.js@1.95.5(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@solana/web3.js': 1.95.5(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
-      '@types/node': 22.13.0
+      '@types/node': 22.13.1
       decimal.js: 10.5.0
       gaussian: 1.3.0
       js-sha256: 0.11.0
@@ -40096,7 +40319,7 @@ snapshots:
       - typescript
       - utf-8-validate
 
-  '@meteora-ag/dlmm@1.3.10(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.6.3)(utf-8-validate@5.0.10)':
+  '@meteora-ag/dlmm@1.3.11(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.6.3)(utf-8-validate@5.0.10)':
     dependencies:
       '@coral-xyz/anchor': 0.28.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
       '@coral-xyz/borsh': 0.28.0(@solana/web3.js@1.95.5(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))
@@ -40116,7 +40339,7 @@ snapshots:
       - typescript
       - utf-8-validate
 
-  '@meteora-ag/dlmm@1.3.10(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10)':
+  '@meteora-ag/dlmm@1.3.11(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10)':
     dependencies:
       '@coral-xyz/anchor': 0.28.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
       '@coral-xyz/borsh': 0.28.0(@solana/web3.js@1.95.5(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))
@@ -40136,7 +40359,7 @@ snapshots:
       - typescript
       - utf-8-validate
 
-  '@meteora-ag/dlmm@1.3.10(bufferutil@4.0.9)(encoding@0.1.13)(typescript@5.7.3)(utf-8-validate@6.0.5)':
+  '@meteora-ag/dlmm@1.3.11(bufferutil@4.0.9)(encoding@0.1.13)(typescript@5.7.3)(utf-8-validate@6.0.5)':
     dependencies:
       '@coral-xyz/anchor': 0.28.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@6.0.5)
       '@coral-xyz/borsh': 0.28.0(@solana/web3.js@1.95.5(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@6.0.5))
@@ -40564,7 +40787,7 @@ snapshots:
     transitivePeerDependencies:
       - encoding
 
-  '@neynar/nodejs-sdk@2.9.0(bufferutil@4.0.9)(class-transformer@0.5.1)(encoding@0.1.13)(typescript@5.7.3)(utf-8-validate@6.0.5)(zod@3.24.1)':
+  '@neynar/nodejs-sdk@2.10.0(bufferutil@4.0.9)(class-transformer@0.5.1)(encoding@0.1.13)(typescript@5.7.3)(utf-8-validate@6.0.5)(zod@3.24.1)':
     dependencies:
       '@openapitools/openapi-generator-cli': 2.16.3(class-transformer@0.5.1)(encoding@0.1.13)
       semver: 7.7.1
@@ -40726,11 +40949,11 @@ snapshots:
       '@nomicfoundation/ethereumjs-rlp': 5.0.4
       ethereum-cryptography: 0.1.3
 
-  '@nomicfoundation/hardhat-ethers@3.0.8(ethers@5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10))(hardhat@2.22.18(bufferutil@4.0.9)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.7.3))(typescript@5.7.3)(utf-8-validate@5.0.10))':
+  '@nomicfoundation/hardhat-ethers@3.0.8(ethers@5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10))(hardhat@2.22.18(bufferutil@4.0.9)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.7.3))(typescript@5.7.3)(utf-8-validate@5.0.10))':
     dependencies:
       debug: 4.4.0(supports-color@8.1.1)
       ethers: 5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10)
-      hardhat: 2.22.18(bufferutil@4.0.9)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.7.3))(typescript@4.9.5)(utf-8-validate@5.0.10)
+      hardhat: 2.22.18(bufferutil@4.0.9)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.7.3))(typescript@4.9.5)(utf-8-validate@5.0.10)
       lodash.isequal: 4.5.0
     transitivePeerDependencies:
       - supports-color
@@ -41310,7 +41533,7 @@ snapshots:
       '@walletconnect/utils': 2.18.0(ioredis@5.4.2)
       postcss-cli: 11.0.0(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)
       preact: 10.25.4
-      tailwindcss: 3.4.17(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.6.3))
+      tailwindcss: 3.4.17(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.6.3))
     transitivePeerDependencies:
       - '@azure/app-configuration'
       - '@azure/cosmos'
@@ -41577,8 +41800,95 @@ snapshots:
       - encoding
       - supports-color
 
+  '@opentelemetry/api-logs@0.57.1':
+    dependencies:
+      '@opentelemetry/api': 1.9.0
+
   '@opentelemetry/api@1.9.0': {}
 
+  '@opentelemetry/context-async-hooks@1.30.1(@opentelemetry/api@1.9.0)':
+    dependencies:
+      '@opentelemetry/api': 1.9.0
+
+  '@opentelemetry/core@1.30.1(@opentelemetry/api@1.9.0)':
+    dependencies:
+      '@opentelemetry/api': 1.9.0
+      '@opentelemetry/semantic-conventions': 1.28.0
+
+  '@opentelemetry/exporter-trace-otlp-http@0.57.1(@opentelemetry/api@1.9.0)':
+    dependencies:
+      '@opentelemetry/api': 1.9.0
+      '@opentelemetry/core': 1.30.1(@opentelemetry/api@1.9.0)
+      '@opentelemetry/otlp-exporter-base': 0.57.1(@opentelemetry/api@1.9.0)
+      '@opentelemetry/otlp-transformer': 0.57.1(@opentelemetry/api@1.9.0)
+      '@opentelemetry/resources': 1.30.1(@opentelemetry/api@1.9.0)
+      '@opentelemetry/sdk-trace-base': 1.30.1(@opentelemetry/api@1.9.0)
+
+  '@opentelemetry/otlp-exporter-base@0.57.1(@opentelemetry/api@1.9.0)':
+    dependencies:
+      '@opentelemetry/api': 1.9.0
+      '@opentelemetry/core': 1.30.1(@opentelemetry/api@1.9.0)
+      '@opentelemetry/otlp-transformer': 0.57.1(@opentelemetry/api@1.9.0)
+
+  '@opentelemetry/otlp-transformer@0.57.1(@opentelemetry/api@1.9.0)':
+    dependencies:
+      '@opentelemetry/api': 1.9.0
+      '@opentelemetry/api-logs': 0.57.1
+      '@opentelemetry/core': 1.30.1(@opentelemetry/api@1.9.0)
+      '@opentelemetry/resources': 1.30.1(@opentelemetry/api@1.9.0)
+      '@opentelemetry/sdk-logs': 0.57.1(@opentelemetry/api@1.9.0)
+      '@opentelemetry/sdk-metrics': 1.30.1(@opentelemetry/api@1.9.0)
+      '@opentelemetry/sdk-trace-base': 1.30.1(@opentelemetry/api@1.9.0)
+      protobufjs: 7.4.0
+
+  '@opentelemetry/propagator-b3@1.30.1(@opentelemetry/api@1.9.0)':
+    dependencies:
+      '@opentelemetry/api': 1.9.0
+      '@opentelemetry/core': 1.30.1(@opentelemetry/api@1.9.0)
+
+  '@opentelemetry/propagator-jaeger@1.30.1(@opentelemetry/api@1.9.0)':
+    dependencies:
+      '@opentelemetry/api': 1.9.0
+      '@opentelemetry/core': 1.30.1(@opentelemetry/api@1.9.0)
+
+  '@opentelemetry/resources@1.30.1(@opentelemetry/api@1.9.0)':
+    dependencies:
+      '@opentelemetry/api': 1.9.0
+      '@opentelemetry/core': 1.30.1(@opentelemetry/api@1.9.0)
+      '@opentelemetry/semantic-conventions': 1.28.0
+
+  '@opentelemetry/sdk-logs@0.57.1(@opentelemetry/api@1.9.0)':
+    dependencies:
+      '@opentelemetry/api': 1.9.0
+      '@opentelemetry/api-logs': 0.57.1
+      '@opentelemetry/core': 1.30.1(@opentelemetry/api@1.9.0)
+      '@opentelemetry/resources': 1.30.1(@opentelemetry/api@1.9.0)
+
+  '@opentelemetry/sdk-metrics@1.30.1(@opentelemetry/api@1.9.0)':
+    dependencies:
+      '@opentelemetry/api': 1.9.0
+      '@opentelemetry/core': 1.30.1(@opentelemetry/api@1.9.0)
+      '@opentelemetry/resources': 1.30.1(@opentelemetry/api@1.9.0)
+
+  '@opentelemetry/sdk-trace-base@1.30.1(@opentelemetry/api@1.9.0)':
+    dependencies:
+      '@opentelemetry/api': 1.9.0
+      '@opentelemetry/core': 1.30.1(@opentelemetry/api@1.9.0)
+      '@opentelemetry/resources': 1.30.1(@opentelemetry/api@1.9.0)
+      '@opentelemetry/semantic-conventions': 1.28.0
+
+  '@opentelemetry/sdk-trace-node@1.30.1(@opentelemetry/api@1.9.0)':
+    dependencies:
+      '@opentelemetry/api': 1.9.0
+      '@opentelemetry/context-async-hooks': 1.30.1(@opentelemetry/api@1.9.0)
+      '@opentelemetry/core': 1.30.1(@opentelemetry/api@1.9.0)
+      '@opentelemetry/propagator-b3': 1.30.1(@opentelemetry/api@1.9.0)
+      '@opentelemetry/propagator-jaeger': 1.30.1(@opentelemetry/api@1.9.0)
+      '@opentelemetry/sdk-trace-base': 1.30.1(@opentelemetry/api@1.9.0)
+      semver: 7.7.1
+
+  '@opentelemetry/semantic-conventions@1.28.0': {}
+
   '@openzeppelin/contracts@5.2.0': {}
 
   '@orca-so/common-sdk@0.6.4(@solana/spl-token@0.4.9(@solana/web3.js@1.95.8(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.6.3)(utf-8-validate@5.0.10))(@solana/web3.js@1.95.8(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(decimal.js@10.5.0)':
@@ -42606,10 +42916,19 @@ snapshots:
       '@types/react': 19.0.8
       '@types/react-dom': 19.0.3(@types/react@19.0.8)
 
-  '@radix-ui/react-avatar@1.1.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)':
+  '@radix-ui/react-arrow@1.1.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)':
+    dependencies:
+      '@radix-ui/react-primitive': 2.0.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      react: 19.0.0
+      react-dom: 19.0.0(react@19.0.0)
+    optionalDependencies:
+      '@types/react': 19.0.8
+      '@types/react-dom': 19.0.3(@types/react@19.0.8)
+
+  '@radix-ui/react-avatar@1.1.3(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)':
     dependencies:
       '@radix-ui/react-context': 1.1.1(@types/react@19.0.8)(react@19.0.0)
-      '@radix-ui/react-primitive': 2.0.1(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-primitive': 2.0.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
       '@radix-ui/react-use-callback-ref': 1.1.0(@types/react@19.0.8)(react@19.0.0)
       '@radix-ui/react-use-layout-effect': 1.1.0(@types/react@19.0.8)(react@19.0.0)
       react: 19.0.0
@@ -42618,14 +42937,14 @@ snapshots:
       '@types/react': 19.0.8
       '@types/react-dom': 19.0.3(@types/react@19.0.8)
 
-  '@radix-ui/react-collapsible@1.1.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)':
+  '@radix-ui/react-collapsible@1.1.3(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)':
     dependencies:
       '@radix-ui/primitive': 1.1.1
       '@radix-ui/react-compose-refs': 1.1.1(@types/react@19.0.8)(react@19.0.0)
       '@radix-ui/react-context': 1.1.1(@types/react@19.0.8)(react@19.0.0)
       '@radix-ui/react-id': 1.1.0(@types/react@19.0.8)(react@19.0.0)
       '@radix-ui/react-presence': 1.1.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
-      '@radix-ui/react-primitive': 2.0.1(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-primitive': 2.0.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
       '@radix-ui/react-use-controllable-state': 1.1.0(@types/react@19.0.8)(react@19.0.0)
       '@radix-ui/react-use-layout-effect': 1.1.0(@types/react@19.0.8)(react@19.0.0)
       react: 19.0.0
@@ -42634,12 +42953,12 @@ snapshots:
       '@types/react': 19.0.8
       '@types/react-dom': 19.0.3(@types/react@19.0.8)
 
-  '@radix-ui/react-collection@1.1.1(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)':
+  '@radix-ui/react-collection@1.1.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)':
     dependencies:
       '@radix-ui/react-compose-refs': 1.1.1(@types/react@19.0.8)(react@19.0.0)
       '@radix-ui/react-context': 1.1.1(@types/react@19.0.8)(react@19.0.0)
-      '@radix-ui/react-primitive': 2.0.1(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
-      '@radix-ui/react-slot': 1.1.1(@types/react@19.0.8)(react@19.0.0)
+      '@radix-ui/react-primitive': 2.0.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-slot': 1.1.2(@types/react@19.0.8)(react@19.0.0)
       react: 19.0.0
       react-dom: 19.0.0(react@19.0.0)
     optionalDependencies:
@@ -42680,6 +42999,28 @@ snapshots:
       '@types/react': 19.0.8
       '@types/react-dom': 19.0.3(@types/react@19.0.8)
 
+  '@radix-ui/react-dialog@1.1.6(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)':
+    dependencies:
+      '@radix-ui/primitive': 1.1.1
+      '@radix-ui/react-compose-refs': 1.1.1(@types/react@19.0.8)(react@19.0.0)
+      '@radix-ui/react-context': 1.1.1(@types/react@19.0.8)(react@19.0.0)
+      '@radix-ui/react-dismissable-layer': 1.1.5(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-focus-guards': 1.1.1(@types/react@19.0.8)(react@19.0.0)
+      '@radix-ui/react-focus-scope': 1.1.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-id': 1.1.0(@types/react@19.0.8)(react@19.0.0)
+      '@radix-ui/react-portal': 1.1.4(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-presence': 1.1.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-primitive': 2.0.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-slot': 1.1.2(@types/react@19.0.8)(react@19.0.0)
+      '@radix-ui/react-use-controllable-state': 1.1.0(@types/react@19.0.8)(react@19.0.0)
+      aria-hidden: 1.2.4
+      react: 19.0.0
+      react-dom: 19.0.0(react@19.0.0)
+      react-remove-scroll: 2.6.3(@types/react@19.0.8)(react@19.0.0)
+    optionalDependencies:
+      '@types/react': 19.0.8
+      '@types/react-dom': 19.0.3(@types/react@19.0.8)
+
   '@radix-ui/react-direction@1.1.0(@types/react@19.0.8)(react@19.0.0)':
     dependencies:
       react: 19.0.0
@@ -42699,6 +43040,19 @@ snapshots:
       '@types/react': 19.0.8
       '@types/react-dom': 19.0.3(@types/react@19.0.8)
 
+  '@radix-ui/react-dismissable-layer@1.1.5(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)':
+    dependencies:
+      '@radix-ui/primitive': 1.1.1
+      '@radix-ui/react-compose-refs': 1.1.1(@types/react@19.0.8)(react@19.0.0)
+      '@radix-ui/react-primitive': 2.0.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-use-callback-ref': 1.1.0(@types/react@19.0.8)(react@19.0.0)
+      '@radix-ui/react-use-escape-keydown': 1.1.0(@types/react@19.0.8)(react@19.0.0)
+      react: 19.0.0
+      react-dom: 19.0.0(react@19.0.0)
+    optionalDependencies:
+      '@types/react': 19.0.8
+      '@types/react-dom': 19.0.3(@types/react@19.0.8)
+
   '@radix-ui/react-focus-guards@1.1.1(@types/react@19.0.8)(react@19.0.0)':
     dependencies:
       react: 19.0.0
@@ -42716,6 +43070,17 @@ snapshots:
       '@types/react': 19.0.8
       '@types/react-dom': 19.0.3(@types/react@19.0.8)
 
+  '@radix-ui/react-focus-scope@1.1.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)':
+    dependencies:
+      '@radix-ui/react-compose-refs': 1.1.1(@types/react@19.0.8)(react@19.0.0)
+      '@radix-ui/react-primitive': 2.0.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-use-callback-ref': 1.1.0(@types/react@19.0.8)(react@19.0.0)
+      react: 19.0.0
+      react-dom: 19.0.0(react@19.0.0)
+    optionalDependencies:
+      '@types/react': 19.0.8
+      '@types/react-dom': 19.0.3(@types/react@19.0.8)
+
   '@radix-ui/react-icons@1.3.2(react@19.0.0)':
     dependencies:
       react: 19.0.0
@@ -42727,9 +43092,9 @@ snapshots:
     optionalDependencies:
       '@types/react': 19.0.8
 
-  '@radix-ui/react-label@2.1.1(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)':
+  '@radix-ui/react-label@2.1.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)':
     dependencies:
-      '@radix-ui/react-primitive': 2.0.1(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-primitive': 2.0.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
       react: 19.0.0
       react-dom: 19.0.0(react@19.0.0)
     optionalDependencies:
@@ -42754,6 +43119,24 @@ snapshots:
       '@types/react': 19.0.8
       '@types/react-dom': 19.0.3(@types/react@19.0.8)
 
+  '@radix-ui/react-popper@1.2.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)':
+    dependencies:
+      '@floating-ui/react-dom': 2.1.2(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-arrow': 1.1.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-compose-refs': 1.1.1(@types/react@19.0.8)(react@19.0.0)
+      '@radix-ui/react-context': 1.1.1(@types/react@19.0.8)(react@19.0.0)
+      '@radix-ui/react-primitive': 2.0.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-use-callback-ref': 1.1.0(@types/react@19.0.8)(react@19.0.0)
+      '@radix-ui/react-use-layout-effect': 1.1.0(@types/react@19.0.8)(react@19.0.0)
+      '@radix-ui/react-use-rect': 1.1.0(@types/react@19.0.8)(react@19.0.0)
+      '@radix-ui/react-use-size': 1.1.0(@types/react@19.0.8)(react@19.0.0)
+      '@radix-ui/rect': 1.1.0
+      react: 19.0.0
+      react-dom: 19.0.0(react@19.0.0)
+    optionalDependencies:
+      '@types/react': 19.0.8
+      '@types/react-dom': 19.0.3(@types/react@19.0.8)
+
   '@radix-ui/react-portal@1.1.3(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)':
     dependencies:
       '@radix-ui/react-primitive': 2.0.1(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
@@ -42764,6 +43147,16 @@ snapshots:
       '@types/react': 19.0.8
       '@types/react-dom': 19.0.3(@types/react@19.0.8)
 
+  '@radix-ui/react-portal@1.1.4(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)':
+    dependencies:
+      '@radix-ui/react-primitive': 2.0.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-use-layout-effect': 1.1.0(@types/react@19.0.8)(react@19.0.0)
+      react: 19.0.0
+      react-dom: 19.0.0(react@19.0.0)
+    optionalDependencies:
+      '@types/react': 19.0.8
+      '@types/react-dom': 19.0.3(@types/react@19.0.8)
+
   '@radix-ui/react-presence@1.1.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)':
     dependencies:
       '@radix-ui/react-compose-refs': 1.1.1(@types/react@19.0.8)(react@19.0.0)
@@ -42783,15 +43176,24 @@ snapshots:
       '@types/react': 19.0.8
       '@types/react-dom': 19.0.3(@types/react@19.0.8)
 
-  '@radix-ui/react-roving-focus@1.1.1(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)':
+  '@radix-ui/react-primitive@2.0.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)':
+    dependencies:
+      '@radix-ui/react-slot': 1.1.2(@types/react@19.0.8)(react@19.0.0)
+      react: 19.0.0
+      react-dom: 19.0.0(react@19.0.0)
+    optionalDependencies:
+      '@types/react': 19.0.8
+      '@types/react-dom': 19.0.3(@types/react@19.0.8)
+
+  '@radix-ui/react-roving-focus@1.1.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)':
     dependencies:
       '@radix-ui/primitive': 1.1.1
-      '@radix-ui/react-collection': 1.1.1(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-collection': 1.1.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
       '@radix-ui/react-compose-refs': 1.1.1(@types/react@19.0.8)(react@19.0.0)
       '@radix-ui/react-context': 1.1.1(@types/react@19.0.8)(react@19.0.0)
       '@radix-ui/react-direction': 1.1.0(@types/react@19.0.8)(react@19.0.0)
       '@radix-ui/react-id': 1.1.0(@types/react@19.0.8)(react@19.0.0)
-      '@radix-ui/react-primitive': 2.0.1(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-primitive': 2.0.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
       '@radix-ui/react-use-callback-ref': 1.1.0(@types/react@19.0.8)(react@19.0.0)
       '@radix-ui/react-use-controllable-state': 1.1.0(@types/react@19.0.8)(react@19.0.0)
       react: 19.0.0
@@ -42800,9 +43202,9 @@ snapshots:
       '@types/react': 19.0.8
       '@types/react-dom': 19.0.3(@types/react@19.0.8)
 
-  '@radix-ui/react-separator@1.1.1(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)':
+  '@radix-ui/react-separator@1.1.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)':
     dependencies:
-      '@radix-ui/react-primitive': 2.0.1(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-primitive': 2.0.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
       react: 19.0.0
       react-dom: 19.0.0(react@19.0.0)
     optionalDependencies:
@@ -42816,15 +43218,22 @@ snapshots:
     optionalDependencies:
       '@types/react': 19.0.8
 
-  '@radix-ui/react-tabs@1.1.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)':
+  '@radix-ui/react-slot@1.1.2(@types/react@19.0.8)(react@19.0.0)':
+    dependencies:
+      '@radix-ui/react-compose-refs': 1.1.1(@types/react@19.0.8)(react@19.0.0)
+      react: 19.0.0
+    optionalDependencies:
+      '@types/react': 19.0.8
+
+  '@radix-ui/react-tabs@1.1.3(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)':
     dependencies:
       '@radix-ui/primitive': 1.1.1
       '@radix-ui/react-context': 1.1.1(@types/react@19.0.8)(react@19.0.0)
       '@radix-ui/react-direction': 1.1.0(@types/react@19.0.8)(react@19.0.0)
       '@radix-ui/react-id': 1.1.0(@types/react@19.0.8)(react@19.0.0)
       '@radix-ui/react-presence': 1.1.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
-      '@radix-ui/react-primitive': 2.0.1(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
-      '@radix-ui/react-roving-focus': 1.1.1(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-primitive': 2.0.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-roving-focus': 1.1.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
       '@radix-ui/react-use-controllable-state': 1.1.0(@types/react@19.0.8)(react@19.0.0)
       react: 19.0.0
       react-dom: 19.0.0(react@19.0.0)
@@ -42832,20 +43241,20 @@ snapshots:
       '@types/react': 19.0.8
       '@types/react-dom': 19.0.3(@types/react@19.0.8)
 
-  '@radix-ui/react-toast@1.2.5(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)':
+  '@radix-ui/react-toast@1.2.6(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)':
     dependencies:
       '@radix-ui/primitive': 1.1.1
-      '@radix-ui/react-collection': 1.1.1(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-collection': 1.1.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
       '@radix-ui/react-compose-refs': 1.1.1(@types/react@19.0.8)(react@19.0.0)
       '@radix-ui/react-context': 1.1.1(@types/react@19.0.8)(react@19.0.0)
-      '@radix-ui/react-dismissable-layer': 1.1.4(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
-      '@radix-ui/react-portal': 1.1.3(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-dismissable-layer': 1.1.5(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-portal': 1.1.4(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
       '@radix-ui/react-presence': 1.1.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
-      '@radix-ui/react-primitive': 2.0.1(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-primitive': 2.0.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
       '@radix-ui/react-use-callback-ref': 1.1.0(@types/react@19.0.8)(react@19.0.0)
       '@radix-ui/react-use-controllable-state': 1.1.0(@types/react@19.0.8)(react@19.0.0)
       '@radix-ui/react-use-layout-effect': 1.1.0(@types/react@19.0.8)(react@19.0.0)
-      '@radix-ui/react-visually-hidden': 1.1.1(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-visually-hidden': 1.1.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
       react: 19.0.0
       react-dom: 19.0.0(react@19.0.0)
     optionalDependencies:
@@ -42872,6 +43281,26 @@ snapshots:
       '@types/react': 19.0.8
       '@types/react-dom': 19.0.3(@types/react@19.0.8)
 
+  '@radix-ui/react-tooltip@1.1.8(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)':
+    dependencies:
+      '@radix-ui/primitive': 1.1.1
+      '@radix-ui/react-compose-refs': 1.1.1(@types/react@19.0.8)(react@19.0.0)
+      '@radix-ui/react-context': 1.1.1(@types/react@19.0.8)(react@19.0.0)
+      '@radix-ui/react-dismissable-layer': 1.1.5(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-id': 1.1.0(@types/react@19.0.8)(react@19.0.0)
+      '@radix-ui/react-popper': 1.2.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-portal': 1.1.4(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-presence': 1.1.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-primitive': 2.0.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      '@radix-ui/react-slot': 1.1.2(@types/react@19.0.8)(react@19.0.0)
+      '@radix-ui/react-use-controllable-state': 1.1.0(@types/react@19.0.8)(react@19.0.0)
+      '@radix-ui/react-visually-hidden': 1.1.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      react: 19.0.0
+      react-dom: 19.0.0(react@19.0.0)
+    optionalDependencies:
+      '@types/react': 19.0.8
+      '@types/react-dom': 19.0.3(@types/react@19.0.8)
+
   '@radix-ui/react-use-callback-ref@1.1.0(@types/react@19.0.8)(react@19.0.0)':
     dependencies:
       react: 19.0.0
@@ -42921,6 +43350,15 @@ snapshots:
       '@types/react': 19.0.8
       '@types/react-dom': 19.0.3(@types/react@19.0.8)
 
+  '@radix-ui/react-visually-hidden@1.1.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)':
+    dependencies:
+      '@radix-ui/react-primitive': 2.0.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
+      react: 19.0.0
+      react-dom: 19.0.0(react@19.0.0)
+    optionalDependencies:
+      '@types/react': 19.0.8
+      '@types/react-dom': 19.0.3(@types/react@19.0.8)
+
   '@radix-ui/rect@1.1.0': {}
 
   '@randlabs/communication-bridge@1.0.1':
@@ -43194,11 +43632,11 @@ snapshots:
     optionalDependencies:
       rollup: 3.29.5
 
-  '@rollup/plugin-json@6.1.0(rollup@4.34.1)':
+  '@rollup/plugin-json@6.1.0(rollup@4.34.4)':
     dependencies:
-      '@rollup/pluginutils': 5.1.4(rollup@4.34.1)
+      '@rollup/pluginutils': 5.1.4(rollup@4.34.4)
     optionalDependencies:
-      rollup: 4.34.1
+      rollup: 4.34.4
 
   '@rollup/plugin-node-resolve@15.3.0(rollup@2.79.2)':
     dependencies:
@@ -43236,7 +43674,7 @@ snapshots:
 
   '@rollup/plugin-terser@0.1.0(rollup@2.79.2)':
     dependencies:
-      terser: 5.37.0
+      terser: 5.38.0
     optionalDependencies:
       rollup: 2.79.2
 
@@ -43265,69 +43703,69 @@ snapshots:
     optionalDependencies:
       rollup: 3.29.5
 
-  '@rollup/pluginutils@5.1.4(rollup@4.34.1)':
+  '@rollup/pluginutils@5.1.4(rollup@4.34.4)':
     dependencies:
       '@types/estree': 1.0.6
       estree-walker: 2.0.2
       picomatch: 4.0.2
     optionalDependencies:
-      rollup: 4.34.1
+      rollup: 4.34.4
 
-  '@rollup/rollup-android-arm-eabi@4.34.1':
+  '@rollup/rollup-android-arm-eabi@4.34.4':
     optional: true
 
-  '@rollup/rollup-android-arm64@4.34.1':
+  '@rollup/rollup-android-arm64@4.34.4':
     optional: true
 
-  '@rollup/rollup-darwin-arm64@4.34.1':
+  '@rollup/rollup-darwin-arm64@4.34.4':
     optional: true
 
-  '@rollup/rollup-darwin-x64@4.34.1':
+  '@rollup/rollup-darwin-x64@4.34.4':
     optional: true
 
-  '@rollup/rollup-freebsd-arm64@4.34.1':
+  '@rollup/rollup-freebsd-arm64@4.34.4':
     optional: true
 
-  '@rollup/rollup-freebsd-x64@4.34.1':
+  '@rollup/rollup-freebsd-x64@4.34.4':
     optional: true
 
-  '@rollup/rollup-linux-arm-gnueabihf@4.34.1':
+  '@rollup/rollup-linux-arm-gnueabihf@4.34.4':
     optional: true
 
-  '@rollup/rollup-linux-arm-musleabihf@4.34.1':
+  '@rollup/rollup-linux-arm-musleabihf@4.34.4':
     optional: true
 
-  '@rollup/rollup-linux-arm64-gnu@4.34.1':
+  '@rollup/rollup-linux-arm64-gnu@4.34.4':
     optional: true
 
-  '@rollup/rollup-linux-arm64-musl@4.34.1':
+  '@rollup/rollup-linux-arm64-musl@4.34.4':
     optional: true
 
-  '@rollup/rollup-linux-loongarch64-gnu@4.34.1':
+  '@rollup/rollup-linux-loongarch64-gnu@4.34.4':
     optional: true
 
-  '@rollup/rollup-linux-powerpc64le-gnu@4.34.1':
+  '@rollup/rollup-linux-powerpc64le-gnu@4.34.4':
     optional: true
 
-  '@rollup/rollup-linux-riscv64-gnu@4.34.1':
+  '@rollup/rollup-linux-riscv64-gnu@4.34.4':
     optional: true
 
-  '@rollup/rollup-linux-s390x-gnu@4.34.1':
+  '@rollup/rollup-linux-s390x-gnu@4.34.4':
     optional: true
 
-  '@rollup/rollup-linux-x64-gnu@4.34.1':
+  '@rollup/rollup-linux-x64-gnu@4.34.4':
     optional: true
 
-  '@rollup/rollup-linux-x64-musl@4.34.1':
+  '@rollup/rollup-linux-x64-musl@4.34.4':
     optional: true
 
-  '@rollup/rollup-win32-arm64-msvc@4.34.1':
+  '@rollup/rollup-win32-arm64-msvc@4.34.4':
     optional: true
 
-  '@rollup/rollup-win32-ia32-msvc@4.34.1':
+  '@rollup/rollup-win32-ia32-msvc@4.34.4':
     optional: true
 
-  '@rollup/rollup-win32-x64-msvc@4.34.1':
+  '@rollup/rollup-win32-x64-msvc@4.34.4':
     optional: true
 
   '@rtsao/scc@1.1.0': {}
@@ -43661,7 +44099,7 @@ snapshots:
       '@cosmjs/tendermint-rpc': 0.32.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
       '@injectivelabs/core-proto-ts': 0.0.21
       '@injectivelabs/sdk-ts': 1.14.5(@types/react@19.0.8)(bufferutil@4.0.9)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)(utf-8-validate@5.0.10)
-      '@keplr-wallet/unit': 0.12.179(starknet@6.18.0(encoding@0.1.13))
+      '@keplr-wallet/unit': 0.12.183(starknet@6.18.0(encoding@0.1.13))
       '@solana/wallet-adapter-base': 0.9.23(@solana/web3.js@1.92.3(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))
       axios: 1.7.9
       cosmjs-types: 0.9.0
@@ -45653,7 +46091,7 @@ snapshots:
       '@solana/spl-token': 0.3.7(@solana/web3.js@1.95.5(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
       '@solana/web3.js': 1.95.5(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
       '@types/bn.js': 5.1.6
-      '@types/node': 18.19.74
+      '@types/node': 18.19.75
       '@types/node-fetch': 2.6.12
       bn.js: 5.2.1
       decimal.js: 10.5.0
@@ -46072,7 +46510,7 @@ snapshots:
     dependencies:
       '@swc/counter': 0.1.3
 
-  '@switchboard-xyz/common@2.5.17(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)':
+  '@switchboard-xyz/common@2.5.18(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)':
     dependencies:
       '@solana/web3.js': 1.95.8(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
       axios: 1.7.9
@@ -46097,7 +46535,7 @@ snapshots:
       '@coral-xyz/anchor-30': '@coral-xyz/anchor@0.30.1(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)'
       '@solana/web3.js': 1.95.5(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
       '@solworks/soltoolkit-sdk': 0.0.23(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
-      '@switchboard-xyz/common': 2.5.17(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
+      '@switchboard-xyz/common': 2.5.18(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
       axios: 1.7.9
       big.js: 6.2.2
       bs58: 5.0.0
@@ -46117,15 +46555,8 @@ snapshots:
     dependencies:
       defer-to-connect: 2.0.1
 
-  '@tanstack/query-core@5.65.0': {}
-
   '@tanstack/query-core@5.66.0': {}
 
-  '@tanstack/react-query@5.65.1(react@19.0.0)':
-    dependencies:
-      '@tanstack/query-core': 5.65.0
-      react: 19.0.0
-
   '@tanstack/react-query@5.66.0(react@19.0.0)':
     dependencies:
       '@tanstack/query-core': 5.66.0
@@ -46295,7 +46726,7 @@ snapshots:
 
   '@triton-one/yellowstone-grpc@1.3.0':
     dependencies:
-      '@grpc/grpc-js': 1.12.5
+      '@grpc/grpc-js': 1.12.6
 
   '@trpc/client@10.40.0(@trpc/server@10.40.0)':
     dependencies:
@@ -46385,7 +46816,7 @@ snapshots:
 
   '@types/bs58@4.0.4':
     dependencies:
-      '@types/node': 22.13.0
+      '@types/node': 22.13.1
       base-x: 3.0.10
 
   '@types/cacheable-request@6.0.3':
@@ -46478,7 +46909,7 @@ snapshots:
     dependencies:
       '@types/d3-color': 3.1.3
 
-  '@types/d3-path@3.1.0': {}
+  '@types/d3-path@3.1.1': {}
 
   '@types/d3-polygon@3.0.2': {}
 
@@ -46488,7 +46919,7 @@ snapshots:
 
   '@types/d3-scale-chromatic@3.1.0': {}
 
-  '@types/d3-scale@4.0.8':
+  '@types/d3-scale@4.0.9':
     dependencies:
       '@types/d3-time': 3.0.4
 
@@ -46496,7 +46927,7 @@ snapshots:
 
   '@types/d3-shape@3.1.7':
     dependencies:
-      '@types/d3-path': 3.1.0
+      '@types/d3-path': 3.1.1
 
   '@types/d3-time-format@4.0.3': {}
 
@@ -46532,11 +46963,11 @@ snapshots:
       '@types/d3-geo': 3.1.0
       '@types/d3-hierarchy': 3.1.7
       '@types/d3-interpolate': 3.0.4
-      '@types/d3-path': 3.1.0
+      '@types/d3-path': 3.1.1
       '@types/d3-polygon': 3.0.2
       '@types/d3-quadtree': 3.0.6
       '@types/d3-random': 3.0.3
-      '@types/d3-scale': 4.0.8
+      '@types/d3-scale': 4.0.9
       '@types/d3-scale-chromatic': 3.1.0
       '@types/d3-selection': 3.0.11
       '@types/d3-shape': 3.1.7
@@ -46772,13 +47203,13 @@ snapshots:
 
   '@types/node@12.20.55': {}
 
-  '@types/node@16.18.125': {}
+  '@types/node@16.18.126': {}
 
   '@types/node@17.0.45': {}
 
   '@types/node@18.15.13': {}
 
-  '@types/node@18.19.74':
+  '@types/node@18.19.75':
     dependencies:
       undici-types: 5.26.5
 
@@ -46786,7 +47217,7 @@ snapshots:
     dependencies:
       undici-types: 6.19.8
 
-  '@types/node@22.13.0':
+  '@types/node@22.13.1':
     dependencies:
       undici-types: 6.20.0
 
@@ -46932,7 +47363,7 @@ snapshots:
 
   '@types/ssh2@1.15.4':
     dependencies:
-      '@types/node': 18.19.74
+      '@types/node': 18.19.75
 
   '@types/stack-utils@2.0.3': {}
 
@@ -46981,7 +47412,7 @@ snapshots:
 
   '@types/ws@8.5.14':
     dependencies:
-      '@types/node': 22.13.0
+      '@types/node': 22.13.1
 
   '@types/ws@8.5.3':
     dependencies:
@@ -47506,10 +47937,10 @@ snapshots:
       moment: 2.30.1
       starknet: 6.18.0(encoding@0.1.13)
 
-  '@vitejs/plugin-react-swc@3.7.2(@swc/helpers@0.5.15)(vite@6.0.11(@types/node@22.13.0)(jiti@2.4.2)(terser@5.37.0)(tsx@4.19.2)(yaml@2.7.0))':
+  '@vitejs/plugin-react-swc@3.7.2(@swc/helpers@0.5.15)(vite@6.1.0(@types/node@22.13.1)(jiti@2.4.2)(terser@5.38.0)(tsx@4.19.2)(yaml@2.7.0))':
     dependencies:
       '@swc/core': 1.10.14(@swc/helpers@0.5.15)
-      vite: 6.0.11(@types/node@22.13.0)(jiti@2.4.2)(terser@5.37.0)(tsx@4.19.2)(yaml@2.7.0)
+      vite: 6.1.0(@types/node@22.13.1)(jiti@2.4.2)(terser@5.38.0)(tsx@4.19.2)(yaml@2.7.0)
     transitivePeerDependencies:
       - '@swc/helpers'
 
@@ -47526,11 +47957,11 @@ snapshots:
       std-env: 3.8.0
       test-exclude: 6.0.0
       v8-to-istanbul: 9.3.0
-      vitest: 0.34.6(@vitest/ui@0.34.7)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(playwright@1.48.2)(terser@5.37.0)
+      vitest: 0.34.6(@vitest/ui@0.34.7)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(playwright@1.48.2)(terser@5.38.0)
     transitivePeerDependencies:
       - supports-color
 
-  '@vitest/coverage-v8@1.1.3(vitest@1.1.3(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))':
+  '@vitest/coverage-v8@1.1.3(vitest@1.1.3(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))':
     dependencies:
       '@ampproject/remapping': 2.3.0
       '@bcoe/v8-coverage': 0.2.3
@@ -47545,11 +47976,11 @@ snapshots:
       std-env: 3.8.0
       test-exclude: 6.0.0
       v8-to-istanbul: 9.3.0
-      vitest: 1.1.3(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+      vitest: 1.1.3(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
     transitivePeerDependencies:
       - supports-color
 
-  '@vitest/coverage-v8@1.6.1(vitest@1.6.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.37.0))':
+  '@vitest/coverage-v8@1.6.1(vitest@1.6.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.38.0))':
     dependencies:
       '@ampproject/remapping': 2.3.0
       '@bcoe/v8-coverage': 0.2.3
@@ -47564,11 +47995,11 @@ snapshots:
       std-env: 3.8.0
       strip-literal: 2.1.1
       test-exclude: 6.0.0
-      vitest: 1.6.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.37.0)
+      vitest: 1.6.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.38.0)
     transitivePeerDependencies:
       - supports-color
 
-  '@vitest/coverage-v8@1.6.1(vitest@1.6.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))':
+  '@vitest/coverage-v8@1.6.1(vitest@1.6.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))':
     dependencies:
       '@ampproject/remapping': 2.3.0
       '@bcoe/v8-coverage': 0.2.3
@@ -47583,7 +48014,7 @@ snapshots:
       std-env: 3.8.0
       strip-literal: 2.1.1
       test-exclude: 6.0.0
-      vitest: 1.6.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+      vitest: 1.6.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
     transitivePeerDependencies:
       - supports-color
 
@@ -47602,11 +48033,11 @@ snapshots:
       std-env: 3.8.0
       strip-literal: 2.1.1
       test-exclude: 6.0.0
-      vitest: 1.6.1(@types/node@20.17.9)(@vitest/ui@0.34.7)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+      vitest: 1.6.1(@types/node@20.17.9)(@vitest/ui@0.34.7)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
     transitivePeerDependencies:
       - supports-color
 
-  '@vitest/coverage-v8@2.1.5(vitest@3.0.2(@types/node@22.8.4)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.37.0))':
+  '@vitest/coverage-v8@2.1.5(vitest@3.0.2(@types/node@22.8.4)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.38.0))':
     dependencies:
       '@ampproject/remapping': 2.3.0
       '@bcoe/v8-coverage': 0.2.3
@@ -47620,11 +48051,11 @@ snapshots:
       std-env: 3.8.0
       test-exclude: 7.0.1
       tinyrainbow: 1.2.0
-      vitest: 3.0.2(@types/node@22.8.4)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.37.0)
+      vitest: 3.0.2(@types/node@22.8.4)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.38.0)
     transitivePeerDependencies:
       - supports-color
 
-  '@vitest/coverage-v8@2.1.9(vitest@2.1.8(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))':
+  '@vitest/coverage-v8@2.1.9(vitest@2.1.8(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))':
     dependencies:
       '@ampproject/remapping': 2.3.0
       '@bcoe/v8-coverage': 0.2.3
@@ -47638,11 +48069,11 @@ snapshots:
       std-env: 3.8.0
       test-exclude: 7.0.1
       tinyrainbow: 1.2.0
-      vitest: 2.1.8(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+      vitest: 2.1.8(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
     transitivePeerDependencies:
       - supports-color
 
-  '@vitest/coverage-v8@2.1.9(vitest@2.1.8(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.37.0))':
+  '@vitest/coverage-v8@2.1.9(vitest@2.1.8(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.38.0))':
     dependencies:
       '@ampproject/remapping': 2.3.0
       '@bcoe/v8-coverage': 0.2.3
@@ -47656,11 +48087,11 @@ snapshots:
       std-env: 3.8.0
       test-exclude: 7.0.1
       tinyrainbow: 1.2.0
-      vitest: 2.1.8(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.37.0)
+      vitest: 2.1.8(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.38.0)
     transitivePeerDependencies:
       - supports-color
 
-  '@vitest/coverage-v8@3.0.5(vitest@3.0.2(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))':
+  '@vitest/coverage-v8@3.0.5(vitest@3.0.2(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))':
     dependencies:
       '@ampproject/remapping': 2.3.0
       '@bcoe/v8-coverage': 1.0.2
@@ -47674,17 +48105,17 @@ snapshots:
       std-env: 3.8.0
       test-exclude: 7.0.1
       tinyrainbow: 2.0.0
-      vitest: 3.0.2(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+      vitest: 3.0.2(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
     transitivePeerDependencies:
       - supports-color
 
-  '@vitest/eslint-plugin@1.0.1(@typescript-eslint/utils@8.23.0(eslint@9.19.0(jiti@2.4.2))(typescript@5.6.3))(eslint@9.19.0(jiti@2.4.2))(typescript@5.6.3)(vitest@2.1.5(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))':
+  '@vitest/eslint-plugin@1.0.1(@typescript-eslint/utils@8.23.0(eslint@9.19.0(jiti@2.4.2))(typescript@5.6.3))(eslint@9.19.0(jiti@2.4.2))(typescript@5.6.3)(vitest@2.1.5(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))':
     dependencies:
       eslint: 9.19.0(jiti@2.4.2)
     optionalDependencies:
       '@typescript-eslint/utils': 8.23.0(eslint@9.19.0(jiti@2.4.2))(typescript@5.6.3)
       typescript: 5.6.3
-      vitest: 2.1.5(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+      vitest: 2.1.5(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   '@vitest/expect@0.34.6':
     dependencies:
@@ -47738,45 +48169,45 @@ snapshots:
       chai: 5.1.2
       tinyrainbow: 2.0.0
 
-  '@vitest/mocker@2.1.4(vite@5.4.12(@types/node@22.13.0)(terser@5.37.0))':
+  '@vitest/mocker@2.1.4(vite@5.4.12(@types/node@22.13.1)(terser@5.38.0))':
     dependencies:
       '@vitest/spy': 2.1.4
       estree-walker: 3.0.3
       magic-string: 0.30.17
     optionalDependencies:
-      vite: 5.4.12(@types/node@22.13.0)(terser@5.37.0)
+      vite: 5.4.12(@types/node@22.13.1)(terser@5.38.0)
 
-  '@vitest/mocker@2.1.5(vite@5.4.12(@types/node@22.13.0)(terser@5.37.0))':
+  '@vitest/mocker@2.1.5(vite@5.4.12(@types/node@22.13.1)(terser@5.38.0))':
     dependencies:
       '@vitest/spy': 2.1.5
       estree-walker: 3.0.3
       magic-string: 0.30.17
     optionalDependencies:
-      vite: 5.4.12(@types/node@22.13.0)(terser@5.37.0)
+      vite: 5.4.12(@types/node@22.13.1)(terser@5.38.0)
 
-  '@vitest/mocker@2.1.8(vite@5.4.12(@types/node@22.13.0)(terser@5.37.0))':
+  '@vitest/mocker@2.1.8(vite@5.4.12(@types/node@22.13.1)(terser@5.38.0))':
     dependencies:
       '@vitest/spy': 2.1.8
       estree-walker: 3.0.3
       magic-string: 0.30.17
     optionalDependencies:
-      vite: 5.4.12(@types/node@22.13.0)(terser@5.37.0)
+      vite: 5.4.12(@types/node@22.13.1)(terser@5.38.0)
 
-  '@vitest/mocker@3.0.2(vite@5.4.12(@types/node@20.17.9)(terser@5.37.0))':
+  '@vitest/mocker@3.0.2(vite@5.4.12(@types/node@20.17.9)(terser@5.38.0))':
     dependencies:
       '@vitest/spy': 3.0.2
       estree-walker: 3.0.3
       magic-string: 0.30.17
     optionalDependencies:
-      vite: 5.4.12(@types/node@20.17.9)(terser@5.37.0)
+      vite: 5.4.12(@types/node@20.17.9)(terser@5.38.0)
 
-  '@vitest/mocker@3.0.2(vite@5.4.12(@types/node@22.13.0)(terser@5.37.0))':
+  '@vitest/mocker@3.0.2(vite@5.4.12(@types/node@22.13.1)(terser@5.38.0))':
     dependencies:
       '@vitest/spy': 3.0.2
       estree-walker: 3.0.3
       magic-string: 0.30.17
     optionalDependencies:
-      vite: 5.4.12(@types/node@22.13.0)(terser@5.37.0)
+      vite: 5.4.12(@types/node@22.13.1)(terser@5.38.0)
 
   '@vitest/pretty-format@2.1.4':
     dependencies:
@@ -47935,7 +48366,7 @@ snapshots:
       pathe: 1.1.2
       picocolors: 1.1.1
       sirv: 2.0.4
-      vitest: 0.34.6(@vitest/ui@0.34.7)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(playwright@1.48.2)(terser@5.37.0)
+      vitest: 0.34.6(@vitest/ui@0.34.7)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(playwright@1.48.2)(terser@5.38.0)
 
   '@vitest/ui@0.34.7(vitest@1.6.1)':
     dependencies:
@@ -47946,7 +48377,7 @@ snapshots:
       pathe: 1.1.2
       picocolors: 1.1.1
       sirv: 2.0.4
-      vitest: 1.6.1(@types/node@20.17.9)(@vitest/ui@0.34.7)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+      vitest: 1.6.1(@types/node@20.17.9)(@vitest/ui@0.34.7)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
 
   '@vitest/utils@0.34.6':
     dependencies:
@@ -48007,7 +48438,7 @@ snapshots:
 
   '@vladfrangu/async_event_emitter@2.4.6': {}
 
-  '@voltr/vault-sdk@0.1.4(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.6.3)(utf-8-validate@5.0.10)':
+  '@voltr/vault-sdk@0.1.5(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.6.3)(utf-8-validate@5.0.10)':
     dependencies:
       '@coral-xyz/anchor': 0.28.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
       '@solana/spl-token': 0.4.9(@solana/web3.js@1.98.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.6.3)(utf-8-validate@5.0.10)
@@ -48019,7 +48450,7 @@ snapshots:
       - typescript
       - utf-8-validate
 
-  '@voltr/vault-sdk@0.1.4(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10)':
+  '@voltr/vault-sdk@0.1.5(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10)':
     dependencies:
       '@coral-xyz/anchor': 0.28.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
       '@solana/spl-token': 0.4.9(@solana/web3.js@1.98.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10)
@@ -48350,7 +48781,7 @@ snapshots:
     dependencies:
       '@walletconnect/jsonrpc-utils': 1.0.8
       '@walletconnect/safe-json': 1.0.2
-      cross-fetch: 3.2.0(encoding@0.1.13)
+      cross-fetch: 3.1.8(encoding@0.1.13)
       events: 3.3.0
     transitivePeerDependencies:
       - encoding
@@ -49392,19 +49823,19 @@ snapshots:
   ai-agent-sdk-js@0.0.2(bufferutil@4.0.9)(typescript@5.7.3)(utf-8-validate@5.0.10):
     dependencies:
       ethers: 6.13.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)
-      valibot: 1.0.0-beta.14(typescript@5.7.3)
+      valibot: 1.0.0-beta.15(typescript@5.7.3)
     transitivePeerDependencies:
       - bufferutil
       - typescript
       - utf-8-validate
 
-  ai@3.4.33(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))(react@19.0.0)(sswr@2.1.0(svelte@5.19.7))(svelte@5.19.7)(vue@3.5.13(typescript@5.7.3))(zod@3.23.8):
+  ai@3.4.33(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))(react@19.0.0)(sswr@2.1.0(svelte@5.19.8))(svelte@5.19.8)(vue@3.5.13(typescript@5.7.3))(zod@3.23.8):
     dependencies:
       '@ai-sdk/provider': 1.0.6
       '@ai-sdk/provider-utils': 2.1.6(zod@3.23.8)
       '@ai-sdk/react': 0.0.70(react@19.0.0)(zod@3.23.8)
       '@ai-sdk/solid': 0.0.54(zod@3.23.8)
-      '@ai-sdk/svelte': 0.0.57(svelte@5.19.7)(zod@3.23.8)
+      '@ai-sdk/svelte': 0.0.57(svelte@5.19.8)(zod@3.23.8)
       '@ai-sdk/ui-utils': 0.0.50(zod@3.23.8)
       '@ai-sdk/vue': 0.0.59(vue@3.5.13(typescript@5.7.3))(zod@3.23.8)
       '@opentelemetry/api': 1.9.0
@@ -49416,8 +49847,8 @@ snapshots:
     optionalDependencies:
       openai: 4.73.0(encoding@0.1.13)(zod@3.23.8)
       react: 19.0.0
-      sswr: 2.1.0(svelte@5.19.7)
-      svelte: 5.19.7
+      sswr: 2.1.0(svelte@5.19.8)
+      svelte: 5.19.8
       zod: 3.23.8
     transitivePeerDependencies:
       - solid-js
@@ -49482,26 +49913,26 @@ snapshots:
 
   algo-msgpack-with-bigint@2.1.1: {}
 
-  algoliasearch-helper@3.24.1(algoliasearch@5.20.0):
+  algoliasearch-helper@3.24.1(algoliasearch@5.20.1):
     dependencies:
       '@algolia/events': 4.0.1
-      algoliasearch: 5.20.0
-
-  algoliasearch@5.20.0:
-    dependencies:
-      '@algolia/client-abtesting': 5.20.0
-      '@algolia/client-analytics': 5.20.0
-      '@algolia/client-common': 5.20.0
-      '@algolia/client-insights': 5.20.0
-      '@algolia/client-personalization': 5.20.0
-      '@algolia/client-query-suggestions': 5.20.0
-      '@algolia/client-search': 5.20.0
-      '@algolia/ingestion': 1.20.0
-      '@algolia/monitoring': 1.20.0
-      '@algolia/recommend': 5.20.0
-      '@algolia/requester-browser-xhr': 5.20.0
-      '@algolia/requester-fetch': 5.20.0
-      '@algolia/requester-node-http': 5.20.0
+      algoliasearch: 5.20.1
+
+  algoliasearch@5.20.1:
+    dependencies:
+      '@algolia/client-abtesting': 5.20.1
+      '@algolia/client-analytics': 5.20.1
+      '@algolia/client-common': 5.20.1
+      '@algolia/client-insights': 5.20.1
+      '@algolia/client-personalization': 5.20.1
+      '@algolia/client-query-suggestions': 5.20.1
+      '@algolia/client-search': 5.20.1
+      '@algolia/ingestion': 1.20.1
+      '@algolia/monitoring': 1.20.1
+      '@algolia/recommend': 5.20.1
+      '@algolia/requester-browser-xhr': 5.20.1
+      '@algolia/requester-fetch': 5.20.1
+      '@algolia/requester-node-http': 5.20.1
 
   algosdk@1.24.1(encoding@0.1.13):
     dependencies:
@@ -49866,7 +50297,7 @@ snapshots:
 
   assertion-error@2.0.1: {}
 
-  assertion-tools@8.0.0-gamma.2(bufferutil@4.0.9)(utf-8-validate@5.0.10)(web-streams-polyfill@3.3.3):
+  assertion-tools@8.0.1(bufferutil@4.0.9)(utf-8-validate@5.0.10)(web-streams-polyfill@3.3.3):
     dependencies:
       ethers: 5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10)
       jsonld: 8.3.3(web-streams-polyfill@3.3.3)
@@ -49970,7 +50401,7 @@ snapshots:
   autoprefixer@10.4.20(postcss@8.5.1):
     dependencies:
       browserslist: 4.24.4
-      caniuse-lite: 1.0.30001696
+      caniuse-lite: 1.0.30001697
       fraction.js: 4.3.7
       normalize-range: 0.1.2
       picocolors: 1.1.1
@@ -50748,8 +51179,8 @@ snapshots:
 
   browserslist@4.24.4:
     dependencies:
-      caniuse-lite: 1.0.30001696
-      electron-to-chromium: 1.5.91
+      caniuse-lite: 1.0.30001697
+      electron-to-chromium: 1.5.93
       node-releases: 2.0.19
       update-browserslist-db: 1.1.2(browserslist@4.24.4)
 
@@ -50984,11 +51415,11 @@ snapshots:
   caniuse-api@3.0.0:
     dependencies:
       browserslist: 4.24.4
-      caniuse-lite: 1.0.30001696
+      caniuse-lite: 1.0.30001697
       lodash.memoize: 4.1.2
       lodash.uniq: 4.5.0
 
-  caniuse-lite@1.0.30001696: {}
+  caniuse-lite@1.0.30001697: {}
 
   canonicalize@1.0.8: {}
 
@@ -51042,9 +51473,9 @@ snapshots:
       loupe: 3.1.3
       pathval: 2.0.0
 
-  chain-registry@1.69.113:
+  chain-registry@1.69.116:
     dependencies:
-      '@chain-registry/types': 0.50.62
+      '@chain-registry/types': 0.50.65
 
   chalk@1.1.3:
     dependencies:
@@ -51703,9 +52134,9 @@ snapshots:
     dependencies:
       layout-base: 2.0.1
 
-  cosmiconfig-typescript-loader@5.1.0(@types/node@22.13.0)(cosmiconfig@8.3.6(typescript@5.6.3))(typescript@5.6.3):
+  cosmiconfig-typescript-loader@5.1.0(@types/node@22.13.1)(cosmiconfig@8.3.6(typescript@5.6.3))(typescript@5.6.3):
     dependencies:
-      '@types/node': 22.13.0
+      '@types/node': 22.13.1
       cosmiconfig: 8.3.6(typescript@5.6.3)
       jiti: 1.21.7
       typescript: 5.6.3
@@ -51808,13 +52239,13 @@ snapshots:
       safe-buffer: 5.2.1
       sha.js: 2.4.11
 
-  create-jest@29.7.0(@types/node@18.19.74)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.74)(typescript@5.7.3)):
+  create-jest@29.7.0(@types/node@18.19.75)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.75)(typescript@5.7.3)):
     dependencies:
       '@jest/types': 29.6.3
       chalk: 4.1.2
       exit: 0.1.2
       graceful-fs: 4.2.11
-      jest-config: 29.7.0(@types/node@18.19.74)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.74)(typescript@5.7.3))
+      jest-config: 29.7.0(@types/node@18.19.75)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.75)(typescript@5.7.3))
       jest-util: 29.7.0
       prompts: 2.4.2
     transitivePeerDependencies:
@@ -51838,13 +52269,13 @@ snapshots:
       - supports-color
       - ts-node
 
-  create-jest@29.7.0(@types/node@22.13.0)(babel-plugin-macros@3.1.0):
+  create-jest@29.7.0(@types/node@22.13.1)(babel-plugin-macros@3.1.0):
     dependencies:
       '@jest/types': 29.6.3
       chalk: 4.1.2
       exit: 0.1.2
       graceful-fs: 4.2.11
-      jest-config: 29.7.0(@types/node@22.13.0)(babel-plugin-macros@3.1.0)
+      jest-config: 29.7.0(@types/node@22.13.1)(babel-plugin-macros@3.1.0)
       jest-util: 29.7.0
       prompts: 2.4.2
     transitivePeerDependencies:
@@ -52714,7 +53145,7 @@ snapshots:
       - bufferutil
       - utf-8-validate
 
-  dkg-evm-module@8.0.2(@nomicfoundation/hardhat-ethers@3.0.8(ethers@5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10))(hardhat@2.22.18(bufferutil@4.0.9)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.7.3))(typescript@5.7.3)(utf-8-validate@5.0.10)))(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(bufferutil@4.0.9)(utf-8-validate@5.0.10):
+  dkg-evm-module@8.0.2(@nomicfoundation/hardhat-ethers@3.0.8(ethers@5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10))(hardhat@2.22.18(bufferutil@4.0.9)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.7.3))(typescript@5.7.3)(utf-8-validate@5.0.10)))(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(bufferutil@4.0.9)(utf-8-validate@5.0.10):
     dependencies:
       '@openzeppelin/contracts': 5.2.0
       '@polkadot/api': 15.5.2(bufferutil@4.0.9)(utf-8-validate@5.0.10)
@@ -52723,11 +53154,11 @@ snapshots:
       '@polkadot/util-crypto': 12.6.2(@polkadot/util@12.6.2)
       '@prb/math': 4.1.0
       dotenv: 16.4.7
-      hardhat: 2.22.18(bufferutil@4.0.9)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.7.3))(typescript@4.9.5)(utf-8-validate@5.0.10)
+      hardhat: 2.22.18(bufferutil@4.0.9)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.7.3))(typescript@4.9.5)(utf-8-validate@5.0.10)
       hardhat-deploy: 0.12.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
-      hardhat-deploy-ethers: 0.4.2(@nomicfoundation/hardhat-ethers@3.0.8(ethers@5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10))(hardhat@2.22.18(bufferutil@4.0.9)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.7.3))(typescript@5.7.3)(utf-8-validate@5.0.10)))(hardhat-deploy@0.12.4(bufferutil@4.0.9)(utf-8-validate@5.0.10))(hardhat@2.22.18(bufferutil@4.0.9)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.7.3))(typescript@5.7.3)(utf-8-validate@5.0.10))
+      hardhat-deploy-ethers: 0.4.2(@nomicfoundation/hardhat-ethers@3.0.8(ethers@5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10))(hardhat@2.22.18(bufferutil@4.0.9)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.7.3))(typescript@5.7.3)(utf-8-validate@5.0.10)))(hardhat-deploy@0.12.4(bufferutil@4.0.9)(utf-8-validate@5.0.10))(hardhat@2.22.18(bufferutil@4.0.9)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.7.3))(typescript@5.7.3)(utf-8-validate@5.0.10))
       solady: 0.0.285
-      ts-node: 10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@4.9.5)
+      ts-node: 10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@4.9.5)
       typescript: 5.7.3
     transitivePeerDependencies:
       - '@nomicfoundation/hardhat-ethers'
@@ -52739,11 +53170,11 @@ snapshots:
       - supports-color
       - utf-8-validate
 
-  dkg.js@8.0.4(@nomicfoundation/hardhat-ethers@3.0.8(ethers@5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10))(hardhat@2.22.18(bufferutil@4.0.9)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.7.3))(typescript@5.7.3)(utf-8-validate@5.0.10)))(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)(web-streams-polyfill@3.3.3):
+  dkg.js@8.0.4(@nomicfoundation/hardhat-ethers@3.0.8(ethers@5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10))(hardhat@2.22.18(bufferutil@4.0.9)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.7.3))(typescript@5.7.3)(utf-8-validate@5.0.10)))(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)(web-streams-polyfill@3.3.3):
     dependencies:
-      assertion-tools: 8.0.0-gamma.2(bufferutil@4.0.9)(utf-8-validate@5.0.10)(web-streams-polyfill@3.3.3)
+      assertion-tools: 8.0.1(bufferutil@4.0.9)(utf-8-validate@5.0.10)(web-streams-polyfill@3.3.3)
       axios: 0.27.2(debug@4.3.4)
-      dkg-evm-module: 8.0.2(@nomicfoundation/hardhat-ethers@3.0.8(ethers@5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10))(hardhat@2.22.18(bufferutil@4.0.9)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.7.3))(typescript@5.7.3)(utf-8-validate@5.0.10)))(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(bufferutil@4.0.9)(utf-8-validate@5.0.10)
+      dkg-evm-module: 8.0.2(@nomicfoundation/hardhat-ethers@3.0.8(ethers@5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10))(hardhat@2.22.18(bufferutil@4.0.9)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.7.3))(typescript@5.7.3)(utf-8-validate@5.0.10)))(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(bufferutil@4.0.9)(utf-8-validate@5.0.10)
       ethers: 6.13.5(bufferutil@4.0.9)(utf-8-validate@5.0.10)
       jsonld: 8.3.3(web-streams-polyfill@3.3.3)
       web3: 1.10.4(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
@@ -52956,7 +53387,7 @@ snapshots:
       sam-js: 0.3.1
       strip-ansi: 7.1.0
       tar: 7.4.3
-      tiktoken: 1.0.19
+      tiktoken: 1.0.20
       tinyld: 1.3.4
       wasm-feature-detect: 1.8.0
       ws: 8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10)
@@ -52998,7 +53429,7 @@ snapshots:
       '@aave/contract-helpers': 1.31.1(bignumber.js@9.1.2)(encoding@0.1.13)(ethers@5.7.2(bufferutil@4.0.9)(utf-8-validate@6.0.5))(reflect-metadata@0.2.2)(tslib@2.8.1)
       '@bgd-labs/aave-address-book': 4.9.0
       '@coral-xyz/anchor': 0.28.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@6.0.5)
-      '@meteora-ag/dlmm': 1.3.10(bufferutil@4.0.9)(encoding@0.1.13)(typescript@5.7.3)(utf-8-validate@6.0.5)
+      '@meteora-ag/dlmm': 1.3.11(bufferutil@4.0.9)(encoding@0.1.13)(typescript@5.7.3)(utf-8-validate@6.0.5)
       '@solana/web3.js': 1.98.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@6.0.5)
       bn.js: 5.2.1
       bs58: 5.0.0
@@ -53024,7 +53455,7 @@ snapshots:
     dependencies:
       jake: 10.9.2
 
-  electron-to-chromium@1.5.91: {}
+  electron-to-chromium@1.5.93: {}
 
   elliptic@6.5.4:
     dependencies:
@@ -53092,7 +53523,7 @@ snapshots:
 
   engine.io-parser@5.2.3: {}
 
-  enhanced-resolve@5.18.0:
+  enhanced-resolve@5.18.1:
     dependencies:
       graceful-fs: 4.2.11
       tapable: 2.2.1
@@ -53165,9 +53596,9 @@ snapshots:
       is-shared-array-buffer: 1.0.4
       is-string: 1.1.1
       is-typed-array: 1.1.15
-      is-weakref: 1.1.0
+      is-weakref: 1.1.1
       math-intrinsics: 1.1.0
-      object-inspect: 1.13.3
+      object-inspect: 1.13.4
       object-keys: 1.1.1
       object.assign: 4.1.7
       own-keys: 1.0.1
@@ -53455,7 +53886,7 @@ snapshots:
     dependencies:
       '@nolyfill/is-core-module': 1.0.39
       debug: 4.4.0(supports-color@8.1.1)
-      enhanced-resolve: 5.18.0
+      enhanced-resolve: 5.18.1
       eslint: 9.19.0(jiti@2.4.2)
       fast-glob: 3.3.3
       get-tsconfig: 4.10.0
@@ -53581,12 +54012,12 @@ snapshots:
       string.prototype.matchall: 4.0.12
       string.prototype.repeat: 1.0.0
 
-  eslint-plugin-vitest@0.5.4(eslint@9.13.0(jiti@2.4.2))(typescript@5.7.3)(vitest@3.0.2(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)):
+  eslint-plugin-vitest@0.5.4(eslint@9.13.0(jiti@2.4.2))(typescript@5.7.3)(vitest@3.0.2(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)):
     dependencies:
       '@typescript-eslint/utils': 7.18.0(eslint@9.13.0(jiti@2.4.2))(typescript@5.7.3)
       eslint: 9.13.0(jiti@2.4.2)
     optionalDependencies:
-      vitest: 3.0.2(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)
+      vitest: 3.0.2(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)
     transitivePeerDependencies:
       - supports-color
       - typescript
@@ -54316,7 +54747,7 @@ snapshots:
 
   extract-zip@2.0.1:
     dependencies:
-      debug: 4.4.0(supports-color@8.1.1)
+      debug: 4.3.4
       get-stream: 5.2.0
       yauzl: 2.10.0
     optionalDependencies:
@@ -54534,7 +54965,7 @@ snapshots:
     dependencies:
       traverse-chain: 0.1.0
 
-  flash-sdk@2.27.1(@swc/core@1.10.14(@swc/helpers@0.5.15))(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.6.3)(utf-8-validate@5.0.10):
+  flash-sdk@2.28.10(@swc/core@1.10.14(@swc/helpers@0.5.15))(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.6.3)(utf-8-validate@5.0.10):
     dependencies:
       '@coral-xyz/anchor': 0.28.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
       '@pythnetwork/client': 2.22.0(@solana/web3.js@1.95.8(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
@@ -54562,7 +54993,7 @@ snapshots:
       - typescript
       - utf-8-validate
 
-  flash-sdk@2.27.1(@swc/core@1.10.14(@swc/helpers@0.5.15))(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10):
+  flash-sdk@2.28.10(@swc/core@1.10.14(@swc/helpers@0.5.15))(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10):
     dependencies:
       '@coral-xyz/anchor': 0.28.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
       '@pythnetwork/client': 2.22.0(@solana/web3.js@1.95.8(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
@@ -54826,24 +55257,24 @@ snapshots:
   fsevents@2.3.3:
     optional: true
 
-  fuels@0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0)):
+  fuels@0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0)):
     dependencies:
-      '@fuel-ts/abi-coder': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/abi-typegen': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/account': 0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/address': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/contract': 0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/crypto': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+      '@fuel-ts/abi-coder': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/abi-typegen': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/account': 0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/address': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/contract': 0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/crypto': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       '@fuel-ts/errors': 0.97.2
-      '@fuel-ts/hasher': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+      '@fuel-ts/hasher': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       '@fuel-ts/interfaces': 0.97.2
       '@fuel-ts/math': 0.97.2
-      '@fuel-ts/merkle': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/program': 0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/recipes': 0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/script': 0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/transactions': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
-      '@fuel-ts/utils': 0.97.2(vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0))
+      '@fuel-ts/merkle': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/program': 0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/recipes': 0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/script': 0.97.2(encoding@0.1.13)(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/transactions': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
+      '@fuel-ts/utils': 0.97.2(vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0))
       '@fuel-ts/versions': 0.97.2
       bundle-require: 5.1.0(esbuild@0.24.2)
       chalk: 4.1.2
@@ -55329,7 +55760,7 @@ snapshots:
 
   groq-sdk@0.5.0(encoding@0.1.13):
     dependencies:
-      '@types/node': 18.19.74
+      '@types/node': 18.19.75
       '@types/node-fetch': 2.6.12
       abort-controller: 3.0.0
       agentkeepalive: 4.6.0
@@ -55389,10 +55820,10 @@ snapshots:
 
   hard-rejection@2.1.0: {}
 
-  hardhat-deploy-ethers@0.4.2(@nomicfoundation/hardhat-ethers@3.0.8(ethers@5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10))(hardhat@2.22.18(bufferutil@4.0.9)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.7.3))(typescript@5.7.3)(utf-8-validate@5.0.10)))(hardhat-deploy@0.12.4(bufferutil@4.0.9)(utf-8-validate@5.0.10))(hardhat@2.22.18(bufferutil@4.0.9)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.7.3))(typescript@5.7.3)(utf-8-validate@5.0.10)):
+  hardhat-deploy-ethers@0.4.2(@nomicfoundation/hardhat-ethers@3.0.8(ethers@5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10))(hardhat@2.22.18(bufferutil@4.0.9)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.7.3))(typescript@5.7.3)(utf-8-validate@5.0.10)))(hardhat-deploy@0.12.4(bufferutil@4.0.9)(utf-8-validate@5.0.10))(hardhat@2.22.18(bufferutil@4.0.9)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.7.3))(typescript@5.7.3)(utf-8-validate@5.0.10)):
     dependencies:
-      '@nomicfoundation/hardhat-ethers': 3.0.8(ethers@5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10))(hardhat@2.22.18(bufferutil@4.0.9)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.7.3))(typescript@5.7.3)(utf-8-validate@5.0.10))
-      hardhat: 2.22.18(bufferutil@4.0.9)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.7.3))(typescript@4.9.5)(utf-8-validate@5.0.10)
+      '@nomicfoundation/hardhat-ethers': 3.0.8(ethers@5.7.2(bufferutil@4.0.9)(utf-8-validate@5.0.10))(hardhat@2.22.18(bufferutil@4.0.9)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.7.3))(typescript@5.7.3)(utf-8-validate@5.0.10))
+      hardhat: 2.22.18(bufferutil@4.0.9)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.7.3))(typescript@4.9.5)(utf-8-validate@5.0.10)
       hardhat-deploy: 0.12.4(bufferutil@4.0.9)(utf-8-validate@5.0.10)
 
   hardhat-deploy@0.12.4(bufferutil@4.0.9)(utf-8-validate@5.0.10):
@@ -55426,7 +55857,7 @@ snapshots:
       - supports-color
       - utf-8-validate
 
-  hardhat@2.22.18(bufferutil@4.0.9)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.7.3))(typescript@4.9.5)(utf-8-validate@5.0.10):
+  hardhat@2.22.18(bufferutil@4.0.9)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.7.3))(typescript@4.9.5)(utf-8-validate@5.0.10):
     dependencies:
       '@ethersproject/abi': 5.7.0
       '@metamask/eth-sig-util': 4.0.1
@@ -55473,7 +55904,7 @@ snapshots:
       uuid: 8.3.2
       ws: 7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10)
     optionalDependencies:
-      ts-node: 10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@4.9.5)
+      ts-node: 10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@4.9.5)
       typescript: 4.9.5
     transitivePeerDependencies:
       - bufferutil
@@ -55773,7 +56204,7 @@ snapshots:
       he: 1.2.0
       param-case: 3.0.4
       relateurl: 0.2.7
-      terser: 5.37.0
+      terser: 5.38.0
 
   html-minifier-terser@7.2.0:
     dependencies:
@@ -55783,7 +56214,7 @@ snapshots:
       entities: 4.5.0
       param-case: 3.0.4
       relateurl: 0.2.7
-      terser: 5.37.0
+      terser: 5.38.0
 
   html-tags@3.3.1: {}
 
@@ -56305,7 +56736,7 @@ snapshots:
     dependencies:
       binary-extensions: 2.3.0
 
-  is-boolean-object@1.2.1:
+  is-boolean-object@1.2.2:
     dependencies:
       call-bound: 1.0.3
       has-tostringtag: 1.0.2
@@ -56546,7 +56977,7 @@ snapshots:
 
   is-weakmap@2.0.2: {}
 
-  is-weakref@1.1.0:
+  is-weakref@1.1.1:
     dependencies:
       call-bound: 1.0.3
 
@@ -56800,16 +57231,16 @@ snapshots:
       - babel-plugin-macros
       - supports-color
 
-  jest-cli@27.5.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@16.18.125)(typescript@5.7.3))(utf-8-validate@5.0.10):
+  jest-cli@27.5.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@16.18.126)(typescript@5.7.3))(utf-8-validate@5.0.10):
     dependencies:
-      '@jest/core': 27.5.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@16.18.125)(typescript@5.7.3))(utf-8-validate@5.0.10)
+      '@jest/core': 27.5.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@16.18.126)(typescript@5.7.3))(utf-8-validate@5.0.10)
       '@jest/test-result': 27.5.1
       '@jest/types': 27.5.1
       chalk: 4.1.2
       exit: 0.1.2
       graceful-fs: 4.2.11
       import-local: 3.2.0
-      jest-config: 27.5.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@16.18.125)(typescript@5.7.3))(utf-8-validate@5.0.10)
+      jest-config: 27.5.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@16.18.126)(typescript@5.7.3))(utf-8-validate@5.0.10)
       jest-util: 27.5.1
       jest-validate: 27.5.1
       prompts: 2.4.2
@@ -56821,16 +57252,16 @@ snapshots:
       - ts-node
       - utf-8-validate
 
-  jest-cli@29.7.0(@types/node@18.19.74)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.74)(typescript@5.7.3)):
+  jest-cli@29.7.0(@types/node@18.19.75)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.75)(typescript@5.7.3)):
     dependencies:
-      '@jest/core': 29.7.0(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.74)(typescript@5.7.3))
+      '@jest/core': 29.7.0(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.75)(typescript@5.7.3))
       '@jest/test-result': 29.7.0
       '@jest/types': 29.6.3
       chalk: 4.1.2
-      create-jest: 29.7.0(@types/node@18.19.74)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.74)(typescript@5.7.3))
+      create-jest: 29.7.0(@types/node@18.19.75)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.75)(typescript@5.7.3))
       exit: 0.1.2
       import-local: 3.2.0
-      jest-config: 29.7.0(@types/node@18.19.74)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.74)(typescript@5.7.3))
+      jest-config: 29.7.0(@types/node@18.19.75)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.75)(typescript@5.7.3))
       jest-util: 29.7.0
       jest-validate: 29.7.0
       yargs: 17.7.2
@@ -56859,16 +57290,16 @@ snapshots:
       - supports-color
       - ts-node
 
-  jest-cli@29.7.0(@types/node@22.13.0)(babel-plugin-macros@3.1.0):
+  jest-cli@29.7.0(@types/node@22.13.1)(babel-plugin-macros@3.1.0):
     dependencies:
       '@jest/core': 29.7.0(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@20.17.9)(typescript@5.7.3))
       '@jest/test-result': 29.7.0
       '@jest/types': 29.6.3
       chalk: 4.1.2
-      create-jest: 29.7.0(@types/node@22.13.0)(babel-plugin-macros@3.1.0)
+      create-jest: 29.7.0(@types/node@22.13.1)(babel-plugin-macros@3.1.0)
       exit: 0.1.2
       import-local: 3.2.0
-      jest-config: 29.7.0(@types/node@22.13.0)(babel-plugin-macros@3.1.0)
+      jest-config: 29.7.0(@types/node@22.13.1)(babel-plugin-macros@3.1.0)
       jest-util: 29.7.0
       jest-validate: 29.7.0
       yargs: 17.7.2
@@ -56897,7 +57328,7 @@ snapshots:
       - supports-color
       - ts-node
 
-  jest-config@27.5.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@16.18.125)(typescript@5.7.3))(utf-8-validate@5.0.10):
+  jest-config@27.5.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@16.18.126)(typescript@5.7.3))(utf-8-validate@5.0.10):
     dependencies:
       '@babel/core': 7.26.7
       '@jest/test-sequencer': 27.5.1
@@ -56924,14 +57355,14 @@ snapshots:
       slash: 3.0.0
       strip-json-comments: 3.1.1
     optionalDependencies:
-      ts-node: 10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@16.18.125)(typescript@5.7.3)
+      ts-node: 10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@16.18.126)(typescript@5.7.3)
     transitivePeerDependencies:
       - bufferutil
       - canvas
       - supports-color
       - utf-8-validate
 
-  jest-config@29.7.0(@types/node@18.19.74)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.74)(typescript@5.7.3)):
+  jest-config@29.7.0(@types/node@18.19.75)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.75)(typescript@5.7.3)):
     dependencies:
       '@babel/core': 7.26.7
       '@jest/test-sequencer': 29.7.0
@@ -56956,13 +57387,13 @@ snapshots:
       slash: 3.0.0
       strip-json-comments: 3.1.1
     optionalDependencies:
-      '@types/node': 18.19.74
-      ts-node: 10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.74)(typescript@5.7.3)
+      '@types/node': 18.19.75
+      ts-node: 10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.75)(typescript@5.7.3)
     transitivePeerDependencies:
       - babel-plugin-macros
       - supports-color
 
-  jest-config@29.7.0(@types/node@20.17.9)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.74)(typescript@5.7.3)):
+  jest-config@29.7.0(@types/node@20.17.9)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.75)(typescript@5.7.3)):
     dependencies:
       '@babel/core': 7.26.7
       '@jest/test-sequencer': 29.7.0
@@ -56988,7 +57419,7 @@ snapshots:
       strip-json-comments: 3.1.1
     optionalDependencies:
       '@types/node': 20.17.9
-      ts-node: 10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.74)(typescript@5.7.3)
+      ts-node: 10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.75)(typescript@5.7.3)
     transitivePeerDependencies:
       - babel-plugin-macros
       - supports-color
@@ -57055,7 +57486,7 @@ snapshots:
       - babel-plugin-macros
       - supports-color
 
-  jest-config@29.7.0(@types/node@22.13.0)(babel-plugin-macros@3.1.0):
+  jest-config@29.7.0(@types/node@22.13.1)(babel-plugin-macros@3.1.0):
     dependencies:
       '@babel/core': 7.26.7
       '@jest/test-sequencer': 29.7.0
@@ -57080,7 +57511,7 @@ snapshots:
       slash: 3.0.0
       strip-json-comments: 3.1.1
     optionalDependencies:
-      '@types/node': 22.13.0
+      '@types/node': 22.13.1
     transitivePeerDependencies:
       - babel-plugin-macros
       - supports-color
@@ -57593,11 +58024,11 @@ snapshots:
       merge-stream: 2.0.0
       supports-color: 8.1.1
 
-  jest@27.5.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@16.18.125)(typescript@5.7.3))(utf-8-validate@5.0.10):
+  jest@27.5.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@16.18.126)(typescript@5.7.3))(utf-8-validate@5.0.10):
     dependencies:
-      '@jest/core': 27.5.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@16.18.125)(typescript@5.7.3))(utf-8-validate@5.0.10)
+      '@jest/core': 27.5.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@16.18.126)(typescript@5.7.3))(utf-8-validate@5.0.10)
       import-local: 3.2.0
-      jest-cli: 27.5.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@16.18.125)(typescript@5.7.3))(utf-8-validate@5.0.10)
+      jest-cli: 27.5.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@16.18.126)(typescript@5.7.3))(utf-8-validate@5.0.10)
     transitivePeerDependencies:
       - bufferutil
       - canvas
@@ -57605,12 +58036,12 @@ snapshots:
       - ts-node
       - utf-8-validate
 
-  jest@29.7.0(@types/node@18.19.74)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.74)(typescript@5.7.3)):
+  jest@29.7.0(@types/node@18.19.75)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.75)(typescript@5.7.3)):
     dependencies:
-      '@jest/core': 29.7.0(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.74)(typescript@5.7.3))
+      '@jest/core': 29.7.0(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.75)(typescript@5.7.3))
       '@jest/types': 29.6.3
       import-local: 3.2.0
-      jest-cli: 29.7.0(@types/node@18.19.74)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.74)(typescript@5.7.3))
+      jest-cli: 29.7.0(@types/node@18.19.75)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.75)(typescript@5.7.3))
     transitivePeerDependencies:
       - '@types/node'
       - babel-plugin-macros
@@ -57641,12 +58072,12 @@ snapshots:
       - supports-color
       - ts-node
 
-  jest@29.7.0(@types/node@22.13.0)(babel-plugin-macros@3.1.0):
+  jest@29.7.0(@types/node@22.13.1)(babel-plugin-macros@3.1.0):
     dependencies:
       '@jest/core': 29.7.0(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@20.17.9)(typescript@5.7.3))
       '@jest/types': 29.6.3
       import-local: 3.2.0
-      jest-cli: 29.7.0(@types/node@22.13.0)(babel-plugin-macros@3.1.0)
+      jest-cli: 29.7.0(@types/node@22.13.1)(babel-plugin-macros@3.1.0)
     transitivePeerDependencies:
       - '@types/node'
       - babel-plugin-macros
@@ -57675,7 +58106,7 @@ snapshots:
 
   jito-ts@3.0.1(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10):
     dependencies:
-      '@grpc/grpc-js': 1.12.5
+      '@grpc/grpc-js': 1.12.6
       '@noble/ed25519': 1.7.3
       '@solana/web3.js': 1.77.4(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
       agentkeepalive: 4.6.0
@@ -58092,15 +58523,15 @@ snapshots:
       inherits: 2.0.4
       stream-splicer: 2.0.1
 
-  langchain@0.3.15(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(@langchain/groq@0.1.3(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10)))(axios@1.7.9)(encoding@0.1.13)(handlebars@4.7.8)(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1))(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10)):
+  langchain@0.3.15(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(@langchain/groq@0.1.3(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10)))(axios@1.7.9)(encoding@0.1.13)(handlebars@4.7.8)(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1))(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10)):
     dependencies:
-      '@langchain/core': 0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1))
-      '@langchain/openai': 0.3.17(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
-      '@langchain/textsplitters': 0.1.0(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))
+      '@langchain/core': 0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1))
+      '@langchain/openai': 0.3.17(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
+      '@langchain/textsplitters': 0.1.0(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))
       js-tiktoken: 1.0.15
       js-yaml: 4.1.0
       jsonpointer: 5.0.1
-      langsmith: 0.3.4(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1))
+      langsmith: 0.3.6(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1))
       openapi-types: 12.1.3
       p-retry: 4.6.2
       uuid: 10.0.0
@@ -58108,7 +58539,7 @@ snapshots:
       zod: 3.23.8
       zod-to-json-schema: 3.24.1(zod@3.23.8)
     optionalDependencies:
-      '@langchain/groq': 0.1.3(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
+      '@langchain/groq': 0.1.3(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
       axios: 1.7.9
       handlebars: 4.7.8
     transitivePeerDependencies:
@@ -58116,11 +58547,11 @@ snapshots:
       - openai
       - ws
 
-  langchain@0.3.6(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(@langchain/groq@0.1.3(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10)))(axios@1.7.9)(encoding@0.1.13)(handlebars@4.7.8)(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10)):
+  langchain@0.3.6(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(@langchain/groq@0.1.3(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10)))(axios@1.7.9)(encoding@0.1.13)(handlebars@4.7.8)(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10)):
     dependencies:
-      '@langchain/core': 0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))
-      '@langchain/openai': 0.3.17(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
-      '@langchain/textsplitters': 0.1.0(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))
+      '@langchain/core': 0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))
+      '@langchain/openai': 0.3.17(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
+      '@langchain/textsplitters': 0.1.0(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))
       js-tiktoken: 1.0.15
       js-yaml: 4.1.0
       jsonpointer: 5.0.1
@@ -58132,7 +58563,7 @@ snapshots:
       zod: 3.23.8
       zod-to-json-schema: 3.24.1(zod@3.23.8)
     optionalDependencies:
-      '@langchain/groq': 0.1.3(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
+      '@langchain/groq': 0.1.3(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
       axios: 1.7.9
       handlebars: 4.7.8
     transitivePeerDependencies:
@@ -58140,11 +58571,11 @@ snapshots:
       - openai
       - ws
 
-  langchain@0.3.6(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(@langchain/groq@0.1.3(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5)))(axios@1.7.9)(encoding@0.1.13)(handlebars@4.7.8)(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5)):
+  langchain@0.3.6(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(@langchain/groq@0.1.3(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5)))(axios@1.7.9)(encoding@0.1.13)(handlebars@4.7.8)(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5)):
     dependencies:
-      '@langchain/core': 0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))
-      '@langchain/openai': 0.3.17(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))
-      '@langchain/textsplitters': 0.1.0(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))
+      '@langchain/core': 0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))
+      '@langchain/openai': 0.3.17(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))
+      '@langchain/textsplitters': 0.1.0(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))
       js-tiktoken: 1.0.15
       js-yaml: 4.1.0
       jsonpointer: 5.0.1
@@ -58156,7 +58587,7 @@ snapshots:
       zod: 3.23.8
       zod-to-json-schema: 3.24.1(zod@3.23.8)
     optionalDependencies:
-      '@langchain/groq': 0.1.3(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))
+      '@langchain/groq': 0.1.3(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))
       axios: 1.7.9
       handlebars: 4.7.8
     transitivePeerDependencies:
@@ -58164,11 +58595,11 @@ snapshots:
       - openai
       - ws
 
-  langchain@0.3.6(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)))(@langchain/groq@0.1.3(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)))(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10)))(axios@1.7.9)(encoding@0.1.13)(handlebars@4.7.8)(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8))(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10)):
+  langchain@0.3.6(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)))(@langchain/groq@0.1.3(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)))(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10)))(axios@1.7.9)(encoding@0.1.13)(handlebars@4.7.8)(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8))(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10)):
     dependencies:
-      '@langchain/core': 0.3.37(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8))
-      '@langchain/openai': 0.3.17(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)))(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))
-      '@langchain/textsplitters': 0.1.0(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)))
+      '@langchain/core': 0.3.38(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8))
+      '@langchain/openai': 0.3.17(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)))(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))
+      '@langchain/textsplitters': 0.1.0(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)))
       js-tiktoken: 1.0.15
       js-yaml: 4.1.0
       jsonpointer: 5.0.1
@@ -58180,7 +58611,7 @@ snapshots:
       zod: 3.23.8
       zod-to-json-schema: 3.24.1(zod@3.23.8)
     optionalDependencies:
-      '@langchain/groq': 0.1.3(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)))(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))
+      '@langchain/groq': 0.1.3(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)))(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))
       axios: 1.7.9
       handlebars: 4.7.8
     transitivePeerDependencies:
@@ -58190,8 +58621,8 @@ snapshots:
 
   langchain@0.3.6(axios@1.7.9)(encoding@0.1.13)(handlebars@4.7.8)(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10)):
     dependencies:
-      '@langchain/openai': 0.3.17(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
-      '@langchain/textsplitters': 0.1.0(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))
+      '@langchain/openai': 0.3.17(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
+      '@langchain/textsplitters': 0.1.0(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))
       js-tiktoken: 1.0.15
       js-yaml: 4.1.0
       jsonpointer: 5.0.1
@@ -58212,8 +58643,8 @@ snapshots:
 
   langchain@0.3.6(axios@1.7.9)(encoding@0.1.13)(handlebars@4.7.8)(openai@4.73.0(encoding@0.1.13)(zod@3.23.8))(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5)):
     dependencies:
-      '@langchain/openai': 0.3.17(@langchain/core@0.3.37(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))
-      '@langchain/textsplitters': 0.1.0(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))
+      '@langchain/openai': 0.3.17(@langchain/core@0.3.38(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))
+      '@langchain/textsplitters': 0.1.0(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))
       js-tiktoken: 1.0.15
       js-yaml: 4.1.0
       jsonpointer: 5.0.1
@@ -58266,7 +58697,7 @@ snapshots:
     optionalDependencies:
       openai: 4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)
 
-  langsmith@0.3.4(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)):
+  langsmith@0.3.6(openai@4.73.0(encoding@0.1.13)(zod@3.23.8)):
     dependencies:
       '@types/uuid': 10.0.0
       chalk: 4.1.2
@@ -58278,7 +58709,7 @@ snapshots:
     optionalDependencies:
       openai: 4.73.0(encoding@0.1.13)(zod@3.23.8)
 
-  langsmith@0.3.4(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)):
+  langsmith@0.3.6(openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)):
     dependencies:
       '@types/uuid': 10.0.0
       chalk: 4.1.2
@@ -58290,7 +58721,7 @@ snapshots:
     optionalDependencies:
       openai: 4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8)
 
-  langsmith@0.3.4(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)):
+  langsmith@0.3.6(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)):
     dependencies:
       '@types/uuid': 10.0.0
       chalk: 4.1.2
@@ -58302,7 +58733,7 @@ snapshots:
     optionalDependencies:
       openai: 4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)
 
-  langsmith@0.3.4(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))(zod@3.23.8)):
+  langsmith@0.3.6(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))(zod@3.23.8)):
     dependencies:
       '@types/uuid': 10.0.0
       chalk: 4.1.2
@@ -58587,6 +59018,11 @@ snapshots:
       mlly: 1.7.4
       pkg-types: 1.3.1
 
+  local-pkg@1.0.0:
+    dependencies:
+      mlly: 1.7.4
+      pkg-types: 1.3.1
+
   locate-character@3.0.0: {}
 
   locate-path@2.0.0:
@@ -59158,7 +59594,7 @@ snapshots:
   mermaid@11.4.1:
     dependencies:
       '@braintree/sanitize-url': 7.1.1
-      '@iconify/utils': 2.2.1
+      '@iconify/utils': 2.3.0
       '@mermaid-js/parser': 0.3.0
       '@types/d3': 7.4.3
       cytoscape: 3.31.0
@@ -59174,7 +59610,7 @@ snapshots:
       lodash-es: 4.17.21
       marked: 13.0.3
       roughjs: 4.6.6
-      stylis: 4.3.5
+      stylis: 4.3.6
       ts-dedent: 2.2.0
       uuid: 9.0.1
     transitivePeerDependencies:
@@ -60197,7 +60633,7 @@ snapshots:
 
   node-machine-id@1.1.12: {}
 
-  node-mocks-http@1.16.2(@types/express@5.0.0)(@types/node@22.13.0):
+  node-mocks-http@1.16.2(@types/express@5.0.0)(@types/node@22.13.1):
     dependencies:
       accepts: 1.3.8
       content-disposition: 0.5.4
@@ -60211,7 +60647,7 @@ snapshots:
       type-is: 1.6.18
     optionalDependencies:
       '@types/express': 5.0.0
-      '@types/node': 22.13.0
+      '@types/node': 22.13.1
 
   node-releases@2.0.19: {}
 
@@ -60452,7 +60888,7 @@ snapshots:
 
   object-hash@3.0.0: {}
 
-  object-inspect@1.13.3: {}
+  object-inspect@1.13.4: {}
 
   object-is@1.1.6:
     dependencies:
@@ -60617,7 +61053,7 @@ snapshots:
 
   openai@4.73.0(encoding@0.1.13)(zod@3.23.8):
     dependencies:
-      '@types/node': 18.19.74
+      '@types/node': 18.19.75
       '@types/node-fetch': 2.6.12
       abort-controller: 3.0.0
       agentkeepalive: 4.6.0
@@ -60631,7 +61067,7 @@ snapshots:
 
   openai@4.82.0(encoding@0.1.13)(ws@7.5.10(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8):
     dependencies:
-      '@types/node': 18.19.74
+      '@types/node': 18.19.75
       '@types/node-fetch': 2.6.12
       abort-controller: 3.0.0
       agentkeepalive: 4.6.0
@@ -60646,7 +61082,7 @@ snapshots:
 
   openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.23.8):
     dependencies:
-      '@types/node': 18.19.74
+      '@types/node': 18.19.75
       '@types/node-fetch': 2.6.12
       abort-controller: 3.0.0
       agentkeepalive: 4.6.0
@@ -60661,7 +61097,7 @@ snapshots:
 
   openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1):
     dependencies:
-      '@types/node': 18.19.74
+      '@types/node': 18.19.75
       '@types/node-fetch': 2.6.12
       abort-controller: 3.0.0
       agentkeepalive: 4.6.0
@@ -60676,7 +61112,7 @@ snapshots:
 
   openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@6.0.5))(zod@3.23.8):
     dependencies:
-      '@types/node': 18.19.74
+      '@types/node': 18.19.75
       '@types/node-fetch': 2.6.12
       abort-controller: 3.0.0
       agentkeepalive: 4.6.0
@@ -61702,21 +62138,21 @@ snapshots:
       '@csstools/utilities': 2.0.0(postcss@8.5.1)
       postcss: 8.5.1
 
-  postcss-load-config@3.1.4(postcss@8.5.1)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.74)(typescript@5.7.3)):
+  postcss-load-config@3.1.4(postcss@8.5.1)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.75)(typescript@5.7.3)):
     dependencies:
       lilconfig: 2.1.0
       yaml: 1.10.2
     optionalDependencies:
       postcss: 8.5.1
-      ts-node: 10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.74)(typescript@5.7.3)
+      ts-node: 10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.75)(typescript@5.7.3)
 
-  postcss-load-config@4.0.2(postcss@8.5.1)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.6.3)):
+  postcss-load-config@4.0.2(postcss@8.5.1)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.6.3)):
     dependencies:
       lilconfig: 3.1.3
       yaml: 2.7.0
     optionalDependencies:
       postcss: 8.5.1
-      ts-node: 10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.6.3)
+      ts-node: 10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.6.3)
 
   postcss-load-config@5.1.0(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2):
     dependencies:
@@ -62421,10 +62857,10 @@ snapshots:
       end-of-stream: 1.4.4
       once: 1.4.0
 
-  pumpdotfun-sdk@1.3.2(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(rollup@4.34.1)(typescript@5.6.3)(utf-8-validate@5.0.10):
+  pumpdotfun-sdk@1.3.2(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(rollup@4.34.4)(typescript@5.6.3)(utf-8-validate@5.0.10):
     dependencies:
       '@coral-xyz/anchor': 0.28.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
-      '@rollup/plugin-json': 6.1.0(rollup@4.34.1)
+      '@rollup/plugin-json': 6.1.0(rollup@4.34.4)
       '@solana/spl-token': 0.4.6(@solana/web3.js@1.95.5(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.6.3)(utf-8-validate@5.0.10)
       '@solana/web3.js': 1.95.5(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
     transitivePeerDependencies:
@@ -62435,10 +62871,10 @@ snapshots:
       - typescript
       - utf-8-validate
 
-  pumpdotfun-sdk@1.3.2(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(rollup@4.34.1)(typescript@5.7.3)(utf-8-validate@5.0.10):
+  pumpdotfun-sdk@1.3.2(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(rollup@4.34.4)(typescript@5.7.3)(utf-8-validate@5.0.10):
     dependencies:
       '@coral-xyz/anchor': 0.28.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
-      '@rollup/plugin-json': 6.1.0(rollup@4.34.1)
+      '@rollup/plugin-json': 6.1.0(rollup@4.34.4)
       '@solana/spl-token': 0.4.6(@solana/web3.js@1.95.5(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@solana/web3.js': 1.95.5(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
     transitivePeerDependencies:
@@ -62452,7 +62888,7 @@ snapshots:
   pumpdotfun-sdk@1.3.2(bufferutil@4.0.9)(encoding@0.1.13)(typescript@5.7.3)(utf-8-validate@6.0.5):
     dependencies:
       '@coral-xyz/anchor': 0.28.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@6.0.5)
-      '@rollup/plugin-json': 6.1.0(rollup@4.34.1)
+      '@rollup/plugin-json': 6.1.0(rollup@4.34.4)
       '@solana/spl-token': 0.4.6(@solana/web3.js@1.95.5(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@6.0.5))(bufferutil@4.0.9)(encoding@0.1.13)(typescript@5.7.3)(utf-8-validate@6.0.5)
       '@solana/web3.js': 1.95.5(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@6.0.5)
     transitivePeerDependencies:
@@ -63379,14 +63815,14 @@ snapshots:
     optionalDependencies:
       '@babel/code-frame': 7.26.2
 
-  rollup-plugin-visualizer@5.14.0(rollup@4.34.1):
+  rollup-plugin-visualizer@5.14.0(rollup@4.34.4):
     dependencies:
       open: 8.4.2
       picomatch: 4.0.2
       source-map: 0.7.4
       yargs: 17.7.2
     optionalDependencies:
-      rollup: 4.34.1
+      rollup: 4.34.4
 
   rollup@2.79.2:
     optionalDependencies:
@@ -63396,29 +63832,29 @@ snapshots:
     optionalDependencies:
       fsevents: 2.3.3
 
-  rollup@4.34.1:
+  rollup@4.34.4:
     dependencies:
       '@types/estree': 1.0.6
     optionalDependencies:
-      '@rollup/rollup-android-arm-eabi': 4.34.1
-      '@rollup/rollup-android-arm64': 4.34.1
-      '@rollup/rollup-darwin-arm64': 4.34.1
-      '@rollup/rollup-darwin-x64': 4.34.1
-      '@rollup/rollup-freebsd-arm64': 4.34.1
-      '@rollup/rollup-freebsd-x64': 4.34.1
-      '@rollup/rollup-linux-arm-gnueabihf': 4.34.1
-      '@rollup/rollup-linux-arm-musleabihf': 4.34.1
-      '@rollup/rollup-linux-arm64-gnu': 4.34.1
-      '@rollup/rollup-linux-arm64-musl': 4.34.1
-      '@rollup/rollup-linux-loongarch64-gnu': 4.34.1
-      '@rollup/rollup-linux-powerpc64le-gnu': 4.34.1
-      '@rollup/rollup-linux-riscv64-gnu': 4.34.1
-      '@rollup/rollup-linux-s390x-gnu': 4.34.1
-      '@rollup/rollup-linux-x64-gnu': 4.34.1
-      '@rollup/rollup-linux-x64-musl': 4.34.1
-      '@rollup/rollup-win32-arm64-msvc': 4.34.1
-      '@rollup/rollup-win32-ia32-msvc': 4.34.1
-      '@rollup/rollup-win32-x64-msvc': 4.34.1
+      '@rollup/rollup-android-arm-eabi': 4.34.4
+      '@rollup/rollup-android-arm64': 4.34.4
+      '@rollup/rollup-darwin-arm64': 4.34.4
+      '@rollup/rollup-darwin-x64': 4.34.4
+      '@rollup/rollup-freebsd-arm64': 4.34.4
+      '@rollup/rollup-freebsd-x64': 4.34.4
+      '@rollup/rollup-linux-arm-gnueabihf': 4.34.4
+      '@rollup/rollup-linux-arm-musleabihf': 4.34.4
+      '@rollup/rollup-linux-arm64-gnu': 4.34.4
+      '@rollup/rollup-linux-arm64-musl': 4.34.4
+      '@rollup/rollup-linux-loongarch64-gnu': 4.34.4
+      '@rollup/rollup-linux-powerpc64le-gnu': 4.34.4
+      '@rollup/rollup-linux-riscv64-gnu': 4.34.4
+      '@rollup/rollup-linux-s390x-gnu': 4.34.4
+      '@rollup/rollup-linux-x64-gnu': 4.34.4
+      '@rollup/rollup-linux-x64-musl': 4.34.4
+      '@rollup/rollup-win32-arm64-msvc': 4.34.4
+      '@rollup/rollup-win32-ia32-msvc': 4.34.4
+      '@rollup/rollup-win32-x64-msvc': 4.34.4
       fsevents: 2.3.3
 
   roughjs@4.6.6:
@@ -63856,27 +64292,27 @@ snapshots:
   side-channel-list@1.0.0:
     dependencies:
       es-errors: 1.3.0
-      object-inspect: 1.13.3
+      object-inspect: 1.13.4
 
   side-channel-map@1.0.1:
     dependencies:
       call-bound: 1.0.3
       es-errors: 1.3.0
       get-intrinsic: 1.2.7
-      object-inspect: 1.13.3
+      object-inspect: 1.13.4
 
   side-channel-weakmap@1.0.2:
     dependencies:
       call-bound: 1.0.3
       es-errors: 1.3.0
       get-intrinsic: 1.2.7
-      object-inspect: 1.13.3
+      object-inspect: 1.13.4
       side-channel-map: 1.0.1
 
   side-channel@1.1.0:
     dependencies:
       es-errors: 1.3.0
-      object-inspect: 1.13.3
+      object-inspect: 1.13.4
       side-channel-list: 1.0.0
       side-channel-map: 1.0.1
       side-channel-weakmap: 1.0.2
@@ -64107,10 +64543,10 @@ snapshots:
       '@coral-xyz/anchor': 0.28.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
       '@drift-labs/sdk': 2.107.0-beta.3(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.6.3)(utf-8-validate@5.0.10)
       '@drift-labs/vaults-sdk': 0.2.68(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@20.17.9)(arweave@1.15.5)(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(utf-8-validate@5.0.10)
-      '@langchain/core': 0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1))
-      '@langchain/groq': 0.1.3(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
-      '@langchain/langgraph': 0.2.44(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))
-      '@langchain/openai': 0.3.17(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
+      '@langchain/core': 0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1))
+      '@langchain/groq': 0.1.3(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
+      '@langchain/langgraph': 0.2.44(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))
+      '@langchain/openai': 0.3.17(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
       '@lightprotocol/compressed-token': 0.17.1(@lightprotocol/stateless.js@0.17.1(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.6.3)(utf-8-validate@5.0.10)
       '@lightprotocol/stateless.js': 0.17.1(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
       '@mercurial-finance/dynamic-amm-sdk': 1.1.23(@solana/buffer-layout@4.0.1)(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.6.3)(utf-8-validate@5.0.10)
@@ -64122,7 +64558,7 @@ snapshots:
       '@metaplex-foundation/umi-bundle-defaults': 0.9.2(@metaplex-foundation/umi@0.9.2)(@solana/web3.js@1.98.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(encoding@0.1.13)
       '@metaplex-foundation/umi-web3js-adapters': 0.9.2(@metaplex-foundation/umi@0.9.2)(@solana/web3.js@1.98.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))
       '@meteora-ag/alpha-vault': 1.1.8(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.6.3)(utf-8-validate@5.0.10)
-      '@meteora-ag/dlmm': 1.3.10(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.6.3)(utf-8-validate@5.0.10)
+      '@meteora-ag/dlmm': 1.3.11(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.6.3)(utf-8-validate@5.0.10)
       '@onsol/tldparser': 0.6.7(@solana/web3.js@1.98.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(bn.js@5.2.1)(borsh@2.0.0)(buffer@6.0.3)(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
       '@orca-so/common-sdk': 0.6.4(@solana/spl-token@0.4.9(@solana/web3.js@1.95.8(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.6.3)(utf-8-validate@5.0.10))(@solana/web3.js@1.95.8(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(decimal.js@10.5.0)
       '@orca-so/whirlpools-sdk': 0.13.14(@coral-xyz/anchor@0.28.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(@orca-so/common-sdk@0.6.4(@solana/spl-token@0.4.9(@solana/web3.js@1.95.8(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.6.3)(utf-8-validate@5.0.10))(@solana/web3.js@1.98.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(decimal.js@10.5.0))(@solana/spl-token@0.4.9(@solana/web3.js@1.95.8(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.6.3)(utf-8-validate@5.0.10))(@solana/web3.js@1.98.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(decimal.js@10.5.0)
@@ -64133,16 +64569,16 @@ snapshots:
       '@sqds/multisig': 2.1.3(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.6.3)(utf-8-validate@5.0.10)
       '@tensor-oss/tensorswap-sdk': 4.5.0(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.6.3)(utf-8-validate@5.0.10)
       '@tiplink/api': 0.3.1(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(sodium-native@3.4.1)(utf-8-validate@5.0.10)
-      '@voltr/vault-sdk': 0.1.4(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.6.3)(utf-8-validate@5.0.10)
+      '@voltr/vault-sdk': 0.1.5(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.6.3)(utf-8-validate@5.0.10)
       ai: 4.1.16(react@19.0.0)(zod@3.24.1)
       bn.js: 5.2.1
       bs58: 5.0.0
       chai: 5.1.2
       decimal.js: 10.5.0
       dotenv: 16.4.7
-      flash-sdk: 2.27.1(@swc/core@1.10.14(@swc/helpers@0.5.15))(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.6.3)(utf-8-validate@5.0.10)
+      flash-sdk: 2.28.10(@swc/core@1.10.14(@swc/helpers@0.5.15))(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.6.3)(utf-8-validate@5.0.10)
       form-data: 4.0.1
-      langchain: 0.3.15(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(@langchain/groq@0.1.3(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10)))(axios@1.7.9)(encoding@0.1.13)(handlebars@4.7.8)(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1))(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
+      langchain: 0.3.15(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(@langchain/groq@0.1.3(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10)))(axios@1.7.9)(encoding@0.1.13)(handlebars@4.7.8)(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1))(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
       openai: 4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)
       typedoc: 0.27.6(typescript@5.6.3)
       zod: 3.24.1
@@ -64181,19 +64617,19 @@ snapshots:
       - utf-8-validate
       - ws
 
-  solana-agent-kit@1.4.4(@noble/hashes@1.7.1)(@solana/buffer-layout@4.0.1)(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(arweave@1.15.5)(axios@1.7.9)(borsh@2.0.0)(buffer@6.0.3)(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(handlebars@4.7.8)(react@19.0.0)(sodium-native@3.4.1)(typescript@5.7.3)(utf-8-validate@5.0.10)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10)):
+  solana-agent-kit@1.4.4(@noble/hashes@1.7.1)(@solana/buffer-layout@4.0.1)(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(arweave@1.15.5)(axios@1.7.9)(borsh@2.0.0)(buffer@6.0.3)(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(handlebars@4.7.8)(react@19.0.0)(sodium-native@3.4.1)(typescript@5.7.3)(utf-8-validate@5.0.10)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10)):
     dependencies:
-      '@3land/listings-sdk': 0.0.7(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(arweave@1.15.5)(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@3land/listings-sdk': 0.0.7(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(arweave@1.15.5)(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@ai-sdk/openai': 1.1.9(zod@3.24.1)
       '@bonfida/spl-name-service': 3.0.8(@solana/web3.js@1.98.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@cks-systems/manifest-sdk': 0.1.59(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@coral-xyz/anchor': 0.28.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
       '@drift-labs/sdk': 2.107.0-beta.3(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@drift-labs/vaults-sdk': 0.2.68(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(arweave@1.15.5)(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(utf-8-validate@5.0.10)
-      '@langchain/core': 0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1))
-      '@langchain/groq': 0.1.3(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
-      '@langchain/langgraph': 0.2.44(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))
-      '@langchain/openai': 0.3.17(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
+      '@drift-labs/vaults-sdk': 0.2.68(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(arweave@1.15.5)(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(utf-8-validate@5.0.10)
+      '@langchain/core': 0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1))
+      '@langchain/groq': 0.1.3(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
+      '@langchain/langgraph': 0.2.44(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))
+      '@langchain/openai': 0.3.17(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
       '@lightprotocol/compressed-token': 0.17.1(@lightprotocol/stateless.js@0.17.1(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@lightprotocol/stateless.js': 0.17.1(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
       '@mercurial-finance/dynamic-amm-sdk': 1.1.23(@solana/buffer-layout@4.0.1)(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10)
@@ -64205,7 +64641,7 @@ snapshots:
       '@metaplex-foundation/umi-bundle-defaults': 0.9.2(@metaplex-foundation/umi@0.9.2)(@solana/web3.js@1.98.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(encoding@0.1.13)
       '@metaplex-foundation/umi-web3js-adapters': 0.9.2(@metaplex-foundation/umi@0.9.2)(@solana/web3.js@1.98.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))
       '@meteora-ag/alpha-vault': 1.1.8(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10)
-      '@meteora-ag/dlmm': 1.3.10(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@meteora-ag/dlmm': 1.3.11(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@onsol/tldparser': 0.6.7(@solana/web3.js@1.98.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(bn.js@5.2.1)(borsh@2.0.0)(buffer@6.0.3)(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10)
       '@orca-so/common-sdk': 0.6.4(@solana/spl-token@0.4.9(@solana/web3.js@1.95.8(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10))(@solana/web3.js@1.98.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(decimal.js@10.5.0)
       '@orca-so/whirlpools-sdk': 0.13.14(@coral-xyz/anchor@0.28.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(@orca-so/common-sdk@0.6.4(@solana/spl-token@0.4.9(@solana/web3.js@1.95.8(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10))(@solana/web3.js@1.98.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(decimal.js@10.5.0))(@solana/spl-token@0.4.9(@solana/web3.js@1.95.8(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10))(@solana/web3.js@1.98.0(bufferutil@4.0.9)(encoding@0.1.13)(utf-8-validate@5.0.10))(decimal.js@10.5.0)
@@ -64216,16 +64652,16 @@ snapshots:
       '@sqds/multisig': 2.1.3(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@tensor-oss/tensorswap-sdk': 4.5.0(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10)
       '@tiplink/api': 0.3.1(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(sodium-native@3.4.1)(utf-8-validate@5.0.10)
-      '@voltr/vault-sdk': 0.1.4(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      '@voltr/vault-sdk': 0.1.5(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10)
       ai: 4.1.16(react@19.0.0)(zod@3.24.1)
       bn.js: 5.2.1
       bs58: 5.0.0
       chai: 5.1.2
       decimal.js: 10.5.0
       dotenv: 16.4.7
-      flash-sdk: 2.27.1(@swc/core@1.10.14(@swc/helpers@0.5.15))(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10)
+      flash-sdk: 2.28.10(@swc/core@1.10.14(@swc/helpers@0.5.15))(bufferutil@4.0.9)(encoding@0.1.13)(fastestsmallesttextencoderdecoder@1.0.22)(typescript@5.7.3)(utf-8-validate@5.0.10)
       form-data: 4.0.1
-      langchain: 0.3.15(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(@langchain/groq@0.1.3(@langchain/core@0.3.37(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10)))(axios@1.7.9)(encoding@0.1.13)(handlebars@4.7.8)(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1))(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
+      langchain: 0.3.15(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(@langchain/groq@0.1.3(@langchain/core@0.3.38(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)))(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10)))(axios@1.7.9)(encoding@0.1.13)(handlebars@4.7.8)(openai@4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1))(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))
       openai: 4.82.0(encoding@0.1.13)(ws@8.18.0(bufferutil@4.0.9)(utf-8-validate@5.0.10))(zod@3.24.1)
       typedoc: 0.27.6(typescript@5.7.3)
       zod: 3.24.1
@@ -64493,9 +64929,9 @@ snapshots:
     dependencies:
       minipass: 7.1.2
 
-  sswr@2.1.0(svelte@5.19.7):
+  sswr@2.1.0(svelte@5.19.8):
     dependencies:
-      svelte: 5.19.7
+      svelte: 5.19.8
       swrev: 4.0.0
 
   stable-hash@0.0.4: {}
@@ -64797,7 +65233,7 @@ snapshots:
 
   stylis@4.2.0: {}
 
-  stylis@4.3.5: {}
+  stylis@4.3.6: {}
 
   subarg@1.0.0:
     dependencies:
@@ -64849,7 +65285,7 @@ snapshots:
 
   supports-preserve-symlinks-flag@1.0.0: {}
 
-  svelte@5.19.7:
+  svelte@5.19.8:
     dependencies:
       '@ampproject/remapping': 2.3.0
       '@jridgewell/sourcemap-codec': 1.5.0
@@ -64896,7 +65332,7 @@ snapshots:
       - supports-color
       - utf-8-validate
 
-  swr@2.3.0(react@19.0.0):
+  swr@2.3.2(react@19.0.0):
     dependencies:
       dequal: 2.0.3
       react: 19.0.0
@@ -64929,11 +65365,11 @@ snapshots:
 
   tailwind-merge@2.6.0: {}
 
-  tailwindcss-animate@1.0.7(tailwindcss@3.4.17(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.6.3))):
+  tailwindcss-animate@1.0.7(tailwindcss@3.4.17(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.6.3))):
     dependencies:
-      tailwindcss: 3.4.17(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.6.3))
+      tailwindcss: 3.4.17(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.6.3))
 
-  tailwindcss@3.4.17(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.6.3)):
+  tailwindcss@3.4.17(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.6.3)):
     dependencies:
       '@alloc/quick-lru': 5.2.0
       arg: 5.0.2
@@ -64952,7 +65388,7 @@ snapshots:
       postcss: 8.5.1
       postcss-import: 15.1.0(postcss@8.5.1)
       postcss-js: 4.0.1(postcss@8.5.1)
-      postcss-load-config: 4.0.2(postcss@8.5.1)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.6.3))
+      postcss-load-config: 4.0.2(postcss@8.5.1)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.6.3))
       postcss-nested: 6.2.0(postcss@8.5.1)
       postcss-selector-parser: 6.1.2
       resolve: 1.22.10
@@ -65090,12 +65526,12 @@ snapshots:
       jest-worker: 27.5.1
       schema-utils: 4.3.0
       serialize-javascript: 6.0.2
-      terser: 5.37.0
+      terser: 5.38.0
       webpack: 5.97.1(@swc/core@1.10.14(@swc/helpers@0.5.15))
     optionalDependencies:
       '@swc/core': 1.10.14(@swc/helpers@0.5.15)
 
-  terser@5.37.0:
+  terser@5.38.0:
     dependencies:
       '@jridgewell/source-map': 0.3.6
       acorn: 8.14.0
@@ -65138,7 +65574,7 @@ snapshots:
     dependencies:
       any-promise: 1.3.0
 
-  thirdweb@5.87.2(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(bufferutil@4.0.9)(encoding@0.1.13)(ethers@6.13.5(bufferutil@4.0.9)(utf-8-validate@5.0.10))(ioredis@5.4.2)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)(typescript@5.7.3)(utf-8-validate@5.0.10)(zod@3.24.1):
+  thirdweb@5.87.4(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(bufferutil@4.0.9)(encoding@0.1.13)(ethers@6.13.5(bufferutil@4.0.9)(utf-8-validate@5.0.10))(ioredis@5.4.2)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)(typescript@5.7.3)(utf-8-validate@5.0.10)(zod@3.24.1):
     dependencies:
       '@coinbase/wallet-sdk': 4.2.4
       '@emotion/react': 11.14.0(@types/react@19.0.8)(react@19.0.0)
@@ -65151,7 +65587,7 @@ snapshots:
       '@radix-ui/react-focus-scope': 1.1.1(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
       '@radix-ui/react-icons': 1.3.2(react@19.0.0)
       '@radix-ui/react-tooltip': 1.1.7(@types/react-dom@19.0.3(@types/react@19.0.8))(@types/react@19.0.8)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
-      '@tanstack/react-query': 5.65.1(react@19.0.0)
+      '@tanstack/react-query': 5.66.0(react@19.0.0)
       '@walletconnect/ethereum-provider': 2.17.5(@types/react@19.0.8)(bufferutil@4.0.9)(encoding@0.1.13)(ioredis@5.4.2)(react@19.0.0)(utf-8-validate@5.0.10)
       '@walletconnect/sign-client': 2.17.5(bufferutil@4.0.9)(ioredis@5.4.2)(utf-8-validate@5.0.10)
       abitype: 1.0.8(typescript@5.7.3)(zod@3.24.1)
@@ -65220,7 +65656,7 @@ snapshots:
 
   thunky@1.1.0: {}
 
-  tiktoken@1.0.19: {}
+  tiktoken@1.0.20: {}
 
   time-span@5.1.0:
     dependencies:
@@ -65334,7 +65770,7 @@ snapshots:
 
   together-ai@0.7.0(encoding@0.1.13):
     dependencies:
-      '@types/node': 18.19.74
+      '@types/node': 18.19.75
       '@types/node-fetch': 2.6.12
       abort-controller: 3.0.0
       agentkeepalive: 4.6.0
@@ -65410,13 +65846,13 @@ snapshots:
 
   trough@2.2.0: {}
 
-  trpc-openapi@1.2.0(@trpc/server@10.40.0)(@types/express@5.0.0)(@types/node@22.13.0)(zod@3.22.4):
+  trpc-openapi@1.2.0(@trpc/server@10.40.0)(@types/express@5.0.0)(@types/node@22.13.1)(zod@3.22.4):
     dependencies:
       '@trpc/server': 10.40.0
       co-body: 6.2.0
       h3: 1.14.0
       lodash.clonedeep: 4.5.0
-      node-mocks-http: 1.16.2(@types/express@5.0.0)(@types/node@22.13.0)
+      node-mocks-http: 1.16.2(@types/express@5.0.0)(@types/node@22.13.1)
       openapi-types: 12.1.3
       zod: 3.22.4
       zod-to-json-schema: 3.24.1(zod@3.22.4)
@@ -65472,12 +65908,12 @@ snapshots:
       babel-jest: 29.7.0(@babel/core@7.26.7)
       esbuild: 0.24.2
 
-  ts-jest@29.2.5(@babel/core@7.26.7)(@jest/transform@29.7.0)(@jest/types@29.6.3)(babel-jest@29.7.0(@babel/core@7.26.7))(jest@29.7.0(@types/node@18.19.74)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.74)(typescript@5.7.3)))(typescript@5.7.3):
+  ts-jest@29.2.5(@babel/core@7.26.7)(@jest/transform@29.7.0)(@jest/types@29.6.3)(babel-jest@29.7.0(@babel/core@7.26.7))(jest@29.7.0(@types/node@18.19.75)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.75)(typescript@5.7.3)))(typescript@5.7.3):
     dependencies:
       bs-logger: 0.2.6
       ejs: 3.1.10
       fast-json-stable-stringify: 2.1.0
-      jest: 29.7.0(@types/node@18.19.74)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.74)(typescript@5.7.3))
+      jest: 29.7.0(@types/node@18.19.75)(babel-plugin-macros@3.1.0)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.75)(typescript@5.7.3))
       jest-util: 29.7.0
       json5: 2.2.3
       lodash.memoize: 4.1.2
@@ -65510,12 +65946,12 @@ snapshots:
       '@jest/types': 29.6.3
       babel-jest: 29.7.0(@babel/core@7.26.7)
 
-  ts-jest@29.2.5(@babel/core@7.26.7)(@jest/transform@29.7.0)(@jest/types@29.6.3)(babel-jest@29.7.0(@babel/core@7.26.7))(jest@29.7.0(@types/node@22.13.0)(babel-plugin-macros@3.1.0))(typescript@5.7.3):
+  ts-jest@29.2.5(@babel/core@7.26.7)(@jest/transform@29.7.0)(@jest/types@29.6.3)(babel-jest@29.7.0(@babel/core@7.26.7))(jest@29.7.0(@types/node@22.13.1)(babel-plugin-macros@3.1.0))(typescript@5.7.3):
     dependencies:
       bs-logger: 0.2.6
       ejs: 3.1.10
       fast-json-stable-stringify: 2.1.0
-      jest: 29.7.0(@types/node@22.13.0)(babel-plugin-macros@3.1.0)
+      jest: 29.7.0(@types/node@22.13.1)(babel-plugin-macros@3.1.0)
       jest-util: 29.7.0
       json5: 2.2.3
       lodash.memoize: 4.1.2
@@ -65557,14 +65993,14 @@ snapshots:
       '@ts-morph/common': 0.19.0
       code-block-writer: 12.0.0
 
-  ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@16.18.125)(typescript@5.7.3):
+  ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@16.18.126)(typescript@5.7.3):
     dependencies:
       '@cspotcode/source-map-support': 0.8.1
       '@tsconfig/node10': 1.0.11
       '@tsconfig/node12': 1.0.11
       '@tsconfig/node14': 1.0.3
       '@tsconfig/node16': 1.0.4
-      '@types/node': 16.18.125
+      '@types/node': 16.18.126
       acorn: 8.14.0
       acorn-walk: 8.3.4
       arg: 4.1.3
@@ -65578,14 +66014,14 @@ snapshots:
       '@swc/core': 1.10.14(@swc/helpers@0.5.15)
     optional: true
 
-  ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.74)(typescript@5.7.3):
+  ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.75)(typescript@5.7.3):
     dependencies:
       '@cspotcode/source-map-support': 0.8.1
       '@tsconfig/node10': 1.0.11
       '@tsconfig/node12': 1.0.11
       '@tsconfig/node14': 1.0.3
       '@tsconfig/node16': 1.0.4
-      '@types/node': 18.19.74
+      '@types/node': 18.19.75
       acorn: 8.14.0
       acorn-walk: 8.3.4
       arg: 4.1.3
@@ -65638,14 +66074,14 @@ snapshots:
     optionalDependencies:
       '@swc/core': 1.10.14(@swc/helpers@0.5.15)
 
-  ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@4.9.5):
+  ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@4.9.5):
     dependencies:
       '@cspotcode/source-map-support': 0.8.1
       '@tsconfig/node10': 1.0.11
       '@tsconfig/node12': 1.0.11
       '@tsconfig/node14': 1.0.3
       '@tsconfig/node16': 1.0.4
-      '@types/node': 22.13.0
+      '@types/node': 22.13.1
       acorn: 8.14.0
       acorn-walk: 8.3.4
       arg: 4.1.3
@@ -65658,14 +66094,14 @@ snapshots:
     optionalDependencies:
       '@swc/core': 1.10.14(@swc/helpers@0.5.15)
 
-  ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.6.3):
+  ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.6.3):
     dependencies:
       '@cspotcode/source-map-support': 0.8.1
       '@tsconfig/node10': 1.0.11
       '@tsconfig/node12': 1.0.11
       '@tsconfig/node14': 1.0.3
       '@tsconfig/node16': 1.0.4
-      '@types/node': 22.13.0
+      '@types/node': 22.13.1
       acorn: 8.14.0
       acorn-walk: 8.3.4
       arg: 4.1.3
@@ -65678,14 +66114,14 @@ snapshots:
     optionalDependencies:
       '@swc/core': 1.10.14(@swc/helpers@0.5.15)
 
-  ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.0)(typescript@5.7.3):
+  ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@22.13.1)(typescript@5.7.3):
     dependencies:
       '@cspotcode/source-map-support': 0.8.1
       '@tsconfig/node10': 1.0.11
       '@tsconfig/node12': 1.0.11
       '@tsconfig/node14': 1.0.3
       '@tsconfig/node16': 1.0.4
-      '@types/node': 22.13.0
+      '@types/node': 22.13.1
       acorn: 8.14.0
       acorn-walk: 8.3.4
       arg: 4.1.3
@@ -65724,11 +66160,11 @@ snapshots:
 
   ts-xor@1.3.0: {}
 
-  tsconfck@3.1.4(typescript@5.6.3):
+  tsconfck@3.1.5(typescript@5.6.3):
     optionalDependencies:
       typescript: 5.6.3
 
-  tsconfck@3.1.4(typescript@5.7.3):
+  tsconfck@3.1.5(typescript@5.7.3):
     optionalDependencies:
       typescript: 5.7.3
 
@@ -65763,7 +66199,7 @@ snapshots:
 
   tsscmp@1.0.6: {}
 
-  tsup@6.7.0(@swc/core@1.10.14(@swc/helpers@0.5.15))(postcss@8.5.1)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.74)(typescript@5.7.3))(typescript@5.7.3):
+  tsup@6.7.0(@swc/core@1.10.14(@swc/helpers@0.5.15))(postcss@8.5.1)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.75)(typescript@5.7.3))(typescript@5.7.3):
     dependencies:
       bundle-require: 4.2.1(esbuild@0.17.19)
       cac: 6.7.14
@@ -65773,7 +66209,7 @@ snapshots:
       execa: 5.1.1
       globby: 11.1.0
       joycon: 3.1.1
-      postcss-load-config: 3.1.4(postcss@8.5.1)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.74)(typescript@5.7.3))
+      postcss-load-config: 3.1.4(postcss@8.5.1)(ts-node@10.9.2(@swc/core@1.10.14(@swc/helpers@0.5.15))(@types/node@18.19.75)(typescript@5.7.3))
       resolve-from: 5.0.0
       rollup: 3.29.5
       source-map: 0.8.0-beta.0
@@ -65799,7 +66235,7 @@ snapshots:
       picocolors: 1.1.1
       postcss-load-config: 6.0.1(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(yaml@2.7.0)
       resolve-from: 5.0.0
-      rollup: 4.34.1
+      rollup: 4.34.4
       source-map: 0.8.0-beta.0
       sucrase: 3.35.0
       tinyexec: 0.3.2
@@ -65827,7 +66263,7 @@ snapshots:
       picocolors: 1.1.1
       postcss-load-config: 6.0.1(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(yaml@2.7.0)
       resolve-from: 5.0.0
-      rollup: 4.34.1
+      rollup: 4.34.4
       source-map: 0.8.0-beta.0
       sucrase: 3.35.0
       tinyexec: 0.3.2
@@ -65855,7 +66291,7 @@ snapshots:
       picocolors: 1.1.1
       postcss-load-config: 6.0.1(jiti@2.4.2)(postcss@8.5.1)(tsx@4.19.2)(yaml@2.7.0)
       resolve-from: 5.0.0
-      rollup: 4.34.1
+      rollup: 4.34.4
       source-map: 0.8.0-beta.0
       sucrase: 3.35.0
       tinyexec: 0.3.2
@@ -66546,7 +66982,7 @@ snapshots:
     optionalDependencies:
       typescript: 5.7.3
 
-  valibot@1.0.0-beta.14(typescript@5.7.3):
+  valibot@1.0.0-beta.15(typescript@5.7.3):
     optionalDependencies:
       typescript: 5.7.3
 
@@ -66751,14 +67187,14 @@ snapshots:
       - utf-8-validate
       - zod
 
-  vite-node@0.34.6(@types/node@20.17.9)(terser@5.37.0):
+  vite-node@0.34.6(@types/node@20.17.9)(terser@5.38.0):
     dependencies:
       cac: 6.7.14
       debug: 4.4.0(supports-color@8.1.1)
       mlly: 1.7.4
       pathe: 1.1.2
       picocolors: 1.1.1
-      vite: 5.4.12(@types/node@20.17.9)(terser@5.37.0)
+      vite: 5.4.12(@types/node@20.17.9)(terser@5.38.0)
     transitivePeerDependencies:
       - '@types/node'
       - less
@@ -66770,13 +67206,13 @@ snapshots:
       - supports-color
       - terser
 
-  vite-node@1.1.3(@types/node@22.13.0)(terser@5.37.0):
+  vite-node@1.1.3(@types/node@22.13.1)(terser@5.38.0):
     dependencies:
       cac: 6.7.14
       debug: 4.4.0(supports-color@8.1.1)
       pathe: 1.1.2
       picocolors: 1.1.1
-      vite: 5.4.12(@types/node@22.13.0)(terser@5.37.0)
+      vite: 5.4.12(@types/node@22.13.1)(terser@5.38.0)
     transitivePeerDependencies:
       - '@types/node'
       - less
@@ -66788,13 +67224,13 @@ snapshots:
       - supports-color
       - terser
 
-  vite-node@1.2.1(@types/node@22.13.0)(terser@5.37.0):
+  vite-node@1.2.1(@types/node@22.13.1)(terser@5.38.0):
     dependencies:
       cac: 6.7.14
       debug: 4.4.0(supports-color@8.1.1)
       pathe: 1.1.2
       picocolors: 1.1.1
-      vite: 5.4.12(@types/node@22.13.0)(terser@5.37.0)
+      vite: 5.4.12(@types/node@22.13.1)(terser@5.38.0)
     transitivePeerDependencies:
       - '@types/node'
       - less
@@ -66806,13 +67242,13 @@ snapshots:
       - supports-color
       - terser
 
-  vite-node@1.6.1(@types/node@18.19.74)(terser@5.37.0):
+  vite-node@1.6.1(@types/node@18.19.75)(terser@5.38.0):
     dependencies:
       cac: 6.7.14
       debug: 4.4.0(supports-color@8.1.1)
       pathe: 1.1.2
       picocolors: 1.1.1
-      vite: 5.4.12(@types/node@18.19.74)(terser@5.37.0)
+      vite: 5.4.12(@types/node@18.19.75)(terser@5.38.0)
     transitivePeerDependencies:
       - '@types/node'
       - less
@@ -66824,13 +67260,13 @@ snapshots:
       - supports-color
       - terser
 
-  vite-node@1.6.1(@types/node@20.17.9)(terser@5.37.0):
+  vite-node@1.6.1(@types/node@20.17.9)(terser@5.38.0):
     dependencies:
       cac: 6.7.14
       debug: 4.4.0(supports-color@8.1.1)
       pathe: 1.1.2
       picocolors: 1.1.1
-      vite: 5.4.12(@types/node@20.17.9)(terser@5.37.0)
+      vite: 5.4.12(@types/node@20.17.9)(terser@5.38.0)
     transitivePeerDependencies:
       - '@types/node'
       - less
@@ -66842,13 +67278,13 @@ snapshots:
       - supports-color
       - terser
 
-  vite-node@1.6.1(@types/node@22.13.0)(terser@5.37.0):
+  vite-node@1.6.1(@types/node@22.13.1)(terser@5.38.0):
     dependencies:
       cac: 6.7.14
       debug: 4.4.0(supports-color@8.1.1)
       pathe: 1.1.2
       picocolors: 1.1.1
-      vite: 5.4.12(@types/node@22.13.0)(terser@5.37.0)
+      vite: 5.4.12(@types/node@22.13.1)(terser@5.38.0)
     transitivePeerDependencies:
       - '@types/node'
       - less
@@ -66860,12 +67296,12 @@ snapshots:
       - supports-color
       - terser
 
-  vite-node@2.1.4(@types/node@20.17.9)(terser@5.37.0):
+  vite-node@2.1.4(@types/node@20.17.9)(terser@5.38.0):
     dependencies:
       cac: 6.7.14
       debug: 4.4.0(supports-color@8.1.1)
       pathe: 1.1.2
-      vite: 5.4.12(@types/node@20.17.9)(terser@5.37.0)
+      vite: 5.4.12(@types/node@20.17.9)(terser@5.38.0)
     transitivePeerDependencies:
       - '@types/node'
       - less
@@ -66877,12 +67313,12 @@ snapshots:
       - supports-color
       - terser
 
-  vite-node@2.1.4(@types/node@22.13.0)(terser@5.37.0):
+  vite-node@2.1.4(@types/node@22.13.1)(terser@5.38.0):
     dependencies:
       cac: 6.7.14
       debug: 4.4.0(supports-color@8.1.1)
       pathe: 1.1.2
-      vite: 5.4.12(@types/node@22.13.0)(terser@5.37.0)
+      vite: 5.4.12(@types/node@22.13.1)(terser@5.38.0)
     transitivePeerDependencies:
       - '@types/node'
       - less
@@ -66894,13 +67330,13 @@ snapshots:
       - supports-color
       - terser
 
-  vite-node@2.1.5(@types/node@22.13.0)(terser@5.37.0):
+  vite-node@2.1.5(@types/node@22.13.1)(terser@5.38.0):
     dependencies:
       cac: 6.7.14
       debug: 4.4.0(supports-color@8.1.1)
       es-module-lexer: 1.6.0
       pathe: 1.1.2
-      vite: 5.4.12(@types/node@22.13.0)(terser@5.37.0)
+      vite: 5.4.12(@types/node@22.13.1)(terser@5.38.0)
     transitivePeerDependencies:
       - '@types/node'
       - less
@@ -66912,13 +67348,13 @@ snapshots:
       - supports-color
       - terser
 
-  vite-node@2.1.8(@types/node@20.17.9)(terser@5.37.0):
+  vite-node@2.1.8(@types/node@20.17.9)(terser@5.38.0):
     dependencies:
       cac: 6.7.14
       debug: 4.4.0(supports-color@8.1.1)
       es-module-lexer: 1.6.0
       pathe: 1.1.2
-      vite: 5.4.12(@types/node@20.17.9)(terser@5.37.0)
+      vite: 5.4.12(@types/node@20.17.9)(terser@5.38.0)
     transitivePeerDependencies:
       - '@types/node'
       - less
@@ -66930,13 +67366,13 @@ snapshots:
       - supports-color
       - terser
 
-  vite-node@2.1.8(@types/node@22.13.0)(terser@5.37.0):
+  vite-node@2.1.8(@types/node@22.13.1)(terser@5.38.0):
     dependencies:
       cac: 6.7.14
       debug: 4.4.0(supports-color@8.1.1)
       es-module-lexer: 1.6.0
       pathe: 1.1.2
-      vite: 5.4.12(@types/node@22.13.0)(terser@5.37.0)
+      vite: 5.4.12(@types/node@22.13.1)(terser@5.38.0)
     transitivePeerDependencies:
       - '@types/node'
       - less
@@ -66948,13 +67384,13 @@ snapshots:
       - supports-color
       - terser
 
-  vite-node@3.0.2(@types/node@20.17.9)(terser@5.37.0):
+  vite-node@3.0.2(@types/node@20.17.9)(terser@5.38.0):
     dependencies:
       cac: 6.7.14
       debug: 4.4.0(supports-color@8.1.1)
       es-module-lexer: 1.6.0
       pathe: 2.0.2
-      vite: 5.4.12(@types/node@20.17.9)(terser@5.37.0)
+      vite: 5.4.12(@types/node@20.17.9)(terser@5.38.0)
     transitivePeerDependencies:
       - '@types/node'
       - less
@@ -66966,13 +67402,13 @@ snapshots:
       - supports-color
       - terser
 
-  vite-node@3.0.2(@types/node@22.13.0)(terser@5.37.0):
+  vite-node@3.0.2(@types/node@22.13.1)(terser@5.38.0):
     dependencies:
       cac: 6.7.14
       debug: 4.4.0(supports-color@8.1.1)
       es-module-lexer: 1.6.0
       pathe: 2.0.2
-      vite: 5.4.12(@types/node@22.13.0)(terser@5.37.0)
+      vite: 5.4.12(@types/node@22.13.1)(terser@5.38.0)
     transitivePeerDependencies:
       - '@types/node'
       - less
@@ -66984,13 +67420,13 @@ snapshots:
       - supports-color
       - terser
 
-  vite-node@3.0.2(@types/node@22.8.4)(terser@5.37.0):
+  vite-node@3.0.2(@types/node@22.8.4)(terser@5.38.0):
     dependencies:
       cac: 6.7.14
       debug: 4.4.0(supports-color@8.1.1)
       es-module-lexer: 1.6.0
       pathe: 2.0.2
-      vite: 5.4.12(@types/node@22.8.4)(terser@5.37.0)
+      vite: 5.4.12(@types/node@22.8.4)(terser@5.38.0)
     transitivePeerDependencies:
       - '@types/node'
       - less
@@ -67002,116 +67438,116 @@ snapshots:
       - supports-color
       - terser
 
-  vite-plugin-compression@0.5.1(vite@6.0.11(@types/node@22.13.0)(jiti@2.4.2)(terser@5.37.0)(tsx@4.19.2)(yaml@2.7.0)):
+  vite-plugin-compression@0.5.1(vite@6.1.0(@types/node@22.13.1)(jiti@2.4.2)(terser@5.38.0)(tsx@4.19.2)(yaml@2.7.0)):
     dependencies:
       chalk: 4.1.2
       debug: 4.4.0(supports-color@8.1.1)
       fs-extra: 10.1.0
-      vite: 6.0.11(@types/node@22.13.0)(jiti@2.4.2)(terser@5.37.0)(tsx@4.19.2)(yaml@2.7.0)
+      vite: 6.1.0(@types/node@22.13.1)(jiti@2.4.2)(terser@5.38.0)(tsx@4.19.2)(yaml@2.7.0)
     transitivePeerDependencies:
       - supports-color
 
-  vite-tsconfig-paths@4.3.2(typescript@5.7.3)(vite@5.4.12(@types/node@20.17.9)(terser@5.37.0)):
+  vite-tsconfig-paths@4.3.2(typescript@5.7.3)(vite@5.4.12(@types/node@20.17.9)(terser@5.38.0)):
     dependencies:
       debug: 4.4.0(supports-color@8.1.1)
       globrex: 0.1.2
-      tsconfck: 3.1.4(typescript@5.7.3)
+      tsconfck: 3.1.5(typescript@5.7.3)
     optionalDependencies:
-      vite: 5.4.12(@types/node@20.17.9)(terser@5.37.0)
+      vite: 5.4.12(@types/node@20.17.9)(terser@5.38.0)
     transitivePeerDependencies:
       - supports-color
       - typescript
 
-  vite-tsconfig-paths@5.1.4(typescript@5.6.3)(vite@6.0.11(@types/node@22.13.0)(jiti@2.4.2)(terser@5.37.0)(tsx@4.19.2)(yaml@2.7.0)):
+  vite-tsconfig-paths@5.1.4(typescript@5.6.3)(vite@6.1.0(@types/node@22.13.1)(jiti@2.4.2)(terser@5.38.0)(tsx@4.19.2)(yaml@2.7.0)):
     dependencies:
       debug: 4.4.0(supports-color@8.1.1)
       globrex: 0.1.2
-      tsconfck: 3.1.4(typescript@5.6.3)
+      tsconfck: 3.1.5(typescript@5.6.3)
     optionalDependencies:
-      vite: 6.0.11(@types/node@22.13.0)(jiti@2.4.2)(terser@5.37.0)(tsx@4.19.2)(yaml@2.7.0)
+      vite: 6.1.0(@types/node@22.13.1)(jiti@2.4.2)(terser@5.38.0)(tsx@4.19.2)(yaml@2.7.0)
     transitivePeerDependencies:
       - supports-color
       - typescript
 
-  vite-tsconfig-paths@5.1.4(typescript@5.7.3)(vite@6.0.11(@types/node@20.17.9)(jiti@2.4.2)(terser@5.37.0)(tsx@4.19.2)(yaml@2.7.0)):
+  vite-tsconfig-paths@5.1.4(typescript@5.7.3)(vite@6.1.0(@types/node@20.17.9)(jiti@2.4.2)(terser@5.38.0)(tsx@4.19.2)(yaml@2.7.0)):
     dependencies:
       debug: 4.4.0(supports-color@8.1.1)
       globrex: 0.1.2
-      tsconfck: 3.1.4(typescript@5.7.3)
+      tsconfck: 3.1.5(typescript@5.7.3)
     optionalDependencies:
-      vite: 6.0.11(@types/node@20.17.9)(jiti@2.4.2)(terser@5.37.0)(tsx@4.19.2)(yaml@2.7.0)
+      vite: 6.1.0(@types/node@20.17.9)(jiti@2.4.2)(terser@5.38.0)(tsx@4.19.2)(yaml@2.7.0)
     transitivePeerDependencies:
       - supports-color
       - typescript
 
-  vite@5.4.12(@types/node@18.19.74)(terser@5.37.0):
+  vite@5.4.12(@types/node@18.19.75)(terser@5.38.0):
     dependencies:
       esbuild: 0.21.5
       postcss: 8.5.1
-      rollup: 4.34.1
+      rollup: 4.34.4
     optionalDependencies:
-      '@types/node': 18.19.74
+      '@types/node': 18.19.75
       fsevents: 2.3.3
-      terser: 5.37.0
+      terser: 5.38.0
 
-  vite@5.4.12(@types/node@20.17.9)(terser@5.37.0):
+  vite@5.4.12(@types/node@20.17.9)(terser@5.38.0):
     dependencies:
       esbuild: 0.21.5
       postcss: 8.5.1
-      rollup: 4.34.1
+      rollup: 4.34.4
     optionalDependencies:
       '@types/node': 20.17.9
       fsevents: 2.3.3
-      terser: 5.37.0
+      terser: 5.38.0
 
-  vite@5.4.12(@types/node@22.13.0)(terser@5.37.0):
+  vite@5.4.12(@types/node@22.13.1)(terser@5.38.0):
     dependencies:
       esbuild: 0.21.5
       postcss: 8.5.1
-      rollup: 4.34.1
+      rollup: 4.34.4
     optionalDependencies:
-      '@types/node': 22.13.0
+      '@types/node': 22.13.1
       fsevents: 2.3.3
-      terser: 5.37.0
+      terser: 5.38.0
 
-  vite@5.4.12(@types/node@22.8.4)(terser@5.37.0):
+  vite@5.4.12(@types/node@22.8.4)(terser@5.38.0):
     dependencies:
       esbuild: 0.21.5
       postcss: 8.5.1
-      rollup: 4.34.1
+      rollup: 4.34.4
     optionalDependencies:
       '@types/node': 22.8.4
       fsevents: 2.3.3
-      terser: 5.37.0
+      terser: 5.38.0
 
-  vite@6.0.11(@types/node@20.17.9)(jiti@2.4.2)(terser@5.37.0)(tsx@4.19.2)(yaml@2.7.0):
+  vite@6.1.0(@types/node@20.17.9)(jiti@2.4.2)(terser@5.38.0)(tsx@4.19.2)(yaml@2.7.0):
     dependencies:
       esbuild: 0.24.2
       postcss: 8.5.1
-      rollup: 4.34.1
+      rollup: 4.34.4
     optionalDependencies:
       '@types/node': 20.17.9
       fsevents: 2.3.3
       jiti: 2.4.2
-      terser: 5.37.0
+      terser: 5.38.0
       tsx: 4.19.2
       yaml: 2.7.0
     optional: true
 
-  vite@6.0.11(@types/node@22.13.0)(jiti@2.4.2)(terser@5.37.0)(tsx@4.19.2)(yaml@2.7.0):
+  vite@6.1.0(@types/node@22.13.1)(jiti@2.4.2)(terser@5.38.0)(tsx@4.19.2)(yaml@2.7.0):
     dependencies:
       esbuild: 0.24.2
       postcss: 8.5.1
-      rollup: 4.34.1
+      rollup: 4.34.4
     optionalDependencies:
-      '@types/node': 22.13.0
+      '@types/node': 22.13.1
       fsevents: 2.3.3
       jiti: 2.4.2
-      terser: 5.37.0
+      terser: 5.38.0
       tsx: 4.19.2
       yaml: 2.7.0
 
-  vitest@0.34.6(@vitest/ui@0.34.7)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(playwright@1.48.2)(terser@5.37.0):
+  vitest@0.34.6(@vitest/ui@0.34.7)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(playwright@1.48.2)(terser@5.38.0):
     dependencies:
       '@types/chai': 4.3.20
       '@types/chai-subset': 1.3.5
@@ -67134,8 +67570,8 @@ snapshots:
       strip-literal: 1.3.0
       tinybench: 2.9.0
       tinypool: 0.7.0
-      vite: 5.4.12(@types/node@20.17.9)(terser@5.37.0)
-      vite-node: 0.34.6(@types/node@20.17.9)(terser@5.37.0)
+      vite: 5.4.12(@types/node@20.17.9)(terser@5.38.0)
+      vite-node: 0.34.6(@types/node@20.17.9)(terser@5.38.0)
       why-is-node-running: 2.3.0
     optionalDependencies:
       '@vitest/ui': 0.34.7(vitest@0.34.6)
@@ -67151,7 +67587,7 @@ snapshots:
       - supports-color
       - terser
 
-  vitest@1.1.3(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0):
+  vitest@1.1.3(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0):
     dependencies:
       '@vitest/expect': 1.1.3
       '@vitest/runner': 1.1.3
@@ -67171,11 +67607,11 @@ snapshots:
       strip-literal: 1.3.0
       tinybench: 2.9.0
       tinypool: 0.8.4
-      vite: 5.4.12(@types/node@22.13.0)(terser@5.37.0)
-      vite-node: 1.1.3(@types/node@22.13.0)(terser@5.37.0)
+      vite: 5.4.12(@types/node@22.13.1)(terser@5.38.0)
+      vite-node: 1.1.3(@types/node@22.13.1)(terser@5.38.0)
       why-is-node-running: 2.3.0
     optionalDependencies:
-      '@types/node': 22.13.0
+      '@types/node': 22.13.1
       jsdom: 25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5)
     transitivePeerDependencies:
       - less
@@ -67187,7 +67623,7 @@ snapshots:
       - supports-color
       - terser
 
-  vitest@1.2.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0):
+  vitest@1.2.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0):
     dependencies:
       '@vitest/expect': 1.2.1
       '@vitest/runner': 1.2.1
@@ -67207,11 +67643,11 @@ snapshots:
       strip-literal: 1.3.0
       tinybench: 2.9.0
       tinypool: 0.8.4
-      vite: 5.4.12(@types/node@22.13.0)(terser@5.37.0)
-      vite-node: 1.2.1(@types/node@22.13.0)(terser@5.37.0)
+      vite: 5.4.12(@types/node@22.13.1)(terser@5.38.0)
+      vite-node: 1.2.1(@types/node@22.13.1)(terser@5.38.0)
       why-is-node-running: 2.3.0
     optionalDependencies:
-      '@types/node': 22.13.0
+      '@types/node': 22.13.1
       jsdom: 25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5)
     transitivePeerDependencies:
       - less
@@ -67223,7 +67659,7 @@ snapshots:
       - supports-color
       - terser
 
-  vitest@1.6.1(@types/node@18.19.74)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0):
+  vitest@1.6.1(@types/node@18.19.75)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0):
     dependencies:
       '@vitest/expect': 1.6.1
       '@vitest/runner': 1.6.1
@@ -67242,11 +67678,11 @@ snapshots:
       strip-literal: 2.1.1
       tinybench: 2.9.0
       tinypool: 0.8.4
-      vite: 5.4.12(@types/node@18.19.74)(terser@5.37.0)
-      vite-node: 1.6.1(@types/node@18.19.74)(terser@5.37.0)
+      vite: 5.4.12(@types/node@18.19.75)(terser@5.38.0)
+      vite-node: 1.6.1(@types/node@18.19.75)(terser@5.38.0)
       why-is-node-running: 2.3.0
     optionalDependencies:
-      '@types/node': 18.19.74
+      '@types/node': 18.19.75
       jsdom: 25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5)
     transitivePeerDependencies:
       - less
@@ -67258,7 +67694,7 @@ snapshots:
       - supports-color
       - terser
 
-  vitest@1.6.1(@types/node@20.17.9)(@vitest/ui@0.34.7)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0):
+  vitest@1.6.1(@types/node@20.17.9)(@vitest/ui@0.34.7)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0):
     dependencies:
       '@vitest/expect': 1.6.1
       '@vitest/runner': 1.6.1
@@ -67277,8 +67713,8 @@ snapshots:
       strip-literal: 2.1.1
       tinybench: 2.9.0
       tinypool: 0.8.4
-      vite: 5.4.12(@types/node@20.17.9)(terser@5.37.0)
-      vite-node: 1.6.1(@types/node@20.17.9)(terser@5.37.0)
+      vite: 5.4.12(@types/node@20.17.9)(terser@5.38.0)
+      vite-node: 1.6.1(@types/node@20.17.9)(terser@5.38.0)
       why-is-node-running: 2.3.0
     optionalDependencies:
       '@types/node': 20.17.9
@@ -67294,7 +67730,7 @@ snapshots:
       - supports-color
       - terser
 
-  vitest@1.6.1(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.37.0):
+  vitest@1.6.1(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.38.0):
     dependencies:
       '@vitest/expect': 1.6.1
       '@vitest/runner': 1.6.1
@@ -67313,8 +67749,8 @@ snapshots:
       strip-literal: 2.1.1
       tinybench: 2.9.0
       tinypool: 0.8.4
-      vite: 5.4.12(@types/node@20.17.9)(terser@5.37.0)
-      vite-node: 1.6.1(@types/node@20.17.9)(terser@5.37.0)
+      vite: 5.4.12(@types/node@20.17.9)(terser@5.38.0)
+      vite-node: 1.6.1(@types/node@20.17.9)(terser@5.38.0)
       why-is-node-running: 2.3.0
     optionalDependencies:
       '@types/node': 20.17.9
@@ -67329,7 +67765,7 @@ snapshots:
       - supports-color
       - terser
 
-  vitest@1.6.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.37.0):
+  vitest@1.6.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.38.0):
     dependencies:
       '@vitest/expect': 1.6.1
       '@vitest/runner': 1.6.1
@@ -67348,11 +67784,11 @@ snapshots:
       strip-literal: 2.1.1
       tinybench: 2.9.0
       tinypool: 0.8.4
-      vite: 5.4.12(@types/node@22.13.0)(terser@5.37.0)
-      vite-node: 1.6.1(@types/node@22.13.0)(terser@5.37.0)
+      vite: 5.4.12(@types/node@22.13.1)(terser@5.38.0)
+      vite-node: 1.6.1(@types/node@22.13.1)(terser@5.38.0)
       why-is-node-running: 2.3.0
     optionalDependencies:
-      '@types/node': 22.13.0
+      '@types/node': 22.13.1
       jsdom: 25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10)
     transitivePeerDependencies:
       - less
@@ -67364,7 +67800,7 @@ snapshots:
       - supports-color
       - terser
 
-  vitest@1.6.1(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0):
+  vitest@1.6.1(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0):
     dependencies:
       '@vitest/expect': 1.6.1
       '@vitest/runner': 1.6.1
@@ -67383,11 +67819,11 @@ snapshots:
       strip-literal: 2.1.1
       tinybench: 2.9.0
       tinypool: 0.8.4
-      vite: 5.4.12(@types/node@22.13.0)(terser@5.37.0)
-      vite-node: 1.6.1(@types/node@22.13.0)(terser@5.37.0)
+      vite: 5.4.12(@types/node@22.13.1)(terser@5.38.0)
+      vite-node: 1.6.1(@types/node@22.13.1)(terser@5.38.0)
       why-is-node-running: 2.3.0
     optionalDependencies:
-      '@types/node': 22.13.0
+      '@types/node': 22.13.1
       jsdom: 25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5)
     transitivePeerDependencies:
       - less
@@ -67399,10 +67835,10 @@ snapshots:
       - supports-color
       - terser
 
-  vitest@2.1.4(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.37.0):
+  vitest@2.1.4(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.38.0):
     dependencies:
       '@vitest/expect': 2.1.4
-      '@vitest/mocker': 2.1.4(vite@5.4.12(@types/node@22.13.0)(terser@5.37.0))
+      '@vitest/mocker': 2.1.4(vite@5.4.12(@types/node@22.13.1)(terser@5.38.0))
       '@vitest/pretty-format': 2.1.9
       '@vitest/runner': 2.1.4
       '@vitest/snapshot': 2.1.4
@@ -67418,8 +67854,8 @@ snapshots:
       tinyexec: 0.3.2
       tinypool: 1.0.2
       tinyrainbow: 1.2.0
-      vite: 5.4.12(@types/node@20.17.9)(terser@5.37.0)
-      vite-node: 2.1.4(@types/node@20.17.9)(terser@5.37.0)
+      vite: 5.4.12(@types/node@20.17.9)(terser@5.38.0)
+      vite-node: 2.1.4(@types/node@20.17.9)(terser@5.38.0)
       why-is-node-running: 2.3.0
     optionalDependencies:
       '@types/node': 20.17.9
@@ -67435,10 +67871,10 @@ snapshots:
       - supports-color
       - terser
 
-  vitest@2.1.4(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0):
+  vitest@2.1.4(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0):
     dependencies:
       '@vitest/expect': 2.1.4
-      '@vitest/mocker': 2.1.4(vite@5.4.12(@types/node@22.13.0)(terser@5.37.0))
+      '@vitest/mocker': 2.1.4(vite@5.4.12(@types/node@22.13.1)(terser@5.38.0))
       '@vitest/pretty-format': 2.1.9
       '@vitest/runner': 2.1.4
       '@vitest/snapshot': 2.1.4
@@ -67454,8 +67890,8 @@ snapshots:
       tinyexec: 0.3.2
       tinypool: 1.0.2
       tinyrainbow: 1.2.0
-      vite: 5.4.12(@types/node@20.17.9)(terser@5.37.0)
-      vite-node: 2.1.4(@types/node@20.17.9)(terser@5.37.0)
+      vite: 5.4.12(@types/node@20.17.9)(terser@5.38.0)
+      vite-node: 2.1.4(@types/node@20.17.9)(terser@5.38.0)
       why-is-node-running: 2.3.0
     optionalDependencies:
       '@types/node': 20.17.9
@@ -67471,10 +67907,10 @@ snapshots:
       - supports-color
       - terser
 
-  vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.37.0):
+  vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.38.0):
     dependencies:
       '@vitest/expect': 2.1.4
-      '@vitest/mocker': 2.1.4(vite@5.4.12(@types/node@22.13.0)(terser@5.37.0))
+      '@vitest/mocker': 2.1.4(vite@5.4.12(@types/node@22.13.1)(terser@5.38.0))
       '@vitest/pretty-format': 2.1.9
       '@vitest/runner': 2.1.4
       '@vitest/snapshot': 2.1.4
@@ -67490,11 +67926,11 @@ snapshots:
       tinyexec: 0.3.2
       tinypool: 1.0.2
       tinyrainbow: 1.2.0
-      vite: 5.4.12(@types/node@22.13.0)(terser@5.37.0)
-      vite-node: 2.1.4(@types/node@22.13.0)(terser@5.37.0)
+      vite: 5.4.12(@types/node@22.13.1)(terser@5.38.0)
+      vite-node: 2.1.4(@types/node@22.13.1)(terser@5.38.0)
       why-is-node-running: 2.3.0
     optionalDependencies:
-      '@types/node': 22.13.0
+      '@types/node': 22.13.1
       jsdom: 25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10)
     transitivePeerDependencies:
       - less
@@ -67507,10 +67943,10 @@ snapshots:
       - supports-color
       - terser
 
-  vitest@2.1.4(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0):
+  vitest@2.1.4(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0):
     dependencies:
       '@vitest/expect': 2.1.4
-      '@vitest/mocker': 2.1.4(vite@5.4.12(@types/node@22.13.0)(terser@5.37.0))
+      '@vitest/mocker': 2.1.4(vite@5.4.12(@types/node@22.13.1)(terser@5.38.0))
       '@vitest/pretty-format': 2.1.9
       '@vitest/runner': 2.1.4
       '@vitest/snapshot': 2.1.4
@@ -67526,11 +67962,11 @@ snapshots:
       tinyexec: 0.3.2
       tinypool: 1.0.2
       tinyrainbow: 1.2.0
-      vite: 5.4.12(@types/node@22.13.0)(terser@5.37.0)
-      vite-node: 2.1.4(@types/node@22.13.0)(terser@5.37.0)
+      vite: 5.4.12(@types/node@22.13.1)(terser@5.38.0)
+      vite-node: 2.1.4(@types/node@22.13.1)(terser@5.38.0)
       why-is-node-running: 2.3.0
     optionalDependencies:
-      '@types/node': 22.13.0
+      '@types/node': 22.13.1
       jsdom: 25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5)
     transitivePeerDependencies:
       - less
@@ -67543,10 +67979,10 @@ snapshots:
       - supports-color
       - terser
 
-  vitest@2.1.5(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0):
+  vitest@2.1.5(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0):
     dependencies:
       '@vitest/expect': 2.1.5
-      '@vitest/mocker': 2.1.5(vite@5.4.12(@types/node@22.13.0)(terser@5.37.0))
+      '@vitest/mocker': 2.1.5(vite@5.4.12(@types/node@22.13.1)(terser@5.38.0))
       '@vitest/pretty-format': 2.1.9
       '@vitest/runner': 2.1.5
       '@vitest/snapshot': 2.1.5
@@ -67562,11 +67998,11 @@ snapshots:
       tinyexec: 0.3.2
       tinypool: 1.0.2
       tinyrainbow: 1.2.0
-      vite: 5.4.12(@types/node@22.13.0)(terser@5.37.0)
-      vite-node: 2.1.5(@types/node@22.13.0)(terser@5.37.0)
+      vite: 5.4.12(@types/node@22.13.1)(terser@5.38.0)
+      vite-node: 2.1.5(@types/node@22.13.1)(terser@5.38.0)
       why-is-node-running: 2.3.0
     optionalDependencies:
-      '@types/node': 22.13.0
+      '@types/node': 22.13.1
       jsdom: 25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5)
     transitivePeerDependencies:
       - less
@@ -67579,10 +68015,10 @@ snapshots:
       - supports-color
       - terser
 
-  vitest@2.1.8(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0):
+  vitest@2.1.8(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0):
     dependencies:
       '@vitest/expect': 2.1.8
-      '@vitest/mocker': 2.1.8(vite@5.4.12(@types/node@22.13.0)(terser@5.37.0))
+      '@vitest/mocker': 2.1.8(vite@5.4.12(@types/node@22.13.1)(terser@5.38.0))
       '@vitest/pretty-format': 2.1.9
       '@vitest/runner': 2.1.8
       '@vitest/snapshot': 2.1.8
@@ -67598,8 +68034,8 @@ snapshots:
       tinyexec: 0.3.2
       tinypool: 1.0.2
       tinyrainbow: 1.2.0
-      vite: 5.4.12(@types/node@20.17.9)(terser@5.37.0)
-      vite-node: 2.1.8(@types/node@20.17.9)(terser@5.37.0)
+      vite: 5.4.12(@types/node@20.17.9)(terser@5.38.0)
+      vite-node: 2.1.8(@types/node@20.17.9)(terser@5.38.0)
       why-is-node-running: 2.3.0
     optionalDependencies:
       '@types/node': 20.17.9
@@ -67615,10 +68051,10 @@ snapshots:
       - supports-color
       - terser
 
-  vitest@2.1.8(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.37.0):
+  vitest@2.1.8(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.38.0):
     dependencies:
       '@vitest/expect': 2.1.8
-      '@vitest/mocker': 2.1.8(vite@5.4.12(@types/node@22.13.0)(terser@5.37.0))
+      '@vitest/mocker': 2.1.8(vite@5.4.12(@types/node@22.13.1)(terser@5.38.0))
       '@vitest/pretty-format': 2.1.9
       '@vitest/runner': 2.1.8
       '@vitest/snapshot': 2.1.8
@@ -67634,11 +68070,11 @@ snapshots:
       tinyexec: 0.3.2
       tinypool: 1.0.2
       tinyrainbow: 1.2.0
-      vite: 5.4.12(@types/node@22.13.0)(terser@5.37.0)
-      vite-node: 2.1.8(@types/node@22.13.0)(terser@5.37.0)
+      vite: 5.4.12(@types/node@22.13.1)(terser@5.38.0)
+      vite-node: 2.1.8(@types/node@22.13.1)(terser@5.38.0)
       why-is-node-running: 2.3.0
     optionalDependencies:
-      '@types/node': 22.13.0
+      '@types/node': 22.13.1
       jsdom: 25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10)
     transitivePeerDependencies:
       - less
@@ -67651,10 +68087,10 @@ snapshots:
       - supports-color
       - terser
 
-  vitest@2.1.8(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0):
+  vitest@2.1.8(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0):
     dependencies:
       '@vitest/expect': 2.1.8
-      '@vitest/mocker': 2.1.8(vite@5.4.12(@types/node@22.13.0)(terser@5.37.0))
+      '@vitest/mocker': 2.1.8(vite@5.4.12(@types/node@22.13.1)(terser@5.38.0))
       '@vitest/pretty-format': 2.1.9
       '@vitest/runner': 2.1.8
       '@vitest/snapshot': 2.1.8
@@ -67670,11 +68106,11 @@ snapshots:
       tinyexec: 0.3.2
       tinypool: 1.0.2
       tinyrainbow: 1.2.0
-      vite: 5.4.12(@types/node@22.13.0)(terser@5.37.0)
-      vite-node: 2.1.8(@types/node@22.13.0)(terser@5.37.0)
+      vite: 5.4.12(@types/node@22.13.1)(terser@5.38.0)
+      vite-node: 2.1.8(@types/node@22.13.1)(terser@5.38.0)
       why-is-node-running: 2.3.0
     optionalDependencies:
-      '@types/node': 22.13.0
+      '@types/node': 22.13.1
       jsdom: 25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5)
     transitivePeerDependencies:
       - less
@@ -67687,10 +68123,10 @@ snapshots:
       - supports-color
       - terser
 
-  vitest@3.0.2(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0):
+  vitest@3.0.2(@types/node@20.17.9)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0):
     dependencies:
       '@vitest/expect': 3.0.2
-      '@vitest/mocker': 3.0.2(vite@5.4.12(@types/node@20.17.9)(terser@5.37.0))
+      '@vitest/mocker': 3.0.2(vite@5.4.12(@types/node@20.17.9)(terser@5.38.0))
       '@vitest/pretty-format': 3.0.5
       '@vitest/runner': 3.0.2
       '@vitest/snapshot': 3.0.2
@@ -67706,8 +68142,8 @@ snapshots:
       tinyexec: 0.3.2
       tinypool: 1.0.2
       tinyrainbow: 2.0.0
-      vite: 5.4.12(@types/node@20.17.9)(terser@5.37.0)
-      vite-node: 3.0.2(@types/node@20.17.9)(terser@5.37.0)
+      vite: 5.4.12(@types/node@20.17.9)(terser@5.38.0)
+      vite-node: 3.0.2(@types/node@20.17.9)(terser@5.38.0)
       why-is-node-running: 2.3.0
     optionalDependencies:
       '@types/node': 20.17.9
@@ -67723,10 +68159,10 @@ snapshots:
       - supports-color
       - terser
 
-  vitest@3.0.2(@types/node@22.13.0)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.37.0):
+  vitest@3.0.2(@types/node@22.13.1)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5))(terser@5.38.0):
     dependencies:
       '@vitest/expect': 3.0.2
-      '@vitest/mocker': 3.0.2(vite@5.4.12(@types/node@22.13.0)(terser@5.37.0))
+      '@vitest/mocker': 3.0.2(vite@5.4.12(@types/node@22.13.1)(terser@5.38.0))
       '@vitest/pretty-format': 3.0.5
       '@vitest/runner': 3.0.2
       '@vitest/snapshot': 3.0.2
@@ -67742,11 +68178,11 @@ snapshots:
       tinyexec: 0.3.2
       tinypool: 1.0.2
       tinyrainbow: 2.0.0
-      vite: 5.4.12(@types/node@22.13.0)(terser@5.37.0)
-      vite-node: 3.0.2(@types/node@22.13.0)(terser@5.37.0)
+      vite: 5.4.12(@types/node@22.13.1)(terser@5.38.0)
+      vite-node: 3.0.2(@types/node@22.13.1)(terser@5.38.0)
       why-is-node-running: 2.3.0
     optionalDependencies:
-      '@types/node': 22.13.0
+      '@types/node': 22.13.1
       jsdom: 25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@6.0.5)
     transitivePeerDependencies:
       - less
@@ -67759,10 +68195,10 @@ snapshots:
       - supports-color
       - terser
 
-  vitest@3.0.2(@types/node@22.8.4)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.37.0):
+  vitest@3.0.2(@types/node@22.8.4)(jsdom@25.0.1(bufferutil@4.0.9)(canvas@2.11.2(encoding@0.1.13))(utf-8-validate@5.0.10))(terser@5.38.0):
     dependencies:
       '@vitest/expect': 3.0.2
-      '@vitest/mocker': 3.0.2(vite@5.4.12(@types/node@22.13.0)(terser@5.37.0))
+      '@vitest/mocker': 3.0.2(vite@5.4.12(@types/node@22.13.1)(terser@5.38.0))
       '@vitest/pretty-format': 3.0.5
       '@vitest/runner': 3.0.2
       '@vitest/snapshot': 3.0.2
@@ -67778,8 +68214,8 @@ snapshots:
       tinyexec: 0.3.2
       tinypool: 1.0.2
       tinyrainbow: 2.0.0
-      vite: 5.4.12(@types/node@22.8.4)(terser@5.37.0)
-      vite-node: 3.0.2(@types/node@22.8.4)(terser@5.37.0)
+      vite: 5.4.12(@types/node@22.8.4)(terser@5.38.0)
+      vite-node: 3.0.2(@types/node@22.8.4)(terser@5.38.0)
       why-is-node-running: 2.3.0
     optionalDependencies:
       '@types/node': 22.8.4
@@ -68446,7 +68882,7 @@ snapshots:
       acorn: 8.14.0
       browserslist: 4.24.4
       chrome-trace-event: 1.0.4
-      enhanced-resolve: 5.18.0
+      enhanced-resolve: 5.18.1
       es-module-lexer: 1.6.0
       eslint-scope: 5.1.1
       events: 3.3.0
@@ -68543,7 +68979,7 @@ snapshots:
   which-boxed-primitive@1.1.1:
     dependencies:
       is-bigint: 1.1.0
-      is-boolean-object: 1.2.1
+      is-boolean-object: 1.2.2
       is-number-object: 1.1.1
       is-string: 1.1.1
       is-symbol: 1.1.1
@@ -68558,7 +68994,7 @@ snapshots:
       is-finalizationregistry: 1.1.1
       is-generator-function: 1.1.0
       is-regex: 1.2.1
-      is-weakref: 1.1.0
+      is-weakref: 1.1.1
       isarray: 2.0.5
       which-boxed-primitive: 1.1.1
       which-collection: 1.0.2
