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
    const { sessionId, agentId, roomId } = event.data;
    const hasRequiredIds = sessionId || agentId || roomId;
    
    if (!hasRequiredIds) {
      console.warn('⚠️ Skipping event without context IDs:', event.event);
      return;
    }

    const span = this.tracer.startSpan(event.event, {
      attributes: {
        // Core identifiers (only include if present)
        ...(sessionId && { 'session.id': sessionId }),
        ...(agentId && { 'agent.id': agentId }),
        ...(roomId && { 'room.id': roomId }),
        
        // Event metadata
        'event.stage': event.stage,
        'event.sub_stage': event.subStage,
        'event.timestamp': event.timestamp || Date.now(),
        
        // Environment info
        'environment': process.env.NODE_ENV || 'development',
        
        // Additional context
        ...event.data
      },
    });

    try {
      console.log(JSON.stringify(event));
      span.setStatus({ code: SpanStatusCode.OK });
    } finally {
      span.end();
    }
  }

  // Concise helper methods for common instrumentation events:

  public sessionStart = (data: { 
    sessionId: string; 
    agentId: string; 
    roomId: string; 
    characterName: string; 
    environment: string; 
    platform: string; 
  }) =>
    this.logEvent({
      stage: 'Initialization',
      subStage: 'Runtime Boot',
      event: 'session_start',
      data: {
        sessionId: data.sessionId,
        agentId: data.agentId,
        roomId: data.roomId,
        characterName: data.characterName,
        environment: data.environment,
        platform: data.platform,
      },
    });

  public contextLoaded = (data: Record<string, any>): void =>
    this.logEvent({
      stage: 'Observe',
      subStage: 'Context Hydration',
      event: 'context_loaded',
      data,
    });

  public messageReceived = (data: { 
    message: string; 
    sessionId: string; 
    agentId: string; 
    roomId: string 
  }) =>
    this.logEvent({
      stage: 'Observe',
      subStage: 'Input Reception',
      event: 'message_received',
      data: {
        message: data.message,
        sessionId: data.sessionId,
        agentId: data.agentId,
        roomId: data.roomId,
        timestamp: Date.now()
      },
    });

  public modelSelected = (data: Record<string, any>): void =>
    this.logEvent({
      stage: 'Orient',
      subStage: 'Model Preparation',
      event: 'model_selected',
      data,
    });

  public generationStarted = (data: Record<string, any>): void =>
    this.logEvent({
      stage: 'Decide',
      subStage: 'Response Generation',
      event: 'generation_started',
      data,
    });

  public actionTriggered = (data: Record<string, any>): void =>
    this.logEvent({
      stage: 'Act',
      subStage: 'Action Execution',
      event: 'action_triggered',
      data,
    });

  public memoryPersisted = (data: Record<string, any>): void =>
    this.logEvent({
      stage: 'Learn',
      subStage: 'Memory Formation',
      event: 'memory_persisted',
      data,
    });

  public agentCreated = (data: { agentId: string; sessionId: string; model: string }) =>
    this.logEvent({
      stage: 'Agent',
      subStage: 'Creation',
      event: 'agent_created',
      data: {
        agentId: data.agentId,
        sessionId: data.sessionId,
        model: data.model,
        timestamp: Date.now()
      },
    });

  public roomCreated = (data: { roomId: string; purpose: string; creatorId: string }) =>
    this.logEvent({
      stage: 'Environment',
      subStage: 'Room Setup',
      event: 'room_created',
      data: {
        roomId: data.roomId,
        creatorId: data.creatorId,
        purpose: data.purpose,
        timestamp: Date.now()
      },
    });

  public evaluationStarted = (data: { 
    sessionId: string; 
    agentId: string; 
    roomId: string;
    messageId: string;
  }) =>
    this.logEvent({
      stage: 'Evaluate',
      subStage: 'Start',
      event: 'evaluation_started',
      data: {
        sessionId: data.sessionId,
        agentId: data.agentId,
        roomId: data.roomId,
        messageId: data.messageId,
        timestamp: Date.now()
      },
    });

  public evaluationCompleted = (data: { 
    sessionId: string; 
    agentId: string; 
    roomId: string;
    messageId: string;
    evaluators: number;
  }) =>
    this.logEvent({
      stage: 'Evaluate',
      subStage: 'Complete',
      event: 'evaluation_completed',
      data: {
        sessionId: data.sessionId,
        agentId: data.agentId,
        roomId: data.roomId,
        messageId: data.messageId,
        evaluatorCount: data.evaluators,
        timestamp: Date.now()
      },
    });

  public messageProcessed = (data: {
    messageId: string;
    sessionId: string;
    agentId: string;
    processingTime: number;
  }) =>
    this.logEvent({
      stage: 'Process',
      subStage: 'Complete',
      event: 'message_processed',
      data: {
        messageId: data.messageId,
        sessionId: data.sessionId,
        agentId: data.agentId,
        processingTime: data.processingTime,
        timestamp: Date.now()
      },
    });

  public messageError = (data: {
    messageId: string;
    error: string;
    sessionId: string;
    actionName?: string;
  }) =>
    this.logEvent({
      stage: 'Error',
      subStage: 'Message',
      event: 'message_error',
      data: {
        messageId: data.messageId,
        sessionId: data.sessionId,
        error: data.error,
        ...(data.actionName && { actionName: data.actionName }),
        timestamp: Date.now()
      },
    });

  // Add new event types
  public actionUnresolved = (data: {
    messageId: string;
    actionAttempted: string;
    sessionId: string;
  }) => this.logEvent({
    stage: 'Error',
    subStage: 'Action',
    event: 'action_unresolved',
    data: {
      messageId: data.messageId,
      actionAttempted: data.actionAttempted,
      sessionId: data.sessionId,
      timestamp: Date.now()
    },
  });
  
  public actionInvalid = (data: {
    actionName: string;
    messageId: string;
    sessionId: string;
  }) => this.logEvent({
    stage: 'Error',
    subStage: 'Action',
    event: 'action_invalid',
    data: {
      actionName: data.actionName,
      messageId: data.messageId,
      sessionId: data.sessionId,
      timestamp: Date.now()
    },
  });

  public messageWarning = (data: {
    messageId: string;
    warning: string;
    sessionId: string;
  }) => this.logEvent({
    stage: 'Warning',
    subStage: 'Message',
    event: 'message_warning',
    data: {
      messageId: data.messageId,
      warning: data.warning,
      sessionId: data.sessionId,
      timestamp: Date.now()
    },
  });
}

// Export the singleton instance
export const instrument = Instrumentation.getInstance();
