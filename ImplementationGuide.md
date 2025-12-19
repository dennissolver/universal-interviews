**# Sandra Setup Agent Updates - Implementation Guide

## Summary of Changes

### 1. Sandra is now COLLABORATIVE
- Opens with "What are we trying to achieve here?"
- Understands research goals BEFORE asking about logistics
- Asks follow-up questions to deeply understand the objective

### 2. Sandra SUGGESTS questions
- Based on their research goals, she proactively suggests 5+ questions
- "Here are some questions I think could work well..."
- Iterates with them: "Should we add, remove, or modify any?"

### 3. NO question limit
- They can have 3 questions or 30
- Sandra helps them build out as many as needed

### 4. Interviewer persona selection
- Sandra asks for **voice gender**: "Would you prefer a male or female voice?"
- Sandra asks for **agent name**: "What would you like to name your interviewer?"

---

## Files to Update

### 1. Update Sandra's Prompt in ElevenLabs

Go to your ElevenLabs dashboard → Conversational AI → Select your Sandra agent → Edit prompt

Replace the current prompt with the contents of `SANDRA_SETUP_PROMPT.md`

### 2. Update the Tool Parameters in ElevenLabs

In Sandra's agent settings, update the `create_interview_panel` tool to include these parameters:

```json
{
  "name": "create_interview_panel",
  "description": "Create an AI interview panel with the specified configuration. Call this when the user has confirmed all details.",
  "parameters": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "description": "Name of the interview panel/study"
      },
      "description": {
        "type": "string",
        "description": "Research objective or goal"
      },
      "questions": {
        "type": "array",
        "items": { "type": "string" },
        "description": "List of interview questions"
      },
      "tone": {
        "type": "string",
        "description": "Interview tone (e.g., 'friendly and professional', 'formal', 'casual')"
      },
      "target_audience": {
        "type": "string",
        "description": "Description of who will be interviewed"
      },
      "duration_minutes": {
        "type": "number",
        "description": "Expected interview length in minutes"
      },
      "agent_name": {
        "type": "string",
        "description": "Name for the AI interviewer (e.g., 'Alex', 'Jordan')"
      },
      "voice_gender": {
        "type": "string",
        "enum": ["male", "female"],
        "description": "Voice gender for the AI interviewer"
      },
      "closing_message": {
        "type": "string",
        "description": "Thank you message at end of interview"
      },
      "company_name": {
        "type": "string",
        "description": "Company conducting the research (optional)"
      }
    },
    "required": ["name", "questions", "agent_name", "voice_gender"]
  }
}
```

### 3. Deploy Updated API Route

Copy `app/api/tools/create-panel/route.ts` to your project, replacing the existing file.

```powershell
# In your universal-interviews directory
git add app/api/tools/create-panel/route.ts
git commit -m "Add voice selection and collaborative Sandra updates"
git push
```

---

## Voice ID Reference

| Gender | Voice Name | ElevenLabs ID |
|--------|------------|---------------|
| Female | Sarah | `EXAVITQu4vr4xnSDxMaL` |
| Male | Adam | `pNInz6obpgDQGcFmaJgB` |

These are the same voices used in RaiseReady template setup.

---

## Testing

After deploying, test Sandra by:

1. Start a conversation with Sandra
2. She should ask "What are we trying to achieve here?"
3. Describe a research goal
4. She should SUGGEST questions based on your goal
5. Iterate on the questions together
6. She should ask for voice preference (male/female)
7. She should ask for interviewer name
8. Confirm and create

The created panel should have the correct voice in ElevenLabs.

---

## Example Conversation Flow

**Sandra:** "Hi! I'm Sandra, your research design partner. I'm here to help you create a custom AI interviewer. Before we dive in — what's your name?"

**User:** "Dennis"

**Sandra:** "Great to meet you, Dennis! So tell me — what are we trying to achieve here? What's the research question or insight you're hoping to uncover?"

**User:** "I want to understand how VCs make decisions in the first few minutes of a pitch"

**Sandra:** "Interesting! So you want to get inside the heads of VCs during those critical opening moments. What would change if you had that answer? Are you helping founders pitch better, or researching investment psychology, or something else?"

**User:** "Helping founders understand what to focus on"

**Sandra:** "Got it — so the audience for this research is founders, but we're interviewing VCs to understand their decision-making. Based on what you've told me, here are some questions I think could work well:

1. How many founder pitches would you estimate you've seen in your career?
2. Walk me through what's going through your mind in the first five minutes of a pitch.
3. What signals in those early minutes make you lean in versus start to check out?
4. Is there something founders commonly do in the opening that they think helps but actually hurts?
5. How much does the deck itself matter versus how the founder presents?
6. Can you recall a pitch where the first five minutes completely changed your expectations?
7. If you could give founders one piece of advice about those opening minutes?

What do you think? Should we add, remove, or modify any of these?"

[...continues collaboratively...]

**Sandra:** "Now let's design your AI interviewer. Would you prefer a male or female voice?"

**User:** "Female"

**Sandra:** "And what would you like to name your interviewer?"

**User:** "Rachel"

**Sandra:** "Perfect! Let me confirm what we're building:

**Panel Name:** The First 5 Minutes of a Pitch
**Research Goal:** Understanding VC decision-making in early pitch moments to help founders
**Target Participants:** VC partners and associates
**Interviewer:** Rachel, female voice, friendly and professional
**Duration:** 12 minutes

**Questions:**
1. How many founder pitches would you estimate you've seen?
[...all questions...]

Does this look right?"

---

## Troubleshooting

**Voice not changing?**
- Check that `voice_gender` is being passed to the tool
- Verify the API route has the updated VOICE_IDS mapping
- Check Vercel logs for the voiceId being used

**Sandra not suggesting questions?**
- Make sure the prompt update is saved in ElevenLabs
- The key section is "SUGGEST QUESTIONS (THIS IS KEY)"

**Tool not receiving all parameters?**
- Update the tool schema in ElevenLabs to include `agent_name` and `voice_gender` as required**