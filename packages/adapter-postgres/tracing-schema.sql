-- Drop tables if they already exist (drop events first since it depends on traces)
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS traces;

-- Create the traces table
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
    raw_context TEXT NOT NULL DEFAULT '',
    raw_response TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (trace_id, span_id)
);

-- Create indexes for traces table
CREATE INDEX idx_traces_trace_id ON traces (trace_id);
CREATE INDEX idx_traces_span_name ON traces (span_name);
CREATE INDEX idx_traces_start_time ON traces (start_time);
CREATE INDEX idx_traces_room ON traces (room_id);

-- Remove old constraints and modify column definitions
ALTER TABLE traces 
ALTER COLUMN raw_context DROP NOT NULL,
ALTER COLUMN raw_context DROP DEFAULT,
ALTER COLUMN raw_response DROP NOT NULL,
ALTER COLUMN raw_response DROP DEFAULT;

-- Update constraints to handle nulls properly
-- Previous constraints are dropped
ALTER TABLE traces
DROP CONSTRAINT IF EXISTS valid_raw_context;

ALTER TABLE traces
DROP CONSTRAINT IF EXISTS valid_raw_response;

-- New constraints allow empty strings
ALTER TABLE traces
ADD CONSTRAINT valid_raw_context
CHECK (
    (span_name IN ('llm_context_pre', 'llm_context_loaded') AND raw_context <> '') 
    OR (span_name NOT IN ('llm_context_pre', 'llm_context_loaded'))
);

ALTER TABLE traces
ADD CONSTRAINT valid_raw_response
CHECK (
    (span_name = 'llm_response_post' AND raw_response <> '')
    OR (span_name <> 'llm_response_post')
);