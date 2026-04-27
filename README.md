# StudyPilot AI

StudyPilot AI is a polished, demo-first student web app built for **Genesis: The AI Buildathon 2026**. It turns a student’s subjects, syllabus text, exam date, weak chapters, free hours, and learning style into a personalized study system with a revision timetable, checklist, summaries, quizzes, flashcards, progress tracking, and a last-minute rescue mode.

**Live app:** https://studypilot-ai-rohan-santhoshs-projects.vercel.app  
**GitHub repo:** https://github.com/Rohan5commit/StudyPilot-AI

## Why this product is strong for judges

- **Instantly understandable:** every student knows the pain of not knowing what to revise first.
- **Useful, not gimmicky:** the outputs are concrete study assets, not generic AI chat.
- **Fast demo value:** the product story is clear in under 30 seconds.
- **Frontend-led and realistic:** it feels like a real product without needing complex backend setup.
- **Safe fallback:** the app still demos cleanly even if live inference is unavailable.

## Core product flow

1. Student enters subject, chapter/topic, exam date, weekly study hours, weak chapters, and preferred learning style.
2. StudyPilot AI prioritizes the most urgent areas.
3. It generates:
   - a personalized revision timetable,
   - a chapter-by-chapter checklist,
   - quick summaries,
   - quiz questions,
   - flashcards,
   - and a last-minute revision mode.
4. The student tracks progress and the plan updates around weak areas.

## Tech stack

- **Frontend:** Next.js App Router, TypeScript, Tailwind CSS
- **State:** local browser storage for zero-setup demos
- **AI provider:** NVIDIA NIM chat-completions endpoint
- **Fallback engine:** deterministic local study-pack generator for guaranteed judge demos
- **Deployment:** Vercel

## Screens

- Landing page
- Guided onboarding workspace
- Progress dashboard
- Study plan / revision timetable
- Quiz mode
- Flashcard mode
- Last-minute revision mode panel

## Demo reliability

- Demo presets let judges see the full workflow immediately.
- The product works without a database.
- If NVIDIA NIM is unavailable, the fallback engine still generates a strong study pack.
- The whole experience is optimized for a short live walkthrough.

## Submission / pitch assets

- Idea submission pack: [`docs/idea-submission-pack.md`](docs/idea-submission-pack.md)
- Final-round build plan: [`docs/final-round-plan.md`](docs/final-round-plan.md)
- Elevator pitch: [`docs/elevator-pitch.md`](docs/elevator-pitch.md)
- Demo script: [`docs/demo-script.md`](docs/demo-script.md)
- Submission description: [`docs/submission-description.md`](docs/submission-description.md)
- Judge-facing why-win note: [`docs/judge-facing-why-this-should-win.md`](docs/judge-facing-why-this-should-win.md)
- v0 prompt: [`docs/v0-prompt.md`](docs/v0-prompt.md)
- Claude prompt: [`docs/claude-prompt.md`](docs/claude-prompt.md)
- Minimum viable winning version: [`docs/minimum-viable-winning-version.md`](docs/minimum-viable-winning-version.md)
- Final checklist: [`docs/final-submission-checklist.md`](docs/final-submission-checklist.md)

## Environment variables

```bash
NVIDIA_NIM_API_KEY=
NVIDIA_NIM_MODEL=openai/gpt-oss-20b
NVIDIA_NIM_BASE_URL=https://integrate.api.nvidia.com/v1
NEXT_PUBLIC_APP_URL=https://studypilot-ai-rohan-santhoshs-projects.vercel.app
```

## Local run

```bash
npm install
npm run dev
```
