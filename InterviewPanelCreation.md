# Interview Panel Creation Guide

A comprehensive guide to configuring AI interview panels for Connexions AI Interview Panel Set up.

---

## Overview

When creating a new interview panel, you'll work with Sandra, our AI setup agent, to configure all aspects of your research study. This document outlines the key parameters you'll need to define for a successful panel deployment.

---

## Required Parameters

### 1. Research Topic

The central subject or theme of your interview study.

**Examples:**
- "The First 5 Minutes of a VC Pitch"
- "Pain Points in Traditional Market Research"
- "Enterprise Software Buying Decisions"

**Best Practices:**
- Keep it focused and specific
- Frame it as a question or area of exploration
- Ensure it aligns with your research objectives

---

### 2. Target Interviewee Market

Define who you want to interview. Be specific about demographics, roles, and qualifying criteria.

**Parameters to specify:**
- **Industry/Sector:** Tech, Healthcare, Finance, etc.
- **Role/Title:** VCs, Product Managers, Marketing Directors, etc.
- **Company Size:** Startup, SMB, Enterprise
- **Experience Level:** Years in role, seniority
- **Geographic Focus:** Region, country, or global

**Example:**
> "Venture Capital partners and associates at early-stage funds (Seed to Series A), with 3+ years of experience evaluating pitches, based in North America."

---

### 3. AI Interviewer Tone

Set the conversational style for your AI interviewer. This affects how questions are asked and how the AI responds to participant answers.

**Tone Options:**

| Tone | Best For | Characteristics |
|------|----------|-----------------|
| **Friendly** | Consumer research, general audiences | Warm, conversational, encouraging |
| **Professional** | B2B research, executive interviews | Polished, respectful, business-appropriate |
| **Casual** | Youth markets, creative industries | Relaxed, informal, approachable |
| **Academic** | Research studies, expert interviews | Precise, neutral, scholarly |
| **Empathetic** | Sensitive topics, user experience | Understanding, supportive, patient |

**Additional tone modifiers:**
- Curiosity level (probing vs. surface-level)
- Formality of language
- Use of industry jargon (match to audience expertise)

---

### 4. Interview Questions (7-10 Recommended)

The core questions that guide the interview conversation.

**Question Structure:**

1. **Opening Question (1):** Easy, rapport-building question to get participants comfortable
2. **Core Questions (5-7):** Main research questions addressing your objectives
3. **Closing Question (1-2):** Wrap-up, additional thoughts, or call-to-action

**Question Types:**
- **Open-ended:** "Tell me about..." / "How do you approach..."
- **Behavioral:** "Describe a time when..." / "Walk me through..."
- **Opinion-based:** "What do you think about..." / "How important is..."
- **Comparative:** "How does X compare to Y in your experience..."
- **Hypothetical:** "If you could change one thing about..."

**Best Practices:**
- Start broad, then get specific
- Avoid leading questions
- Use follow-up prompts for depth
- Keep language clear and jargon-appropriate for your audience

---

### 5. Research Objectives

Define what you want to learn and how the insights will be used.

**Framework for objectives:**

```
Primary Objective:
[The main insight or answer you're seeking]

Secondary Objectives:
- [Supporting insight #1]
- [Supporting insight #2]
- [Supporting insight #3]

Intended Use:
[How will this research inform decisions?]
```

**Example:**
> **Primary Objective:** Understand what makes investors decide to take a second meeting within the first 5 minutes of a pitch.
>
> **Secondary Objectives:**
> - Identify common mistakes founders make early in pitches
> - Discover what signals build investor confidence quickly
> - Learn how pitch evaluation differs by fund stage focus
>
> **Intended Use:** Create a data-driven guide for founders preparing for investor meetings.

---

### 6. Participant Benefits & Incentives

Clearly articulate why someone should participate. This information is included in invitations and at the start of interviews.

**Key elements to define:**

| Element | Description | Example |
|---------|-------------|---------|
| **Time Commitment** | How long the interview takes | "10-15 minutes" |
| **Value Exchange** | What participants receive | "Early access to research findings" |
| **Community Impact** | How their input helps others | "Shape resources for the founder community" |
| **Ease of Participation** | Highlight convenience | "Complete anytime, from any device" |
| **Credibility** | Who's conducting the research | "Part of ongoing VC ecosystem research" |

**Incentive Options:**
- Access to aggregated research report
- Industry benchmarking data
- Exclusive community insights
- Networking opportunities
- Direct monetary compensation (if applicable)

**Example messaging:**
> "This 10-15 minute AI-powered interview explores how investors evaluate early-stage pitches. As a thank you, participants receive early access to our research findings—practical insights drawn from dozens of VC perspectives. Your input directly shapes resources that help founders succeed."

---

### 7. Interview Duration

Set expectations for how long the interview should take.

**Recommended durations by question count:**

| Questions | Estimated Duration | Best For |
|-----------|-------------------|----------|
| 5-7 | 8-12 minutes | Quick pulse checks, busy professionals |
| 7-10 | 12-18 minutes | Standard research depth |
| 10-12 | 18-25 minutes | Deep dives, complex topics |

**Factors affecting duration:**
- Question complexity
- Expected answer length
- Number of follow-up probes
- Participant verbosity

---

## Optional Parameters

### 8. Follow-up Probe Settings

Configure how the AI digs deeper into responses.

- **Probe depth:** Light (1 follow-up) / Medium (2) / Deep (3+)
- **Probe triggers:** Short answers, interesting points, unclear responses
- **Probe style:** Clarifying, expanding, challenging

### 9. Screening Questions

Pre-interview qualification questions to ensure participant fit.

**Example:**
> "Before we begin, can you confirm you've evaluated at least 20 startup pitches in the past year?"

### 10. Custom Welcome Message

Personalized introduction played at interview start.

### 11. Closing Call-to-Action

What happens after the interview ends.

- Redirect to website
- Invitation to schedule follow-up
- Request for referrals
- Newsletter signup

### 12. Language & Localization

- Primary interview language
- Cultural considerations
- Regional terminology preferences

---

## Panel Configuration Checklist

Before launching your panel, confirm:

- [ ] Research topic is clearly defined
- [ ] Target audience criteria are specific and actionable
- [ ] AI tone matches audience expectations
- [ ] 7-10 questions cover all research objectives
- [ ] Questions flow logically from opening to closing
- [ ] Research objectives are documented
- [ ] Participant benefits are compelling and clearly stated
- [ ] Time estimate is accurate and communicated
- [ ] Screening criteria (if any) are configured
- [ ] Welcome and closing messages are set
- [ ] Email invitation copy is ready
- [ ] Landing page/scheduling link is prepared

---

## Example Panel Configuration

```yaml
Panel Name: "The First 5 Minutes - VC Pitch Research"

Research Topic: 
  What happens in the first 5 minutes of a startup pitch that 
  determines whether investors want a second meeting?

Target Market:
  - Role: VC Partners and Associates
  - Focus: Early-stage (Pre-seed to Series A)
  - Experience: 3+ years in VC
  - Geography: North America
  - Minimum pitches evaluated: 50+

AI Tone: Professional with warm undertones

Questions: 9

Objectives:
  Primary: Identify decision triggers in early pitch moments
  Secondary: 
    - Common founder mistakes
    - Trust-building signals
    - Variation by fund thesis

Duration: 12-15 minutes

Participant Benefits:
  - Early access to research report
  - Benchmark data across peer responses
  - Contribution to founder education resources

Incentive: Research report access (no monetary compensation)

Closing CTA: Invitation to join research community
```

---

## Getting Started

Ready to create your panel? Start a conversation with Sandra, our AI setup agent, and she'll guide you through each parameter step by step.

**Sandra will help you:**
1. Define and refine your research topic
2. Identify your ideal participant profile
3. Craft effective interview questions
4. Set the right tone and duration
5. Create compelling participant messaging
6. Launch your panel

---

## Support

For questions about panel configuration or best practices, contact the Investor Connect AI team.

---

*Last updated: December 2024*
*Version: 1.0*