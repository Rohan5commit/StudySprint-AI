import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateAdaptivePractice } from "@/lib/ai";

const difficultySchema = z.enum(["easy", "medium", "hard"]);
const learningStyleSchema = z.enum(["visual", "practice-first", "step-by-step", "mixed"]);

const quizQuestionSchema = z.object({
  id: z.string().min(1),
  concept: z.string().min(1),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(6),
  correctAnswer: z.string().min(1),
  explanation: z.string().min(1),
  difficulty: difficultySchema,
});

const flashcardSchema = z.object({
  id: z.string().min(1),
  concept: z.string().min(1),
  front: z.string().min(1),
  back: z.string().min(1),
});

const weakDrillSchema = z.object({
  id: z.string().min(1),
  concept: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().min(1),
  hint: z.string().min(1),
  difficulty: difficultySchema,
});

const revisionSessionSchema = z.object({
  id: z.string().min(1),
  dayLabel: z.string().min(1),
  title: z.string().min(1),
  focusConcepts: z.array(z.string().min(1)).min(1).max(4),
  durationMinutes: z.number().int().min(15).max(180),
  objective: z.string().min(1),
  tasks: z.array(z.string().min(1)).min(1).max(6),
});

const studyPackSchema = z.object({
  id: z.string().min(1),
  subject: z.string().min(1),
  topic: z.string().min(1),
  inputText: z.string().min(24).max(12_000),
  examDate: z.string().nullable().optional(),
  availableHoursPerWeek: z.number().min(1).max(40).nullable().optional(),
  weakTopicsInput: z.array(z.string().min(1)).max(8),
  learningStyle: learningStyleSchema.nullable().optional(),
  generatedAt: z.string().min(1),
  provider: z.enum(["nvidia-nim", "demo-fallback", "instant-demo"]),
  fallbackReason: z.string().optional(),
  sourcePresetId: z.string().nullable().optional(),
  keyConcepts: z.array(z.string().min(1)).min(1).max(8),
  summary: z.object({
    short: z.string().min(1),
    bullets: z.array(z.string().min(1)).min(1).max(6),
    misconceptions: z.array(z.string().min(1)).min(1).max(6),
  }),
  checklist: z.array(z.string().min(1)).min(1).max(8),
  flashcards: z.array(flashcardSchema).min(1).max(8),
  quiz: z.array(quizQuestionSchema).min(1).max(8),
  studyPlan: z.array(revisionSessionSchema).min(1).max(8),
  weakDrills: z.array(weakDrillSchema).min(1).max(8),
});

const quizAttemptSchema = z.object({
  questionId: z.string().min(1),
  selectedAnswer: z.string().min(1),
  correct: z.boolean(),
  concept: z.string().min(1),
  difficulty: difficultySchema,
  createdAt: z.string().min(1),
});

const progressSchema = z.object({
  completedChecklist: z.array(z.string().min(1)).max(20),
  flashcardsMastered: z.array(z.string().min(1)).max(20),
  topicRatings: z.record(z.string(), difficultySchema),
  quizAttempts: z.array(quizAttemptSchema).max(30),
  lastGeneratedPractice: z.array(quizQuestionSchema).max(8),
});

const requestSchema = z.object({
  pack: studyPackSchema,
  progress: progressSchema,
  requestedCount: z.number().int().min(3).max(8).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = requestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "This study session is out of date. Refresh the workspace or reload the demo, then try again." },
        { status: 400 },
      );
    }

    const body = parsed.data;
    const practice = await generateAdaptivePractice(
      body.pack,
      body.progress,
      body.requestedCount ?? 5,
    );

    return NextResponse.json(practice, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to create the weak-area drill right now.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
