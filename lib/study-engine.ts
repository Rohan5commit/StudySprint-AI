import { demoPresets } from "@/lib/demo-presets";
import type {
  AppState,
  DemoPreset,
  Difficulty,
  ProgressState,
  QuizQuestion,
  RevisionSession,
  StudyGenerationInput,
  StudyPack,
  WeakDrill,
} from "@/lib/types";
import { clamp, daysUntil, normalizeWhitespace, percentage, shuffle, slugify, toTitleCase, unique } from "@/lib/utils";

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "about",
  "during",
  "after",
  "before",
  "while",
  "under",
  "over",
  "have",
  "has",
  "had",
  "your",
  "their",
  "they",
  "them",
  "also",
  "where",
  "when",
  "which",
  "each",
  "most",
  "more",
  "less",
  "than",
  "what",
  "does",
  "just",
  "because",
]);

function splitSentences(text: string) {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => normalizeWhitespace(sentence))
    .filter((sentence) => sentence.length > 24);
}

function cleanLine(line: string) {
  return line
    .replace(/^[-*•\d).\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningfulPhrase(line: string) {
  const candidate = cleanLine(line)
    .replace(/[;:,.]+$/g, "")
    .replace(/\((.*?)\)/g, "$1");

  const words = candidate.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 7) return null;

  const meaningfulWords = words.filter((word) => !STOP_WORDS.has(word.toLowerCase()));
  if (meaningfulWords.length < 1) return null;

  return toTitleCase(candidate);
}

function extractConcepts(subject: string, topic: string, notes: string) {
  const lines = notes.split(/\n+/).map(cleanLine).filter(Boolean);
  const concepts: string[] = [topic];

  for (const line of lines) {
    const heading = line.includes(":") ? line.split(":", 1)[0] : line;
    const phrase = meaningfulPhrase(heading);
    if (phrase) concepts.push(phrase);

    const phraseFromLine = meaningfulPhrase(line.split(",", 1)[0]);
    if (phraseFromLine) concepts.push(phraseFromLine);
  }

  const fallbackWords = notes
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 5 && !STOP_WORDS.has(word.toLowerCase()));

  for (const word of fallbackWords) {
    concepts.push(toTitleCase(word));
  }

  return unique(
    concepts
      .map((concept) => concept.trim())
      .filter(Boolean)
      .map((concept) => concept.replace(/\s+/g, " "))
      .filter((concept) => concept.toLowerCase() !== subject.toLowerCase()),
  ).slice(0, 6);
}

function buildExplanationLookup(concepts: string[], notes: string, topic: string) {
  const sentences = splitSentences(notes);
  const map = new Map<string, string>();

  for (const concept of concepts) {
    const lowered = concept.toLowerCase();
    const sentence =
      sentences.find((entry) => entry.toLowerCase().includes(lowered)) ??
      sentences.find((entry) =>
        lowered
          .split(/\s+/)
          .some((token) => token.length > 4 && entry.toLowerCase().includes(token)),
      );

    map.set(
      concept,
      sentence ?? `${concept} is an important idea that supports understanding ${topic}.`,
    );
  }

  return map;
}

function buildSummary(
  concepts: string[],
  explanationLookup: Map<string, string>,
  notes: string,
  topic: string,
) {
  const sentences = splitSentences(notes);
  const short = normalizeWhitespace(
    [sentences[0], sentences[1], sentences[2]].filter(Boolean).join(" "),
  ).slice(0, 420);

  const bullets = concepts.slice(0, 4).map((concept) => {
    const detail = explanationLookup.get(concept) ?? `${concept} matters in ${topic}.`;
    return normalizeWhitespace(`${concept}: ${detail}`).slice(0, 180);
  });

  const misconceptions = [
    `Do not memorize ${concepts[0]} in isolation; connect it back to the overall topic.`,
    `Avoid mixing up ${concepts[0]} and ${concepts[1] ?? concepts[0]}.`,
    `When revising ${topic}, focus on cause-and-effect or step-by-step links, not just definitions.`,
  ].slice(0, 3);

  return {
    short,
    bullets,
    misconceptions,
  };
}

function buildChecklist(concepts: string[]) {
  const verbs = ["Explain", "Compare", "Recall", "Apply", "Self-test on", "Teach"];

  return concepts.map((concept, index) => `${verbs[index % verbs.length]} ${concept} without reading your notes.`);
}

function buildFlashcards(concepts: string[], explanationLookup: Map<string, string>) {
  return concepts.slice(0, 6).map((concept, index) => ({
    id: `flashcard-${slugify(concept)}-${index + 1}`,
    concept,
    front: `What should you remember about ${concept}?`,
    back: (explanationLookup.get(concept) ?? `${concept} is a core idea to review.`).slice(0, 220),
  }));
}

function buildOptions(correct: string, distractors: string[]) {
  const options = unique([correct, ...shuffle(distractors)]).slice(0, 4);

  while (options.length < 4) {
    options.push(`It is a supporting point that is less central than the main concept.`);
  }

  return shuffle(options.slice(0, 4));
}

function buildQuizFromConcepts(
  concepts: string[],
  explanationLookup: Map<string, string>,
  topic: string,
  difficultyResolver: (concept: string, index: number) => Difficulty,
  prefix: string,
) {
  return concepts.slice(0, 6).map((concept, index) => {
    const correct = explanationLookup.get(concept) ?? `${concept} is a core idea in ${topic}.`;
    const distractors = concepts
      .filter((candidate) => candidate !== concept)
      .map(
        (candidate) =>
          explanationLookup.get(candidate) ?? `${candidate} is another concept from ${topic}.`,
      );

    const options = buildOptions(correct, [
      ...distractors,
      `It is not mentioned in the notes for ${topic}.`,
      `It only matters after the revision sprint is complete.`,
      `It is a minor detail that can be skipped safely.`,
    ]);

    return {
      id: `${prefix}-${slugify(concept)}-${index + 1}`,
      concept,
      question: `Which statement best captures ${concept}?`,
      options,
      correctAnswer: correct,
      explanation: `Use the source notes to anchor ${concept}: ${correct}`,
      difficulty: difficultyResolver(concept, index),
    } satisfies QuizQuestion;
  });
}

function buildStudyPlan(
  concepts: string[],
  checklist: string[],
  examDate?: string | null,
  availableHoursPerWeek?: number | null,
) {
  const countdown = daysUntil(examDate);
  const sessionCount = countdown
    ? clamp(countdown <= 7 ? 4 : Math.ceil(countdown / 4), 4, 6)
    : 4;
  const sessionDuration = clamp(
    Math.round((((availableHoursPerWeek ?? 6) * 60) / sessionCount) / 5) * 5,
    40,
    90,
  );

  return Array.from({ length: sessionCount }, (_, index) => {
    const focusConcepts = [
      concepts[index % concepts.length],
      concepts[(index + 1) % concepts.length],
    ].filter(Boolean);

    return {
      id: `plan-${index + 1}`,
      dayLabel: countdown ? `Day ${index + 1}` : `Session ${index + 1}`,
      title: `Revision sprint ${index + 1}`,
      focusConcepts,
      durationMinutes: sessionDuration,
      objective:
        index === sessionCount - 1
          ? "Pressure-test understanding and close weak spots."
          : `Lock in ${focusConcepts.join(" + ")}.`,
      tasks: [
        checklist[index % checklist.length],
        `Answer 5 quick questions on ${focusConcepts[0]}.`,
        index === sessionCount - 1
          ? "Run a timed recap and review every mistake."
          : `Teach ${focusConcepts[1] ?? focusConcepts[0]} aloud for 2 minutes.`,
      ],
    } satisfies RevisionSession;
  });
}

function buildWeakDrills(
  concepts: string[],
  explanationLookup: Map<string, string>,
  topic: string,
) {
  return concepts.slice(0, 4).map((concept, index) => ({
    id: `drill-${slugify(concept)}-${index + 1}`,
    concept,
    question: `Explain ${concept} in 2-3 sentences and connect it back to ${topic}.`,
    answer:
      explanationLookup.get(concept) ?? `${concept} should be explained using the original notes.`,
    hint: `Start with a definition of ${concept}, then explain why it matters.`,
    difficulty: index === 0 ? "medium" : "hard",
  })) satisfies WeakDrill[];
}

export function createEmptyProgress(): ProgressState {
  return {
    completedChecklist: [],
    flashcardsMastered: [],
    topicRatings: {},
    quizAttempts: [],
    lastGeneratedPractice: [],
  };
}

export function createProgressState(pack: StudyPack): ProgressState {
  return {
    ...createEmptyProgress(),
    topicRatings: Object.fromEntries(pack.keyConcepts.map((concept) => [concept, "medium" as Difficulty])),
  };
}

export function buildSeededDemoProgress(pack: StudyPack): ProgressState {
  const progress = createProgressState(pack);

  if (pack.checklist[0]) progress.completedChecklist = [pack.checklist[0]];
  if (pack.flashcards[0]) progress.flashcardsMastered = [pack.flashcards[0].id];
  if (pack.keyConcepts[0]) progress.topicRatings[pack.keyConcepts[0]] = "easy";
  if (pack.keyConcepts[1]) progress.topicRatings[pack.keyConcepts[1]] = "hard";
  if (pack.keyConcepts[2]) progress.topicRatings[pack.keyConcepts[2]] = "medium";

  progress.quizAttempts = pack.quiz.slice(0, 2).map((question, index) => ({
    questionId: question.id,
    selectedAnswer:
      index === 0
        ? question.correctAnswer
        : question.options.find((option) => option !== question.correctAnswer) ?? question.correctAnswer,
    correct: index === 0,
    concept: question.concept,
    difficulty: question.difficulty,
    createdAt: new Date().toISOString(),
  }));

  return progress;
}

export function deriveWeakTopics(pack: StudyPack, progress: ProgressState) {
  const scores = new Map<string, number>();

  for (const concept of pack.keyConcepts) {
    const rating = progress.topicRatings[concept] ?? "medium";
    scores.set(concept, rating === "hard" ? 3 : rating === "medium" ? 1 : 0);
  }

  for (const attempt of progress.quizAttempts) {
    if (!attempt.correct) {
      scores.set(attempt.concept, (scores.get(attempt.concept) ?? 0) + 2);
    }
  }

  for (const drill of pack.weakDrills) {
    scores.set(drill.concept, (scores.get(drill.concept) ?? 0) + 1);
  }

  return [...scores.entries()]
    .sort((left, right) => right[1] - left[1])
    .filter((entry) => entry[1] > 0)
    .map(([concept]) => concept)
    .slice(0, 4);
}

export function getChecklistProgress(pack: StudyPack, progress: ProgressState) {
  return percentage(progress.completedChecklist.length, pack.checklist.length);
}

export function getFlashcardProgress(pack: StudyPack, progress: ProgressState) {
  return percentage(progress.flashcardsMastered.length, pack.flashcards.length);
}

export function getQuizAccuracy(progress: ProgressState) {
  const correct = progress.quizAttempts.filter((attempt) => attempt.correct).length;
  return percentage(correct, progress.quizAttempts.length);
}

export function buildAdaptivePracticeQuestions(
  pack: StudyPack,
  progress: ProgressState,
  requestedCount = 5,
) {
  const explanationLookup = new Map<string, string>(
    pack.flashcards.map((card) => [card.concept, card.back]),
  );
  const weakConcepts = deriveWeakTopics(pack, progress);
  const focus = unique([
    ...weakConcepts,
    ...pack.keyConcepts.filter((concept) => !weakConcepts.includes(concept)),
  ]).slice(0, Math.max(requestedCount, 4));

  return buildQuizFromConcepts(
    focus,
    explanationLookup,
    pack.topic,
    (concept, index) => {
      const rating = progress.topicRatings[concept] ?? "medium";
      if (rating === "hard") return "hard";
      return index < 2 ? "medium" : "hard";
    },
    "practice",
  ).slice(0, requestedCount);
}

export function buildFallbackStudyPack(input: StudyGenerationInput): StudyPack {
  const notes = normalizeWhitespace(input.notes);
  const prioritizedWeakTopics = unique(
    (input.weakTopics ?? [])
      .map((entry) => toTitleCase(entry.trim()))
      .filter(Boolean),
  ).slice(0, 4);
  const keyConcepts = unique([
    ...prioritizedWeakTopics,
    ...extractConcepts(input.subject, input.topic, notes),
  ]).slice(0, 6);
  const explanationLookup = buildExplanationLookup(keyConcepts, notes, input.topic);
  const summary = buildSummary(keyConcepts, explanationLookup, notes, input.topic);
  const checklist = buildChecklist(keyConcepts);
  const flashcards = buildFlashcards(keyConcepts, explanationLookup);
  const quiz = buildQuizFromConcepts(
    keyConcepts,
    explanationLookup,
    input.topic,
    (_, index) => (index < 2 ? "easy" : index < 4 ? "medium" : "hard"),
    "quiz",
  );
  const studyPlan = buildStudyPlan(
    keyConcepts,
    checklist,
    input.examDate,
    input.availableHoursPerWeek,
  );
  const weakDrills = buildWeakDrills(keyConcepts, explanationLookup, input.topic);

  return {
    id: `pack-${slugify(`${input.subject}-${input.topic}`)}`,
    subject: input.subject,
    topic: input.topic,
    inputText: notes,
    examDate: input.examDate ?? null,
    availableHoursPerWeek: input.availableHoursPerWeek ?? null,
    generatedAt: new Date().toISOString(),
    provider: input.provider ?? "demo-fallback",
    fallbackReason: input.fallbackReason,
    sourcePresetId: input.sourcePresetId ?? null,
    weakTopicsInput: prioritizedWeakTopics,
    learningStyle: input.learningStyle ?? null,
    keyConcepts,
    summary,
    checklist,
    flashcards,
    quiz,
    studyPlan,
    weakDrills,
  };
}

export function findPresetById(presetId?: string | null): DemoPreset | undefined {
  if (!presetId) return undefined;
  return demoPresets.find((preset) => preset.id === presetId);
}

export function buildInstantDemoState(presetId: string): AppState {
  const preset = findPresetById(presetId) ?? demoPresets[0];
  const pack = buildFallbackStudyPack({
    ...preset,
    sourcePresetId: preset.id,
    provider: "instant-demo",
  });

  return {
    currentPack: pack,
    progress: buildSeededDemoProgress(pack),
    lastError: null,
  };
}
