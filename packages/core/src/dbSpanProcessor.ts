import pkg from 'pg';
const { Pool } = pkg;
import type { Span } from '@opentelemetry/api';
import { SpanProcessor, ReadableSpan } from '@opentelemetry/sdk-trace-base';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_DATABASE || 'tracing_database',
  user: process.env.DB_USER || 'trace_user',
  password: process.env.DB_PASSWORD || 'trace_password',
});

// Inserts a span record into the local PostgreSQL database.
async function insertTrace(spanData: any): Promise<void> {
  const query = `
    INSERT INTO traces (
      trace_id,
      span_id,
      parent_span_id,
      trace_state,
      span_name,
      span_kind,
      start_time,
      end_time,
      duration_ms,
      status_code,
      status_message,
      attributes,
      events,
      links,
      resource,
      agent_id,
      session_id,
      environment,
      room_id,
      raw_context,
      raw_response
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15,
      $16, $17, $18, $19, $20, $21
    )
    ON CONFLICT (trace_id, span_id) DO NOTHING;
  `;

  const values = [
    spanData.trace_id,
    spanData.span_id,
    spanData.parent_span_id,
    spanData.trace_state || null,
    spanData.span_name,
    spanData.span_kind,
    spanData.start_time,
    spanData.end_time,
    spanData.duration_ms,
    spanData.status_code,
    spanData.status_message,
    JSON.stringify(spanData.attributes) || '{}',
    JSON.stringify(spanData.events) || '[]',
    JSON.stringify(spanData.links) || '[]',
    JSON.stringify(spanData.resource) || '{}',
    spanData.agent_id || null,
    spanData.session_id || null,
    spanData.environment || null,
    spanData.room_id || null,
    spanData.raw_context || '',
    spanData.raw_response || '',
  ];

  try {
    await pool.query(query, values);
    console.log('✅ Span inserted successfully:', spanData.span_name);
  } catch (error) {
    console.error('❌ Error inserting span into DB', error);
  }
}

export class DBSpanProcessor implements SpanProcessor {
  onStart(span: ReadableSpan): void {
    console.log('🟢 Span started:', span.name);

    const spanContext = span.spanContext();
    console.log('Span Context:', spanContext);
    console.log('Span Whole:', span);
  }

  async onEnd(span: ReadableSpan): Promise<void> {
    if (!['llm_context_pre', 'llm_response_post'].includes(span.name)) {
      return; // Skip non-LLM spans
    }

    const spanContext = span.spanContext();
    console.log('Span Context:', spanContext);
    console.log('Span Whole:', span);
    // Convert [seconds, nanoseconds] to milliseconds.
    const startTimeMs = span.startTime[0] * 1000 + span.startTime[1] / 1e6;
    const endTimeMs = span.endTime[0] * 1000 + span.endTime[1] / 1e6;
    const durationMs = Math.floor(endTimeMs - startTimeMs);

    // Extract fields from attributes
    const attributes = span.attributes || {};
    const resource = span.resource?.attributes || {};

    // Add truncation here
    const MAX_CONTEXT_LENGTH = 4000;
    const safeTrim = (value: unknown) => {
      if (typeof value !== 'string') return '';
      return value.trim().substring(0, MAX_CONTEXT_LENGTH);
    };

    const spanData = {
      trace_id: spanContext.traceId,
      span_id: spanContext.spanId,
      parent_span_id: span.parentSpanId || null,
      span_name: span.name,
      span_kind: span.kind,
      start_time: new Date(startTimeMs).toISOString(),
      end_time: new Date(endTimeMs).toISOString(),
      duration_ms: durationMs,
      status_code: span.status.code,
      status_message: span.status.message || null,
      attributes: attributes,
      events: span.events || [],
      links: span.links || [],
      resource: resource,
      agent_id: safeTrim(attributes.agentId),
      session_id: safeTrim(attributes['session.id']),
      environment:
        safeTrim(attributes['environment']) ||
        safeTrim(resource['deployment.environment']) ||
        'unknown',
      room_id: safeTrim(attributes['room.id']),
      raw_context: safeTrim(attributes.raw_context) || '',
      raw_response: safeTrim(attributes.raw_response) || '',
    };

    // Modify the validation check to allow spans with raw_context/response
    if (
      !spanData.agent_id && 
      !spanData.session_id && 
      !spanData.room_id
    ) {
      console.log('⚠️ Skipping span...');
      return;
    }

    console.log('🟡 Span ended, inserting:', span.name, spanData);

    console.log('Span attributes:', JSON.stringify(attributes, null, 2));

    try {
      await insertTrace(spanData);
    } catch (error) {
      console.error('❌ Error inserting span into DB', error);
    }
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
}
