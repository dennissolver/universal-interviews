-- ============================================================================
-- CHILD PLATFORM SCHEMA EXTENSION
-- ============================================================================
-- This migration EXTENDS the existing schema with:
-- 1. Panel drafts (Sandra conversation outputs)
-- 2. Interview evaluations (per-interview AI analysis)
-- 3. Panel-level aggregated insights
-- 4. AI analyst conversations
-- 5. Export/report generation
-- 6. Quality monitoring and alerts
--
-- EXISTING TABLES (not modified):
-- - agents (= panels/research studies)
-- - interviews
-- - interview_transcripts
-- - interviewees
-- - evaluations (agent quality scores)
-- - setup_conversations
-- ============================================================================

-- ============================================================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================================================

-- Add panel_id to interviewees (links to agents table)
ALTER TABLE interviewees
ADD COLUMN IF NOT EXISTS panel_id UUID REFERENCES agents(id) ON DELETE CASCADE;

-- Add evaluation tracking to interviews
ALTER TABLE interviews
ADD COLUMN IF NOT EXISTS evaluated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMPTZ;

-- Add unique constraint on elevenlabs_conversation_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'interview_transcripts_elevenlabs_conversation_id_key'
  ) THEN
    ALTER TABLE interview_transcripts
    ADD CONSTRAINT interview_transcripts_elevenlabs_conversation_id_key
    UNIQUE (elevenlabs_conversation_id);
  END IF;
EXCEPTION WHEN others THEN
  NULL; -- Ignore if already exists
END $$;

-- Add updated_at to interview_transcripts if missing
ALTER TABLE interview_transcripts
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- PANEL DRAFTS (Sandra conversation outputs before publishing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS panel_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,  -- Links to created agent if published

  -- Draft content (from Sandra conversation)
  name TEXT,
  description TEXT,
  research_goal TEXT,
  target_audience TEXT,
  interview_context TEXT CHECK (interview_context IN ('B2B', 'B2C')),
  questions JSONB DEFAULT '[]',
  agent_name TEXT,
  voice_gender TEXT CHECK (voice_gender IN ('male', 'female')),
  agent_tone TEXT,
  estimated_duration_minutes INTEGER,
  company_name TEXT,

  -- Sandra conversation link
  setup_conversation_id TEXT,
  elevenlabs_conversation_id TEXT,

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'discarded')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INTERVIEW EVALUATIONS (Per-interview AI analysis - different from agent evaluations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS interview_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE,
  transcript_id UUID REFERENCES interview_transcripts(id) ON DELETE CASCADE,
  panel_id UUID REFERENCES agents(id) ON DELETE CASCADE,  -- agents = panels

  -- Summary
  summary TEXT,
  executive_summary TEXT,  -- One sentence

  -- Sentiment
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  sentiment_score DECIMAL(3,2) CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
  sentiment_reasoning TEXT,

  -- Quality
  quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
  quality_reasoning TEXT,
  engagement_level TEXT CHECK (engagement_level IN ('high', 'medium', 'low')),

  -- Extracted insights
  key_quotes JSONB DEFAULT '[]',      -- [{quote, context, theme}]
  topics JSONB DEFAULT '[]',          -- ['topic1', 'topic2']
  pain_points JSONB DEFAULT '[]',     -- [{point, severity, quote}]
  desires JSONB DEFAULT '[]',         -- [{desire, priority, quote}]
  surprises JSONB DEFAULT '[]',       -- [{insight, quote}]

  -- Flags
  follow_up_worthy BOOLEAN DEFAULT false,
  follow_up_reason TEXT,
  needs_review BOOLEAN DEFAULT false,
  review_reason TEXT,

  -- Question-level analysis
  question_responses JSONB DEFAULT '[]',  -- [{question, response_summary, sentiment, quality}]

  -- Metadata
  model_used TEXT,
  prompt_version TEXT,
  raw_response JSONB,
  tokens_used INTEGER,
  evaluation_duration_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(interview_id)
);

-- ============================================================================
-- PANEL INSIGHTS (Aggregated insights across all interviews for a panel/agent)
-- ============================================================================

CREATE TABLE IF NOT EXISTS panel_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id UUID REFERENCES agents(id) ON DELETE CASCADE,  -- agents = panels

  -- Counts at time of generation
  interview_count INTEGER,
  evaluated_count INTEGER,

  -- Sentiment aggregation
  avg_sentiment_score DECIMAL(3,2),
  sentiment_breakdown JSONB,  -- {positive: 12, neutral: 5, negative: 3, mixed: 2}
  sentiment_trend JSONB,      -- [{date, avg_score, count}]

  -- Quality aggregation
  avg_quality_score DECIMAL(5,2),
  quality_distribution JSONB,  -- {high: 10, medium: 8, low: 2}

  -- Theme analysis
  top_themes JSONB,           -- [{theme, count, percentage, sentiment}]
  theme_correlations JSONB,   -- [{theme1, theme2, correlation}]

  -- Pain points aggregation
  common_pain_points JSONB,   -- [{point, frequency, severity_avg, example_quotes}]

  -- Desires aggregation
  common_desires JSONB,       -- [{desire, frequency, priority_avg, example_quotes}]

  -- Key quotes (curated across all interviews)
  curated_quotes JSONB,       -- [{quote, interview_id, theme, sentiment, impact_score}]

  -- Word frequency (for word clouds)
  word_frequency JSONB,       -- [{word, count}]

  -- Outliers and alerts
  outlier_interviews JSONB,   -- [{interview_id, reason, score}]

  -- AI-generated summaries
  executive_summary TEXT,
  key_findings JSONB,         -- [{finding, supporting_evidence, confidence}]
  recommendations JSONB,      -- [{recommendation, rationale, priority}]

  -- Comparison insights (if applicable)
  segment_comparisons JSONB,  -- [{segment_a, segment_b, differences}]

  -- Generation metadata
  model_used TEXT,
  prompt_version TEXT,
  generation_duration_ms INTEGER,

  -- Validity
  valid_until TIMESTAMPTZ,    -- Regenerate after this time or new interviews
  stale BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- AI ANALYST (Conversational interface to query interview data)
-- ============================================================================

-- Analyst chat sessions
CREATE TABLE IF NOT EXISTS analyst_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID,  -- If you have user auth

  -- Session info
  title TEXT,  -- Auto-generated or user-set

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),

  -- Message count (denormalized)
  message_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ
);

-- Analyst chat messages
CREATE TABLE IF NOT EXISTS analyst_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES analyst_sessions(id) ON DELETE CASCADE,

  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,

  -- If assistant, track what data was used
  context_interviews JSONB,    -- [{interview_id, relevance_score}]
  context_token_count INTEGER,

  -- Citations (which interviews support this response)
  citations JSONB,             -- [{interview_id, quote, relevance}]

  -- Metadata
  model_used TEXT,
  tokens_used INTEGER,
  response_time_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved analyst queries (templates/favorites)
CREATE TABLE IF NOT EXISTS analyst_saved_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id UUID REFERENCES agents(id) ON DELETE SET NULL,  -- NULL = global template
  user_id UUID,

  -- Query info
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  description TEXT,

  -- Categorization
  category TEXT,  -- 'sentiment', 'themes', 'comparison', 'export', 'custom'

  -- Usage tracking
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- EXPORT & REPORTS
-- ============================================================================

-- Generated reports
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID,

  -- Report config
  title TEXT NOT NULL,
  report_type TEXT CHECK (report_type IN ('executive', 'detailed', 'quotes', 'custom')),

  -- Content sections included
  sections JSONB,  -- ['executive_summary', 'sentiment', 'themes', 'quotes', 'recommendations']

  -- Filters applied
  filters JSONB,   -- {date_range, sentiment, themes, etc}

  -- Generated content
  content JSONB,   -- Full report content structure

  -- File outputs
  pdf_url TEXT,
  pptx_url TEXT,
  docx_url TEXT,

  -- Status
  status TEXT DEFAULT 'generating' CHECK (status IN ('generating', 'ready', 'failed', 'expired')),

  -- Metadata
  generation_duration_ms INTEGER,
  expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Export history
CREATE TABLE IF NOT EXISTS exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID,

  -- Export config
  export_type TEXT CHECK (export_type IN ('csv', 'json', 'xlsx', 'transcripts_zip')),

  -- What was exported
  record_count INTEGER,
  filters JSONB,
  columns JSONB,  -- For tabular exports

  -- File
  file_url TEXT,
  file_size_bytes INTEGER,

  -- Status
  status TEXT DEFAULT 'generating' CHECK (status IN ('generating', 'ready', 'failed', 'expired')),
  expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- QUALITY & MONITORING
-- ============================================================================

-- Alerts/notifications
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE,

  -- Alert info
  alert_type TEXT NOT NULL,  -- 'low_quality', 'negative_sentiment', 'outlier', 'follow_up_needed', 'drift_detected'
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),

  title TEXT NOT NULL,
  description TEXT,

  -- Related data
  context JSONB,

  -- Status
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'viewed', 'acknowledged', 'resolved', 'dismissed')),

  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Panel health snapshots (for monitoring dashboard)
CREATE TABLE IF NOT EXISTS panel_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id UUID REFERENCES agents(id) ON DELETE CASCADE,

  -- Snapshot time
  snapshot_date DATE NOT NULL,

  -- Counts
  total_interviews INTEGER,
  completed_interviews INTEGER,
  evaluated_interviews INTEGER,

  -- Averages
  avg_duration_seconds INTEGER,
  avg_quality_score DECIMAL(5,2),
  avg_sentiment_score DECIMAL(3,2),

  -- Completion funnel
  completion_rate DECIMAL(5,2),

  -- Alerts
  open_alerts INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(panel_id, snapshot_date)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Panel drafts
CREATE INDEX IF NOT EXISTS idx_panel_drafts_status ON panel_drafts(status);
CREATE INDEX IF NOT EXISTS idx_panel_drafts_conversation ON panel_drafts(elevenlabs_conversation_id);

-- Interview evaluations
CREATE INDEX IF NOT EXISTS idx_interview_evaluations_interview ON interview_evaluations(interview_id);
CREATE INDEX IF NOT EXISTS idx_interview_evaluations_panel ON interview_evaluations(panel_id);
CREATE INDEX IF NOT EXISTS idx_interview_evaluations_sentiment ON interview_evaluations(sentiment);
CREATE INDEX IF NOT EXISTS idx_interview_evaluations_quality ON interview_evaluations(quality_score);
CREATE INDEX IF NOT EXISTS idx_interview_evaluations_follow_up ON interview_evaluations(follow_up_worthy) WHERE follow_up_worthy = true;

-- Panel insights
CREATE INDEX IF NOT EXISTS idx_panel_insights_panel ON panel_insights(panel_id);
CREATE INDEX IF NOT EXISTS idx_panel_insights_stale ON panel_insights(stale) WHERE stale = true;

-- Analyst
CREATE INDEX IF NOT EXISTS idx_analyst_sessions_panel ON analyst_sessions(panel_id);
CREATE INDEX IF NOT EXISTS idx_analyst_messages_session ON analyst_messages(session_id);

-- Alerts
CREATE INDEX IF NOT EXISTS idx_alerts_panel ON alerts(panel_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status) WHERE status = 'new';

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Update agent interview counts when interviews change
CREATE OR REPLACE FUNCTION update_agent_interview_counts()
RETURNS TRIGGER AS $$
DECLARE
  target_panel_id UUID;
BEGIN
  -- Get the panel_id from either NEW or OLD record
  target_panel_id := COALESCE(NEW.panel_id, OLD.panel_id);

  IF target_panel_id IS NOT NULL THEN
    UPDATE agents SET
      total_interviews = (SELECT COUNT(*) FROM interviews WHERE panel_id = target_panel_id),
      completed_interviews = (SELECT COUNT(*) FROM interviews WHERE panel_id = target_panel_id AND status = 'completed'),
      updated_at = NOW()
    WHERE id = target_panel_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_agent_counts ON interviews;
CREATE TRIGGER trg_update_agent_counts
AFTER INSERT OR UPDATE OR DELETE ON interviews
FOR EACH ROW EXECUTE FUNCTION update_agent_interview_counts();

-- Mark panel insights as stale when new evaluation added
CREATE OR REPLACE FUNCTION mark_panel_insights_stale()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE panel_insights SET stale = true, updated_at = NOW()
  WHERE panel_id = NEW.panel_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mark_insights_stale ON interview_evaluations;
CREATE TRIGGER trg_mark_insights_stale
AFTER INSERT ON interview_evaluations
FOR EACH ROW EXECUTE FUNCTION mark_panel_insights_stale();

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to new tables
DROP TRIGGER IF EXISTS trg_panel_drafts_updated ON panel_drafts;
CREATE TRIGGER trg_panel_drafts_updated BEFORE UPDATE ON panel_drafts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_interview_evaluations_updated ON interview_evaluations;
CREATE TRIGGER trg_interview_evaluations_updated BEFORE UPDATE ON interview_evaluations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_panel_insights_updated ON panel_insights;
CREATE TRIGGER trg_panel_insights_updated BEFORE UPDATE ON panel_insights
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_analyst_sessions_updated ON analyst_sessions;
CREATE TRIGGER trg_analyst_sessions_updated BEFORE UPDATE ON analyst_sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_reports_updated ON reports;
CREATE TRIGGER trg_reports_updated BEFORE UPDATE ON reports
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Interview summary view (for dashboard list)
CREATE OR REPLACE VIEW v_interview_summary AS
SELECT
  i.id,
  i.panel_id,
  a.name as panel_name,
  i.participant_name,
  i.participant_company,
  COALESCE(i.participant_country, t.participant_city) as participant_location,
  i.status,
  i.duration_seconds,
  i.completed_at,
  i.evaluated,
  e.summary,
  e.sentiment,
  e.sentiment_score,
  e.quality_score,
  e.follow_up_worthy,
  e.topics,
  e.key_quotes
FROM interviews i
LEFT JOIN agents a ON i.panel_id = a.id
LEFT JOIN interview_transcripts t ON i.elevenlabs_conversation_id = t.elevenlabs_conversation_id
LEFT JOIN interview_evaluations e ON i.id = e.interview_id;

-- Panel overview view (for dashboard cards)
CREATE OR REPLACE VIEW v_panel_overview AS
SELECT
  a.id,
  a.name,
  a.status,
  a.total_interviews as interview_count,
  a.completed_interviews as completed_count,
  a.created_at,
  COALESCE(AVG(e.quality_score), 0) as avg_quality,
  COALESCE(AVG(e.sentiment_score), 0) as avg_sentiment,
  COUNT(CASE WHEN e.sentiment = 'positive' THEN 1 END) as positive_count,
  COUNT(CASE WHEN e.sentiment = 'neutral' THEN 1 END) as neutral_count,
  COUNT(CASE WHEN e.sentiment = 'negative' THEN 1 END) as negative_count,
  COUNT(CASE WHEN e.follow_up_worthy THEN 1 END) as follow_up_count,
  (SELECT COUNT(*) FROM alerts al WHERE al.panel_id = a.id AND al.status = 'new') as open_alerts
FROM agents a
LEFT JOIN interviews i ON a.id = i.panel_id
LEFT JOIN interview_evaluations e ON i.id = e.interview_id
GROUP BY a.id;

-- Recent activity view
CREATE OR REPLACE VIEW v_recent_activity AS
SELECT
  'interview' as activity_type,
  i.id as record_id,
  i.panel_id,
  a.name as panel_name,
  i.participant_name as description,
  i.status,
  i.completed_at as activity_at
FROM interviews i
JOIN agents a ON i.panel_id = a.id
WHERE i.completed_at > NOW() - INTERVAL '7 days'
UNION ALL
SELECT
  'alert' as activity_type,
  al.id as record_id,
  al.panel_id,
  a.name as panel_name,
  al.title as description,
  al.status,
  al.created_at as activity_at
FROM alerts al
JOIN agents a ON al.panel_id = a.id
WHERE al.created_at > NOW() - INTERVAL '7 days'
ORDER BY activity_at DESC;

-- ============================================================================
-- DEFAULT DATA
-- ============================================================================

-- Default saved queries for AI analyst (global templates)
INSERT INTO analyst_saved_queries (id, panel_id, name, query, category, description) VALUES
  (gen_random_uuid(), NULL, 'Top Pain Points', 'What are the most common pain points mentioned across all interviews?', 'themes', 'Identify recurring frustrations and challenges'),
  (gen_random_uuid(), NULL, 'Sentiment Summary', 'Summarize the overall sentiment. What are people happy about vs frustrated with?', 'sentiment', 'Overview of positive and negative feedback'),
  (gen_random_uuid(), NULL, 'Key Quotes', 'Give me the 10 most impactful quotes from these interviews', 'export', 'Extract memorable quotes for reports'),
  (gen_random_uuid(), NULL, 'Executive Summary', 'Write a 3-paragraph executive summary of the findings', 'export', 'High-level summary for stakeholders'),
  (gen_random_uuid(), NULL, 'Recommendations', 'Based on these interviews, what are your top 5 recommendations?', 'custom', 'Actionable insights from the data'),
  (gen_random_uuid(), NULL, 'Surprising Insights', 'What unexpected or surprising patterns did you notice?', 'themes', 'Surface non-obvious findings'),
  (gen_random_uuid(), NULL, 'Compare Segments', 'Compare what enterprise customers said vs small business customers', 'comparison', 'Segment-based analysis')
ON CONFLICT DO NOTHING;