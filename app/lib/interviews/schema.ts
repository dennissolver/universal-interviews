// app/lib/interviews/schema.ts

export const INTERVIEW_READY_EVENT = 'INTERVIEW_READY';

export interface InterviewPanelSpec {
  name: string;
  description?: string;
  tone?: string;
  greeting?: string;
  questions: string[];
  closing_message?: string;
  target_audience?: string;
  duration_minutes?: number;
}

export interface InterviewReadyPayload {
  event: typeof INTERVIEW_READY_EVENT;
  version: '1.0';
  panel: InterviewPanelSpec;
}

/**
 * Runtime guardrail validation.
 * Returns a human-readable error string if invalid.
 */
export function validateInterviewReadyPayload(
  payload: any
): { valid: true; data: InterviewReadyPayload } | { valid: false; error: string } {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Payload is not an object' };
  }

  if (payload.event !== INTERVIEW_READY_EVENT) {
    return { valid: false, error: 'Invalid or missing event type' };
  }

  if (payload.version !== '1.0') {
    return { valid: false, error: 'Unsupported or missing schema version' };
  }

  const panel = payload.panel;
  if (!panel || typeof panel !== 'object') {
    return { valid: false, error: 'Missing panel object' };
  }

  if (!panel.name || typeof panel.name !== 'string') {
    return { valid: false, error: 'Panel name is required and must be a string' };
  }

  if (!Array.isArray(panel.questions) || panel.questions.length === 0) {
    return { valid: false, error: 'Panel must include at least one question' };
  }

  for (const q of panel.questions) {
    if (typeof q !== 'string' || !q.trim()) {
      return { valid: false, error: 'All questions must be non-empty strings' };
    }
  }

  if (
    panel.duration_minutes !== undefined &&
    (typeof panel.duration_minutes !== 'number' ||
      panel.duration_minutes < 5 ||
      panel.duration_minutes > 120)
  ) {
    return { valid: false, error: 'duration_minutes must be between 5 and 120' };
  }

  return { valid: true, data: payload };
}
