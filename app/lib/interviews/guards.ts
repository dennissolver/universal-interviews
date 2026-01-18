// app/lib/interviews/guards.ts

import crypto from 'crypto';

/**
 * Create a deterministic idempotency key from a payload.
 * Same payload → same key.
 */
export function createIdempotencyKey(payload: unknown): string {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(payload));
  return hash.digest('hex');
}

/**
 * Hard limit guardrails to prevent abuse or runaway agents.
 */
export function enforceLimits(panel: {
  name?: string;
  questions?: string[];
  duration_minutes?: number;
}) {
  if (panel.name && panel.name.length > 120) {
    throw new Error('Panel name too long');
  }

  if (panel.questions && panel.questions.length > 15) {
    throw new Error('Too many questions (max 15)');
  }

  if (
    panel.duration_minutes &&
    (panel.duration_minutes < 5 || panel.duration_minutes > 120)
  ) {
    throw new Error('Invalid duration_minutes');
  }
}
