// Create a connection pool for local testing using your provided credentials.

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
      room_id
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15,
      $16, $17, $18, $19
    )
    ON CONFLICT (trace_id, span_id) DO NOTHING;
  `;

  const values = [
    spanData.trace_id,
    spanData.span_id,
    spanData.parent_span_id,
    spanData.trace_state,
    spanData.span_name,
    spanData.span_kind,
    spanData.start_time,
    spanData.end_time,
    spanData.duration_ms,
    spanData.status_code,
    spanData.status_message,
    spanData.attributes,
    spanData.events,
    spanData.links,
    spanData.resource,
    spanData.agent_id,
    null, 
    spanData.environment,
    spanData.room_id,
  ];

  try {
    await pool.query(query, values);
  } catch (error) {
    console.error('Error inserting span into DB', error);
  }
}

export class DBSpanProcessor implements SpanProcessor {
  onStart(span: ReadableSpan): void {
    console.log('Span started:', span.name);
  }

  async onEnd(span: ReadableSpan): Promise<void> {
    const spanContext = span.spanContext();
    console.log('DBSpanProcessor received span:', {
      name: span.name,
      attributes: span.attributes,
      roomId: span.attributes.roomId
    });

    // Convert [seconds, nanoseconds] to milliseconds.
    const startTimeMs = span.startTime[0] * 1000 + span.startTime[1] / 1e6;
    const endTimeMs = span.endTime[0] * 1000 + span.endTime[1] / 1e6;
    const durationMs = Math.floor(endTimeMs - startTimeMs);

    const spanData = {
      trace_id: spanContext.traceId,
      span_id: spanContext.spanId,
      parent_span_id: span.parentSpanId || null,
      tarce_state: spanContext.traceState || null,
      span_name: span.name,
      span_kind: span.kind,
      start_time: new Date(startTimeMs).toISOString(),
      end_time: new Date(endTimeMs).toISOString(),
      duration_ms: durationMs,
      status_code: span.status.code,
      status_message: span.status.message,
      attributes: JSON.stringify(span.attributes),
      events: JSON.stringify(span.events || []),
      links: JSON.stringify(span.links || []),
      resource: JSON.stringify(span.resource?.attributes || {}),
      agent_id: span.attributes.agentId,
      environment: span.attributes.environment || null,
      room_id: span.attributes.roomId || null,
    };

    console.log('SpanData being inserted:', {
      name: spanData.span_name,
      roomId: spanData.room_id
    });

    try {
      await insertTrace(spanData);
      console.log('Span inserted successfully:', {
        name: span.name,
        roomId: spanData.room_id
      });
    } catch (error) {
      console.error('Error inserting span into DB:', error);
    }
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
} 