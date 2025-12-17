# Interview Panel Dry-Run Endpoint

## Endpoint
POST /api/dev/interview/dry-run

## Purpose
Validate interview panel JSON before:
- Webhooks
- ElevenLabs
- Supabase
- Production execution

## Expected Payload
The exact JSON emitted by the agent:

```json
{
  "event": "INTERVIEW_READY",
  "version": "1.0",
  "panel": {
    "name": "Founder Discovery Interview",
    "description": "Understanding early-stage founder challenges",
    "tone": "friendly",
    "greeting": "Hi, thanks for joining today.",
    "questions": [
      "What problem are you solving?",
      "How are you solving it today?"
    ],
    "closing_message": "Thanks for your time.",
    "target_audience": "Startup founders",
    "duration_minutes": 20
  }
}
