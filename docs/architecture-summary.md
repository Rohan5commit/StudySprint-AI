# Architecture Summary

## Product goal
StudyPilot AI helps students convert unstructured notes into a full revision workflow with minimal setup and strong demo reliability.

## System design

### 1. Frontend
- **Framework:** Next.js App Router + TypeScript + Tailwind CSS
- **Screens:** landing page, workspace, dashboard, quiz, flashcards, revision plan
- **State:** lightweight client-side store backed by `localStorage`

### 2. AI layer
- **Route:** `app/api/generate/route.ts`
- **Provider:** NVIDIA NIM chat-completions endpoint
- **Output contract:** JSON-shaped study pack parsed and normalized server-side
- **Fallback:** local rule-based study engine creates the same output categories when the key is missing or AI fails

### 3. Adaptive practice layer
- **Route:** `app/api/practice/route.ts`
- **Input:** current study pack + user progress
- **Behavior:** prioritizes hard-rated concepts and incorrect quiz concepts
- **Fallback:** local weak-area practice generator

### 4. Progress layer
- **Storage:** browser `localStorage`
- **Tracks:** checklist completion, flashcard mastery, topic ratings, quiz attempts, last adaptive drill
- **Reason for no DB:** faster hackathon shipping, zero setup for judges, and easy demo resets

## Key architectural decisions

1. **One strong vertical slice over complex infrastructure**
   - No database required
   - No auth required for the demo
   - Focus stays on functionality, reliability, and speed

2. **AI is optional, not a hard dependency**
   - Judges can always run the full product flow
   - Demo mode never blocks the submission

3. **Grounded outputs**
   - Prompts explicitly anchor all content to the user’s notes
   - If details are missing, the fallback keeps the answer generic instead of hallucinating

4. **Simple but complete UX**
   - Clear screen separation for dashboard, quiz, flashcards, and plan
   - Mobile-friendly layout and visible loading / error / empty states

## Data flow

1. User pastes notes or loads a preset in `/workspace`
2. Client submits generation request to `/api/generate`
3. Server returns structured study pack from NVIDIA NIM or fallback engine
4. Client stores the study pack locally
5. Dashboard, quiz, flashcards, and plan all read from the same client store
6. Weak-area drill calls `/api/practice` with live progress to generate follow-up questions
