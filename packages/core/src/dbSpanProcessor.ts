// Create a connection pool for local testing using your provided credentials.
import { Pool } from 'pg';
import { Span, SpanProcessor } from '@opentelemetry/sdk-trace-base';

const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'tracing_database',
  user: 'trace_user',
  password: 'trace_password',
});

// Inserts a span record into the local PostgreSQL database.
async function insertTrace(spanData: any): Promise<void> {
  const query = `
    INSERT INTO traces (
      trace_id, span_id, parent_span_id,
      span_name, span_kind, start_time, end_time,
      duration_ms, status_code, status_message, attributes,
      events, resource
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (trace_id, span_id) DO NOTHING;
  `;

  const values = [
    spanData.trace_id,
    spanData.span_id,
    spanData.parent_span_id,
    spanData.span_name,
    spanData.span_kind,
    spanData.start_time,
    spanData.end_time,
    spanData.duration_ms,
    spanData.status_code,
    spanData.status_message,
    spanData.attributes,
    spanData.events,
    spanData.resource,
  ];

  try {
    await pool.query(query, values);
  } catch (error) {
    console.error('Error inserting span into DB', error);
  }
}

export class DBSpanProcessor implements SpanProcessor {
  onStart(span: Span): void {
    // No action needed at span start
  }

  async onEnd(span: Span): Promise<void> {
    const spanContext = span.spanContext();

    // Convert [seconds, nanoseconds] to milliseconds.
    const startTimeMs = span.startTime[0] * 1000 + span.startTime[1] / 1e6;
    const endTimeMs = span.endTime[0] * 1000 + span.endTime[1] / 1e6;
    const durationMs = Math.floor(endTimeMs - startTimeMs);

    const spanData = {
      trace_id: spanContext.traceId,
      span_id: spanContext.spanId,
      parent_span_id: span.parentSpanId || null,
      span_name: span.name,
      // Note: Convert the enum value to a string if needed for your DB schema.
      span_kind: span.kind,
      start_time: new Date(startTimeMs).toISOString(),
      end_time: new Date(endTimeMs).toISOString(),
      duration_ms: durationMs,
      status_code: span.status.code,
      status_message: span.status.message,
      // Save attributes and events as JSON strings.
      attributes: JSON.stringify(span.attributes),
      events: JSON.stringify(span.events || []),
      // If you have resource attributes you want to save:
      resource: JSON.stringify(span.resource?.attributes || {}),
    };

    try {
      await insertTrace(spanData);
    } catch (error) {
      console.error('Error inserting span into DB', error);
    }
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
} 