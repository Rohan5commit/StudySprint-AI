import { buildAdaptivePracticeQuestions, buildFallbackStudyPack, deriveWeakTopics } from "@/lib/study-engine";
import type { Difficulty, Flashcard, ProgressState, QuizQuestion, RevisionSession, StudyGenerationInput, StudyPack, WeakDrill } from "@/lib/types";
import { clamp, normalizeWhitespace, slugify, unique } from "@/lib/utils";

const DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_MODEL = "openai/gpt-oss-20b";
const NVIDIA_TIMEOUT_MS = 10_000;

function getBaseUrl() {
  return (process.env.NVIDIA_NIM_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function getModel() {
  return process.env.NVIDIA_NIM_MODEL || DEFAULT_MODEL;
}

function stripFence(text: string) {
  return text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
}

function extractJsonObject(text: string) {
  const cleaned = stripFence(text);
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return a JSON object.");
  }

  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}

function summarizeError(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "AI generation timed out. StudyPilot switched to demo mode.";
    return error.message.slice(0, 180);
  }
  return "AI generation failed. Demo fallback used.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown) {
  return typeof value === "string" ? normalizeWhitespace(value) : "";
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => asString(entry)).filter(Boolean);
}

function asDifficulty(value: unknown, fallback: Difficulty): Difficulty {
  return value === "easy" || value === "medium" || value === "hard" ? value : fallback;
}

async function callNvidia(
  apiKey: string,
  messages: Array<{ role: "system" | "user"; content: string }>,
  maxTokens: number,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NVIDIA_TIMEOUT_MS);
  try {
    const response = await fetch(`${getBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({
        model: getModel(),
        temperature: 0,
        max_tokens: maxTokens,
        stream: false,
        messages,
      }),
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`NVIDIA NIM ${response.status}: ${text.slice(0, 220)}`);
    }

    const data = JSON.parse(text) as {
      choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
    };
    const content = data.choices?.[0]?.message?.content;

    if (Array.isArray(content)) {
      return content.map((part) => part.text ?? "").join("");
    }

    if (typeof content !== "string") {
      throw new Error("NVIDIA NIM returned an empty completion.");
    }

    return content;
  } finally {
    clearTimeout(timeout);
  }
}

function mergeWithFallback<T extends { id: string }>(
  primary: T[],
  fallback: T[],
  minimum: number,
  maximum: number,
) {
  const merged = [...primary];
  const ids = new Set(primary.map((item) => item.id));

  for (const item of fallback) {
    if (merged.length >= maximum) break;
    if (ids.has(item.id)) continue;
    merged.push(item);
    ids.add(item.id);
  }

  if (merged.length < minimum) {
    return fallback.slice(0, maximum);
  }

  return merged.slice(0, maximum);
}

function normalizeConcepts(raw: unknown, fallback: string[]) {
  const concepts = asStringArray(raw);
  if (!concepts.length) return fallback;
  return unique(concepts).slice(0, 6);
}

function normalizeSummary(raw: unknown, fallback: StudyPack["summary"], keyConcepts: string[]) {
  if (!isRecord(raw)) return fallback;

  return {
    short: asString(raw.short) || fallback.short,
    bullets:
      asStringArray(raw.bullets).slice(0, 4).length > 0
        ? asStringArray(raw.bullets).slice(0, 4)
        : fallback.bullets,
    misconceptions:
      asStringArray(raw.misconceptions).slice(0, 3).length > 0
        ? asStringArray(raw.misconceptions).slice(0, 3)
        : [
            fallback.misconceptions[0],
            `Avoid mixing up ${keyConcepts[0]} and ${keyConcepts[1] ?? keyConcepts[0]}.`,
          ].filter(Boolean),
  };
}

function normalizeFlashcards(raw: unknown, keyConcepts: string[], fallback: Flashcard[]) {
  if (!Array.isArray(raw)) return fallback;

  const cards = raw
    .map((entry, index) => {
      if (!isRecord(entry)) return null;
      const concept =
        asString(entry.concept) || keyConcepts[index] || fallback[index]?.concept || `Concept ${index + 1}`;
      const front =
        asString(entry.front) ||
        asString(entry.question) ||
        fallback[index]?.front ||
        `What should you remember about ${concept}?`;
      const back =
        asString(entry.back) ||
        asString(entry.answer) ||
        fallback[index]?.back ||
        `${concept} is a core idea from the study notes.`;

      return {
        id: `flashcard-${slugify(concept)}-${index + 1}`,
        concept,
        front,
        back,
      } satisfies Flashcard;
    })
    .filter((entry): entry is Flashcard => Boolean(entry));

  return mergeWithFallback(cards, fallback, 5, 6);
}

function normalizeQuizCollection(
  raw: unknown,
  keyConcepts: string[],
  fallback: QuizQuestion[],
  prefix: string,
) {
  if (!Array.isArray(raw)) return fallback;

  const questions = raw
    .map((entry, index) => {
      if (!isRecord(entry)) return null;
      const fallbackQuestion = fallback[index] ?? fallback[0];
      const concept =
        asString(entry.concept) || keyConcepts[index] || fallbackQuestion?.concept || `Concept ${index + 1}`;
      const question = asString(entry.question) || fallbackQuestion?.question || `What matters about ${concept}?`;
      const correctAnswer =
        asString(entry.correctAnswer) || asString(entry.answer) || fallbackQuestion?.correctAnswer || "Use the notes to answer.";
      const options = unique([
        correctAnswer,
        ...asStringArray(entry.options),
        ...(fallbackQuestion?.options ?? []),
      ]).slice(0, 4);

      while (options.length < 4) {
        options.push("Review the original notes and connect the concept back to the topic.");
      }

      return {
        id: `${prefix}-${slugify(concept)}-${index + 1}`,
        concept,
        question,
        options,
        correctAnswer,
        explanation:
          asString(entry.explanation) ||
          `Use the notes to justify why “${correctAnswer}” is correct for ${concept}.`,
        difficulty: asDifficulty(entry.difficulty, fallbackQuestion?.difficulty ?? (index < 2 ? "easy" : "medium")),
      } satisfies QuizQuestion;
    })
    .filter((entry): entry is QuizQuestion => Boolean(entry));

  return mergeWithFallback(questions, fallback, 5, 6);
}

function normalizeStudyPlan(
  raw: unknown,
  keyConcepts: string[],
  fallback: RevisionSession[],
) {
  if (Array.isArray(raw)) {
    const sessions = raw
      .map((entry, index) => {
        if (!isRecord(entry)) return null;
        return {
          id: `plan-${index + 1}`,
          dayLabel: asString(entry.dayLabel) || fallback[index]?.dayLabel || `Session ${index + 1}`,
          title: asString(entry.title) || fallback[index]?.title || `Revision sprint ${index + 1}`,
          focusConcepts: asStringArray(entry.focusConcepts).slice(0, 3).length
            ? asStringArray(entry.focusConcepts).slice(0, 3)
            : fallback[index]?.focusConcepts ?? keyConcepts.slice(index, index + 2),
          durationMinutes: typeof entry.durationMinutes === "number"
            ? entry.durationMinutes
            : fallback[index]?.durationMinutes ?? 60,
          objective: asString(entry.objective) || fallback[index]?.objective || `Review ${keyConcepts[index] ?? keyConcepts[0]}.`,
          tasks: asStringArray(entry.tasks).slice(0, 4).length
            ? asStringArray(entry.tasks).slice(0, 4)
            : fallback[index]?.tasks ?? [`Review ${keyConcepts[index] ?? keyConcepts[0]}.`],
        } satisfies RevisionSession;
      })
      .filter((entry): entry is RevisionSession => Boolean(entry));

    if (sessions.length) return mergeWithFallback(sessions, fallback, 4, 6);
  }

  if (isRecord(raw) && Array.isArray(raw.weeks)) {
    const weeks = raw.weeks
      .map((entry, index) => {
        if (!isRecord(entry)) return null;
        const weekNumber = typeof entry.week === "number" ? entry.week : index + 1;
        const hours = typeof entry.hours === "number" ? entry.hours : 2;
        const activities = asStringArray(entry.activities).slice(0, 4);
        return {
          id: `plan-${index + 1}`,
          dayLabel: `Week ${weekNumber}`,
          title: `Week ${weekNumber} sprint`,
          focusConcepts: fallback[index]?.focusConcepts ?? keyConcepts.slice(index, index + 2),
          durationMinutes: clamp(Math.round((hours * 60) / Math.max(activities.length, 1)), 45, 90),
          objective: activities[0] || fallback[index]?.objective || `Review ${keyConcepts[index] ?? keyConcepts[0]}.`,
          tasks: activities.length ? activities : fallback[index]?.tasks ?? [`Review ${keyConcepts[index] ?? keyConcepts[0]}.`],
        } satisfies RevisionSession;
      })
      .filter((entry): entry is RevisionSession => Boolean(entry));

    if (weeks.length) return mergeWithFallback(weeks, fallback, 4, 6);
  }

  return fallback;
}

function normalizeWeakDrills(raw: unknown, keyConcepts: string[], fallback: WeakDrill[]) {
  if (!Array.isArray(raw)) return fallback;

  const drills = raw
    .map((entry, index) => {
      if (!isRecord(entry)) return null;
      const concept =
        asString(entry.concept) || keyConcepts[index] || fallback[index]?.concept || `Concept ${index + 1}`;
      return {
        id: `drill-${slugify(concept)}-${index + 1}`,
        concept,
        question:
          asString(entry.question) ||
          asString(entry.exercise) ||
          fallback[index]?.question ||
          `Explain ${concept} using the study notes.`,
        answer:
          asString(entry.answer) ||
          fallback[index]?.answer ||
          `Use the source notes to explain ${concept}.`,
        hint:
          asString(entry.hint) ||
          `Start by defining ${concept}, then connect it to the wider topic.`,
        difficulty: asDifficulty(entry.difficulty, fallback[index]?.difficulty ?? "medium"),
      } satisfies WeakDrill;
    })
    .filter((entry): entry is WeakDrill => Boolean(entry));

  return mergeWithFallback(drills, fallback, 4, 4);
}

export async function generateStudyPack(input: StudyGenerationInput): Promise<StudyPack> {
  const fallback = buildFallbackStudyPack({
    ...input,
    provider: "demo-fallback",
    fallbackReason: undefined,
  });
  const apiKey = process.env.NVIDIA_NIM_API_KEY;

  if (!apiKey) {
    return {
      ...fallback,
      provider: input.provider === "instant-demo" ? "instant-demo" : "demo-fallback",
      fallbackReason: "No NVIDIA_NIM_API_KEY configured. StudyPilot switched to demo mode.",
    };
  }

  const prompt = {
    role: "user" as const,
    content: `Create a grounded study pack from the source notes below. Use only facts supported by the notes. If the notes are thin, keep explanations generic rather than inventing details. Return JSON only with this shape: { keyConcepts, summary: { short, bullets, misconceptions }, checklist, flashcards, quiz, studyPlan, weakDrills }.

Requirements:
- keyConcepts: 5 to 6 items
- checklist: 5 to 6 items
- flashcards: 5 to 6 items
- quiz: 5 to 6 multiple-choice questions
- studyPlan: 4 to 6 sessions
- weakDrills: exactly 4 drills
- Make the learning style visibly affect checklist wording and study-plan tasks.
- Keep every task short, concrete, and realistic for a student under time pressure.
- If the notes do not support a fact, stay generic instead of inventing details.

Subject: ${input.subject}
Topic: ${input.topic}
Exam date: ${input.examDate ?? "not provided"}
Available hours per week: ${input.availableHoursPerWeek ?? "not provided"}
Priority weak chapters/topics: ${(input.weakTopics ?? []).join(", ") || "not provided"}
Preferred learning style: ${input.learningStyle ?? "mixed"}
Seed concept hints: ${fallback.keyConcepts.join(", ")}

Source notes:\n${input.notes.slice(0, 9000)}`,
  };

  try {
    const content = await callNvidia(
      apiKey,
      [
        {
          role: "system",
          content:
            "You are a precise study assistant. Return valid JSON only. Keep every output useful for a student revising under time pressure. Do not fabricate unsupported facts.",
        },
        prompt,
      ],
      2200,
    );

    const parsed = extractJsonObject(content);
    const keyConcepts = normalizeConcepts(parsed.keyConcepts, fallback.keyConcepts);

    return {
      ...fallback,
      provider: "nvidia-nim",
      fallbackReason: undefined,
      keyConcepts,
      summary: normalizeSummary(parsed.summary, fallback.summary, keyConcepts),
      checklist: asStringArray(parsed.checklist).slice(0, 6).length
        ? asStringArray(parsed.checklist).slice(0, 6)
        : fallback.checklist,
      flashcards: normalizeFlashcards(parsed.flashcards, keyConcepts, fallback.flashcards),
      quiz: normalizeQuizCollection(parsed.quiz, keyConcepts, fallback.quiz, "quiz"),
      studyPlan: normalizeStudyPlan(parsed.studyPlan, keyConcepts, fallback.studyPlan),
      weakDrills: normalizeWeakDrills(parsed.weakDrills, keyConcepts, fallback.weakDrills),
    };
  } catch (error) {
    return {
      ...fallback,
      provider: "demo-fallback",
      fallbackReason: summarizeError(error),
    };
  }
}

export async function generateAdaptivePractice(
  pack: StudyPack,
  progress: ProgressState,
  requestedCount = 5,
): Promise<{ questions: QuizQuestion[]; provider: "nvidia-nim" | "demo-fallback"; fallbackReason?: string }> {
  const fallbackQuestions = buildAdaptivePracticeQuestions(pack, progress, requestedCount);
  const apiKey = process.env.NVIDIA_NIM_API_KEY;

  if (!apiKey) {
    return {
      questions: fallbackQuestions,
      provider: "demo-fallback",
      fallbackReason: "No NVIDIA_NIM_API_KEY configured. Generated fallback weak-topic questions for StudyPilot.",
    };
  }

  const weakTopics = deriveWeakTopics(pack, progress);

  try {
    const content = await callNvidia(
      apiKey,
      [
        {
          role: "system",
          content:
            "You generate grounded multiple-choice revision drills. Return valid JSON only in the shape { questions: [...] }. Do not fabricate unsupported facts.",
        },
        {
          role: "user",
          content: `Create exactly ${requestedCount} weak-area quiz questions for this student. Focus on these weak topics first: ${weakTopics.join(", ") || "use the most difficult concepts"}. Only use facts from the notes. Keep questions short, practical, and exam-style.

Topic: ${pack.topic}
Key concepts: ${pack.keyConcepts.join(", ")}
Source notes:\n${pack.inputText.slice(0, 9000)}`,
        },
      ],
      1400,
    );

    const parsed = extractJsonObject(content);
    const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : parsed.quiz;

    return {
      provider: "nvidia-nim",
      questions: normalizeQuizCollection(rawQuestions, pack.keyConcepts, fallbackQuestions, "practice").slice(0, requestedCount),
    };
  } catch (error) {
    return {
      questions: fallbackQuestions,
      provider: "demo-fallback",
      fallbackReason: summarizeError(error),
    };
  }
}
