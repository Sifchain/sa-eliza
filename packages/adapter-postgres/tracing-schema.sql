-- tracing-schema.sql
CREATE TABLE IF NOT EXISTS traces (
    trace_id VARCHAR(256) NOT NULL,
    span_id VARCHAR(256) NOT NULL,
    parent_span_id VARCHAR(256),
    trace_state VARCHAR(256),
    span_name VARCHAR(256) NOT NULL,
    span_kind VARCHAR(64) NOT NULL, -- e.g., "INTERNAL", "SERVER", "CLIENT"
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    duration_ms INTEGER,
    status_code VARCHAR(64), -- e.g., "OK", "ERROR"
    status_message TEXT,
    attributes JSONB,
    events JSONB,
    links JSONB,
    resource JSONB,
    agent_id VARCHAR(256),
    session_id VARCHAR(256),
    environment VARCHAR(64),
    room_id VARCHAR(256),
    PRIMARY KEY (trace_id, span_id)
);

CREATE INDEX idx_traces_trace_id ON traces (trace_id);
CREATE INDEX idx_traces_span_name ON traces (span_name);
CREATE INDEX idx_traces_start_time ON traces (start_time);
CREATE INDEX idx_traces_room ON traces (room_id);

-- Add events table
CREATE TABLE IF NOT EXISTS events (
    event_id UUID DEFAULT gen_random_uuid(),
    trace_id VARCHAR(256) NOT NULL,
    span_id VARCHAR(256) NOT NULL,
    agent_id VARCHAR(256) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_data JSONB NOT NULL,
    room_id VARCHAR(256) NOT NULL,
    PRIMARY KEY (event_id),
    FOREIGN KEY (trace_id, span_id) REFERENCES traces(trace_id, span_id)
);

-- Add indexes for common event queries
CREATE INDEX idx_events_agent ON events (agent_id);
CREATE INDEX idx_events_type ON events (event_type);
CREATE INDEX idx_events_time ON events (event_time);
CREATE INDEX idx_events_room ON events (room_id);