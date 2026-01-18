-- ============================================================================
-- UNIVERSAL INTERVIEWS - BASE SCHEMA
-- Migration: 20260116000000_base_schema.sql
-- Run this BEFORE the extension schema
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- AGENTS TABLE (Interview Panels)
-- ============================================================================
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic info
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived', 'draft')),
  
  -- Company/Research context
  company_name TEXT,
  research_goal TEXT,
  target_audience TEXT,
  interview_context TEXT CHECK (interview_context IN ('B2B', 'B2C')),
  
  -- Interview configuration
  questions JSONB DEFAULT '[]',
  greeting TEXT,
  interviewer_tone TEXT DEFAULT 'professional',
  estimated_duration_mins INT DEFAULT 10,
  
  -- ElevenLabs config
  elevenlabs_agent_id TEXT,
  voice_id TEXT,
  
  -- Counts (denormalized for performance)
  total_interviews INT DEFAULT 0,
  completed_interviews INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INTERVIEWS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  
  -- Participant info
  participant_name TEXT,
  participant_email TEXT,
  participant_company TEXT,
  participant_role TEXT,
  participant_country TEXT,
  
  -- Session tracking
  elevenlabs_conversation_id TEXT UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'abandoned')),
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds INT,
  
  -- Evaluation flags
  evaluated BOOLEAN DEFAULT false,
  evaluated_at TIMESTAMPTZ,
  
  -- Metadata
  source TEXT DEFAULT 'direct',
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INTERVIEW TRANSCRIPTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS interview_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE,
  
  -- ElevenLabs identifiers
  elevenlabs_conversation_id TEXT UNIQUE,
  elevenlabs_agent_id TEXT,
  
  -- Content
  transcript JSONB,
  transcript_text TEXT,
  analysis JSONB,
  
  -- Participant info (from ElevenLabs)
  participant_name TEXT,
  participant_email TEXT,
  participant_city TEXT,
  
  -- Status
  status TEXT DEFAULT 'received',
  call_duration_secs INT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Forwarding (for parent platform)
  forwarded_to_parent BOOLEAN DEFAULT FALSE,
  forwarded_at TIMESTAMPTZ,
  
  -- Timestamps
  received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INTERVIEWEES TABLE (Invited participants)
-- ============================================================================
CREATE TABLE IF NOT EXISTS interviewees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  
  -- Contact info
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  role TEXT,
  
  -- Custom fields
  custom_field TEXT,
  custom_data JSONB DEFAULT '{}',
  
  -- Invitation
  invite_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  status TEXT DEFAULT 'invited' CHECK (status IN ('invited', 'reminded', 'started', 'completed', 'expired', 'declined')),
  
  -- Timestamps
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  reminded_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  -- Link to interview when started
  interview_id UUID REFERENCES interviews(id),
  
  -- Source tracking
  source TEXT DEFAULT 'manual',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- EVALUATIONS TABLE (Agent/Panel quality scores)
-- ============================================================================
CREATE TABLE IF NOT EXISTS evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  
  -- Scores
  overall_score DECIMAL(5,2),
  response_quality DECIMAL(5,2),
  engagement_score DECIMAL(5,2),
  completion_rate DECIMAL(5,2),
  
  -- Details
  strengths JSONB DEFAULT '[]',
  improvements JSONB DEFAULT '[]',
  notes TEXT,
  
  -- Metadata
  evaluated_by TEXT,
  model_used TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SETUP CONVERSATIONS TABLE (Sandra's panel creation chats)
-- ============================================================================
CREATE TABLE IF NOT EXISTS setup_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- ElevenLabs identifiers
  elevenlabs_conversation_id TEXT UNIQUE NOT NULL,
  elevenlabs_agent_id TEXT,
  
  -- The panel that was created (if successful)
  panel_created_id UUID REFERENCES agents(id),
  
  -- Content
  transcript_text TEXT,
  transcript_json JSONB,
  analysis JSONB,
  metadata JSONB,
  
  -- Status
  status TEXT DEFAULT 'received',
  call_duration_seconds INT,
  
  -- Timestamps
  conversation_started_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Agents
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_slug ON agents(slug);
CREATE INDEX IF NOT EXISTS idx_agents_elevenlabs ON agents(elevenlabs_agent_id);

-- Interviews
CREATE INDEX IF NOT EXISTS idx_interviews_panel ON interviews(panel_id);
CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews(status);
CREATE INDEX IF NOT EXISTS idx_interviews_conversation ON interviews(elevenlabs_conversation_id);
CREATE INDEX IF NOT EXISTS idx_interviews_completed ON interviews(completed_at) WHERE status = 'completed';

-- Transcripts
CREATE INDEX IF NOT EXISTS idx_transcripts_interview ON interview_transcripts(interview_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_conversation ON interview_transcripts(elevenlabs_conversation_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_agent ON interview_transcripts(elevenlabs_agent_id);

-- Interviewees
CREATE INDEX IF NOT EXISTS idx_interviewees_panel ON interviewees(panel_id);
CREATE INDEX IF NOT EXISTS idx_interviewees_email ON interviewees(email);
CREATE INDEX IF NOT EXISTS idx_interviewees_token ON interviewees(invite_token);
CREATE INDEX IF NOT EXISTS idx_interviewees_status ON interviewees(status);

-- Setup conversations
CREATE INDEX IF NOT EXISTS idx_setup_conv_elevenlabs ON setup_conversations(elevenlabs_conversation_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables
DROP TRIGGER IF EXISTS trg_agents_updated ON agents;
CREATE TRIGGER trg_agents_updated BEFORE UPDATE ON agents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_interviews_updated ON interviews;
CREATE TRIGGER trg_interviews_updated BEFORE UPDATE ON interviews
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_transcripts_updated ON interview_transcripts;
CREATE TRIGGER trg_transcripts_updated BEFORE UPDATE ON interview_transcripts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_interviewees_updated ON interviewees;
CREATE TRIGGER trg_interviewees_updated BEFORE UPDATE ON interviewees
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS POLICIES (permissive for child platforms)
-- ============================================================================

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviewees ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE setup_conversations ENABLE ROW LEVEL SECURITY;

-- Allow all for service role (child platforms use service key)
CREATE POLICY "Allow all on agents" ON agents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on interviews" ON interviews FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on interview_transcripts" ON interview_transcripts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on interviewees" ON interviewees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on evaluations" ON evaluations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on setup_conversations" ON setup_conversations FOR ALL USING (true) WITH CHECK (true);