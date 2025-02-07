import { trace, Span, SpanStatusCode } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { DBSpanProcessor } from './dbSpanProcessor';

export interface InstrumentationEvent {
  stage: string;
  subStage: string;
  event: string;
  data: Record<string, any>;
  timestamp?: number;
}

export class Instrumentation {
  private static instance: Instrumentation;
  private tracer: ReturnType<typeof trace.getTracer>;

  private constructor() {
    // Set up the tracer provider with a resource attribute for service name.
    const provider = new NodeTracerProvider({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'eliza-agent',
      }),
    });

    // Batch process and export spans via OTLP
    (provider as any).addSpanProcessor(
      new BatchSpanProcessor(
        new OTLPTraceExporter({
          url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
        })
      )
    );
    // Register our custom DB span processor so that span data is inserted into our local DB.
    (provider as any).addSpanProcessor(new DBSpanProcessor());

    provider.register();
    this.tracer = trace.getTracer('eliza-agent');
  }

  public static getInstance(): Instrumentation {
    if (!Instrumentation.instance) {
      Instrumentation.instance = new Instrumentation();
    }
    return Instrumentation.instance;
  }

  /**
   * Log a tracing event. This method creates a new span, adds the event attributes,
   * outputs the event as a JSON string to console, and ends the span.
   */
  public logEvent(event: InstrumentationEvent): void {
    console.log('Logging event:', {
      event: event.event,
      roomId: event.data.roomId,
      data: event.data
    });

    const span = this.tracer.startSpan(event.event, {
      attributes: {
        'agent.stage': event.stage,
        'agent.sub_stage': event.subStage,
        ...event.data,
        'event.timestamp': event.timestamp || Date.now(),
        'roomId': event.data.roomId,
      },
    });

    try {
      console.log('Span attributes:', span.setAttributes);
      span.setStatus({ code: SpanStatusCode.OK });
    } finally {
      span.end();
    }
  }

  // Concise helper methods for common instrumentation events:

  public sessionStart = (data: Record<string, any>): void =>
    this.logEvent({
      stage: 'Initialization',
      subStage: 'Runtime Boot',
      event: 'session_start',
      data,
    });

  public contextLoaded = (data: Record<string, any>): void =>
    this.logEvent({
      stage: 'Observe',
      subStage: 'Context Hydration',
      event: 'context_loaded',
      data,
    });

  public messageReceived = (data: Record<string, any>): void =>
    this.logEvent({
      stage: 'Observe',
      subStage: 'Input Reception',
      event: 'message_received',
      data: {
        message_snippet: data.messageSnippet,
        input_source: data.inputSource,
        message_type: data.messageType,
        agent_id: data.agentId,
        roomId: data.roomId,
      },
    });

  public modelSelected = (data: Record<string, any>): void =>
    this.logEvent({
      stage: 'Orient',
      subStage: 'Model Preparation',
      event: 'model_selected',
      data: {
        ...data,
        roomId: data.roomId,
      },
    });

  public generationStarted = (data: Record<string, any>): void =>
    this.logEvent({
      stage: 'Decide',
      subStage: 'Response Generation',
      event: 'generation_started',
      data: {
        ...data,
        roomId: data.roomId,
      },
    });

  public actionTriggered = (data: Record<string, any>): void =>
    this.logEvent({
      stage: 'Act',
      subStage: 'Action Execution',
      event: 'action_triggered',
      data: {
        ...data,
        roomId: data.roomId,
      },
    });

  public memoryPersisted = (data: Record<string, any>): void =>
    this.logEvent({
      stage: 'Learn',
      subStage: 'Memory Formation',
      event: 'memory_persisted',
      data: {
        ...data,
        roomId: data.roomId,
      },
    });
}

// Export the singleton instance
export const instrument = Instrumentation.getInstance();
