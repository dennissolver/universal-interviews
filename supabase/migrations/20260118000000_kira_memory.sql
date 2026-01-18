-- ============================================================================
-- KIRA MEMORY EXTENSION
-- Migration: 20260118000000_kira_memory.sql
-- Extends analyst tables with voice conversation support and persistent memory
-- ============================================================================

-- ============================================================================
-- EXTEND ANALYST_SESSIONS FOR VOICE CONVERSATIONS
-- ============================================================================

-- Add ElevenLabs conversation tracking
ALTER TABLE analyst_sessions
ADD COLUMN IF NOT EXISTS elevenlabs_conversation_id TEXT,
ADD COLUMN IF NOT EXISTS session_type TEXT DEFAULT 'text' CHECK (session_type IN ('text', 'voice')),
ADD COLUMN IF NOT EXISTS call_duration_seconds INTEGER,
ADD COLUMN IF NOT EXISTS transcript_text TEXT;

-- Index for looking up by ElevenLabs conversation
CREATE INDEX IF NOT EXISTS idx_analyst_sessions_elevenlabs
ON analyst_sessions(elevenlabs_conversation_id)
WHERE elevenlabs_conversation_id IS NOT NULL;

-- ============================================================================
-- EXTEND ANALYST_MESSAGES FOR TOOL CALLS
-- ============================================================================

-- Add tool tracking columns
ALTER TABLE analyst_messages
ADD COLUMN IF NOT EXISTS tool_calls JSONB,        -- [{tool_name, parameters, call_id}]
ADD COLUMN IF NOT EXISTS tool_results JSONB,      -- [{call_id, result, duration_ms}]
ADD COLUMN IF NOT EXISTS referenced_panels JSONB, -- [panel_id, ...] panels discussed
ADD COLUMN IF NOT EXISTS referenced_interviews JSONB; -- [interview_id, ...] interviews discussed

-- ============================================================================
-- KIRA MEMORY (Persistent insights across sessions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS kira_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Memory classification
  memory_type TEXT NOT NULL CHECK (memory_type IN (
    'insight',           -- A finding or pattern discovered
    'user_preference',   -- How the user likes info presented
    'research_context',  -- Background about the research
    'followup',          -- Something to follow up on
    'correction',        -- User corrected Kira on something
    'entity'             -- Important person/company/concept
  )),

  -- The actual memory
  title TEXT,                    -- Short label (e.g., "Price sensitivity is key theme")
  content TEXT NOT NULL,         -- Full memory content

  -- Context links
  related_panels JSONB,          -- [panel_id, ...]
  related_interviews JSONB,      -- [interview_id, ...]
  source_session_id UUID REFERENCES analyst_sessions(id) ON DELETE SET NULL,
  source_quote TEXT,             -- The quote/evidence that prompted this memory

  -- Retrieval optimization
  importance INTEGER DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),
  tags JSONB DEFAULT '[]',       -- ['pricing', 'competitor', 'feature-request']

  -- Validity
  expires_at TIMESTAMPTZ,        -- Optional expiry for time-sensitive memories
  superseded_by UUID REFERENCES kira_memory(id), -- If this memory was updated
  active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_recalled_at TIMESTAMPTZ,  -- Track when this memory was last used
  recall_count INTEGER DEFAULT 0
);

-- Indexes for efficient memory retrieval
CREATE INDEX IF NOT EXISTS idx_kira_memory_type ON kira_memory(memory_type) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_kira_memory_importance ON kira_memory(importance DESC) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_kira_memory_panels ON kira_memory USING gin(related_panels) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_kira_memory_tags ON kira_memory USING gin(tags) WHERE active = true;

-- ============================================================================
-- KIRA TOOL USAGE LOG (For debugging and optimization)
-- ============================================================================

CREATE TABLE IF NOT EXISTS kira_tool_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES analyst_sessions(id) ON DELETE CASCADE,

  -- Tool info
  tool_name TEXT NOT NULL,
  parameters JSONB,

  -- Execution
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Results
  success BOOLEAN,
  result_summary TEXT,           -- Brief description of what was returned
  result_count INTEGER,          -- Number of records returned (if applicable)
  error_message TEXT,

  -- Full data (optional, for debugging)
  full_result JSONB
);

CREATE INDEX IF NOT EXISTS idx_kira_tool_log_session ON kira_tool_log(session_id);
CREATE INDEX IF NOT EXISTS idx_kira_tool_log_tool ON kira_tool_log(tool_name);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update recall tracking when memory is accessed
CREATE OR REPLACE FUNCTION update_memory_recall()
RETURNS TRIGGER AS $$
BEGIN
  -- This would be called by the application when recalling memories
  -- For now, just a placeholder
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE kira_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on kira_memory" ON kira_memory FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE kira_tool_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on kira_tool_log" ON kira_tool_log FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- ENABLE REAL-TIME FOR ANALYST SESSIONS (live Kira updates)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'analyst_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE analyst_sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'analyst_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE analyst_messages;
  END IF;
END $$;

-- ============================================================================
-- HELPER VIEW: Recent Kira Sessions with Stats
-- ============================================================================

CREATE OR REPLACE VIEW v_kira_sessions AS
SELECT
  s.id,
  s.title,
  s.session_type,
  s.elevenlabs_conversation_id,
  s.message_count,
  s.call_duration_seconds,
  s.status,
  s.created_at,
  s.last_message_at,
  COUNT(DISTINCT m.referenced_panels) as panels_discussed,
  COUNT(DISTINCT m.referenced_interviews) as interviews_discussed,
  COUNT(CASE WHEN m.tool_calls IS NOT NULL THEN 1 END) as tool_calls_made
FROM analyst_sessions s
LEFT JOIN analyst_messages m ON s.id = m.session_id
WHERE s.session_type = 'voice'
GROUP BY s.id;

-- ============================================================================
-- SEED: Default memory for platform context
-- ============================================================================

-- This would be populated per-platform with relevant context
-- Example:
-- INSERT INTO kira_memory (memory_type, title, content, importance, tags) VALUES
-- ('research_context', 'Platform Purpose', 'This platform is used by f2k 3500 for customer research interviews.', 8, '["context", "platform"]');