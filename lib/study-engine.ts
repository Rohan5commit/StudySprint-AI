import { demoPresets } from "@/lib/demo-presets";
import type {
  AppState,
  DemoPreset,
  Difficulty,
  LearningStyle,
  ProgressState,
  QuizQuestion,
  RevisionSession,
  StudyGenerationInput,
  StudyPack,
  WeakDrill,
} from "@/lib/types";
import {
  clamp,
  createSeededRandom,
  daysUntil,
  normalizeWhitespace,
  percentage,
  shuffle,
  slugify,
  toTitleCase,
  unique,
} from "@/lib/utils";

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

const GENERIC_FALLBACK_WORDS = new Set([
  "cellular",
  "respiration",
  "process",
  "system",
  "revision",
  "students",
  "student",
  "important",
  "concept",
  "energy",
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

function getStyleLabel(learningStyle?: LearningStyle | null) {
  if (learningStyle === "visual") return "visual";
  if (learningStyle === "practice-first") return "practice-first";
  if (learningStyle === "step-by-step") return "step-by-step";
  return "mixed";
}

function splitConceptHints(value: string) {
  return value
    .split(/[,\n;]+/)
    .map((entry) => cleanLine(entry))
    .map((entry) => toTitleCase(entry))
    .filter(Boolean)
    .slice(0, 6);
}

function collectSentencePhrases(notes: string) {
  return splitSentences(notes)
    .flatMap((sentence) => sentence.split(/[,:;]|\band\b|\bwhile\b/gi))
    .map((entry) => meaningfulPhrase(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function buildConceptHints(input: StudyGenerationInput) {
  const preset = findPresetById(input.sourcePresetId);
  const hints = [...(input.weakTopics ?? [])];

  if (
    preset &&
    preset.subject === input.subject &&
    preset.topic === input.topic &&
    normalizeWhitespace(preset.notes) === normalizeWhitespace(input.notes)
  ) {
    hints.push(...splitConceptHints(preset.focus));
  }

  return unique(hints.map((entry) => toTitleCase(cleanLine(entry))).filter(Boolean)).slice(0, 6);
}

function extractConcepts(
  subject: string,
  topic: string,
  notes: string,
  conceptHints: string[] = [],
) {
  const lines = notes.split(/\n+/).map(cleanLine).filter(Boolean);
  const topicTokens = new Set(
    topic
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 3),
  );
  const concepts: string[] = [topic, ...conceptHints, ...collectSentencePhrases(notes)];

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
    .filter((word) => {
      const lowered = word.toLowerCase();
      return (
        word.length > 5 &&
        !STOP_WORDS.has(lowered) &&
        !GENERIC_FALLBACK_WORDS.has(lowered) &&
        !topicTokens.has(lowered)
      );
    });

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
  learningStyle?: LearningStyle | null,
) {
  const sentences = splitSentences(notes);
  const short = normalizeWhitespace(
    [sentences[0], sentences[1], sentences[2]].filter(Boolean).join(" "),
  ).slice(0, 420);
  const styleLabel = getStyleLabel(learningStyle);

  const bullets = concepts.slice(0, 4).map((concept) => {
    const detail = explanationLookup.get(concept) ?? `${concept} matters in ${topic}.`;
    const prefix =
      styleLabel === "visual"
        ? "Visual anchor"
        : styleLabel === "practice-first"
          ? "Fast recall cue"
          : styleLabel === "step-by-step"
            ? "Sequence anchor"
            : concept;

    return normalizeWhitespace(
      styleLabel === "mixed" ? `${concept}: ${detail}` : `${prefix} — ${concept}: ${detail}`,
    ).slice(0, 180);
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

function buildChecklist(concepts: string[], learningStyle?: LearningStyle | null) {
  const styleLabel = getStyleLabel(learningStyle);
  const verbs =
    styleLabel === "visual"
      ? ["Map", "Sketch", "Label", "Trace", "Visualize", "Teach"]
      : styleLabel === "practice-first"
        ? ["Self-test on", "Answer", "Drill", "Recall", "Apply", "Teach"]
        : styleLabel === "step-by-step"
          ? ["List the steps in", "Walk through", "Order", "Trace", "Explain", "Teach"]
          : ["Explain", "Compare", "Recall", "Apply", "Self-test on", "Teach"];

  return concepts.map((concept, index) => `${verbs[index % verbs.length]} ${concept} without reading your notes.`);
}

function buildFlashcards(
  concepts: string[],
  explanationLookup: Map<string, string>,
  learningStyle?: LearningStyle | null,
) {
  const styleLabel = getStyleLabel(learningStyle);

  return concepts.slice(0, 6).map((concept, index) => ({
    id: `flashcard-${slugify(concept)}-${index + 1}`,
    concept,
    front:
      styleLabel === "visual"
        ? `What diagram or visual cue helps you remember ${concept}?`
        : styleLabel === "practice-first"
          ? `Quick recall: what is the key exam fact about ${concept}?`
          : styleLabel === "step-by-step"
            ? `What is the step-by-step story for ${concept}?`
            : `What should you remember about ${concept}?`,
    back: (explanationLookup.get(concept) ?? `${concept} is a core idea to review.`).slice(0, 220),
  }));
}

function buildOptions(
  correct: string,
  distractors: string[],
  random: () => number,
) {
  const options = unique([correct, ...shuffle(distractors, random)]).slice(0, 4);

  while (options.length < 4) {
    options.push(`It is a supporting point that is less central than the main concept.`);
  }

  return shuffle(options.slice(0, 4), random);
}

function buildQuizFromConcepts(
  concepts: string[],
  explanationLookup: Map<string, string>,
  topic: string,
  difficultyResolver: (concept: string, index: number) => Difficulty,
  prefix: string,
  random: () => number,
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
    ], random);

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
  learningStyle?: LearningStyle | null,
  weakTopics: string[] = [],
) {
  const countdown = daysUntil(examDate);
  const sessionCount = countdown
    ? clamp(countdown <= 7 ? 4 : Math.ceil(countdown / 4), 4, 6)
    : 4;
  const styleLabel = getStyleLabel(learningStyle);
  const sessionDuration = clamp(
    Math.round((((availableHoursPerWeek ?? 6) * 60) / sessionCount) / 5) * 5,
    40,
    90,
  );
  const prioritizedConcepts = unique([...weakTopics, ...concepts]).filter(Boolean);

  return Array.from({ length: sessionCount }, (_, index) => {
    const focusConcepts = [
      prioritizedConcepts[index % prioritizedConcepts.length],
      prioritizedConcepts[(index + 1) % prioritizedConcepts.length],
    ].filter(Boolean);
    const styleSpecificTask =
      styleLabel === "visual"
        ? `Sketch a quick flowchart or diagram for ${focusConcepts[0]}.`
        : styleLabel === "practice-first"
          ? `Do a closed-book recall drill on ${focusConcepts[0]}.`
          : styleLabel === "step-by-step"
            ? `Write the steps of ${focusConcepts[0]} in the correct order.`
            : `Answer 5 quick questions on ${focusConcepts[0]}.`;
    const teachingTask =
      styleLabel === "visual"
        ? `Annotate how ${focusConcepts[1] ?? focusConcepts[0]} connects to the big picture.`
        : styleLabel === "practice-first"
          ? `Finish with one exam-style mini question on ${focusConcepts[1] ?? focusConcepts[0]}.`
          : styleLabel === "step-by-step"
            ? `Teach ${focusConcepts[1] ?? focusConcepts[0]} aloud in sequence for 2 minutes.`
            : `Teach ${focusConcepts[1] ?? focusConcepts[0]} aloud for 2 minutes.`;

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
        styleSpecificTask,
        index === sessionCount - 1
          ? "Run a timed recap and review every mistake."
          : teachingTask,
      ],
    } satisfies RevisionSession;
  });
}

function buildWeakDrills(
  concepts: string[],
  explanationLookup: Map<string, string>,
  topic: string,
  learningStyle?: LearningStyle | null,
) {
  const styleLabel = getStyleLabel(learningStyle);

  return concepts.slice(0, 4).map((concept, index) => ({
    id: `drill-${slugify(concept)}-${index + 1}`,
    concept,
    question: `Explain ${concept} in 2-3 sentences and connect it back to ${topic}.`,
    answer:
      explanationLookup.get(concept) ?? `${concept} should be explained using the original notes.`,
    hint:
      styleLabel === "visual"
        ? `Start with the biggest visual cue for ${concept}, then explain why it matters.`
        : styleLabel === "practice-first"
          ? `Give the exam answer first, then support it with one note-based reason.`
          : styleLabel === "step-by-step"
            ? `Start at step 1, then explain how the sequence moves forward.`
            : `Start with a definition of ${concept}, then explain why it matters.`,
    difficulty: index === 0 ? "medium" : "hard",
  })) satisfies WeakDrill[];
}

export function findEvidenceForConcept(notes: string, concept: string) {
  const sentences = splitSentences(notes);
  const lowered = concept.toLowerCase();

  return (
    sentences.find((entry) => entry.toLowerCase().includes(lowered)) ??
    sentences.find((entry) =>
      lowered
        .split(/\s+/)
        .some((token) => token.length > 4 && entry.toLowerCase().includes(token)),
    ) ??
    sentences[0] ??
    ""
  );
}

export function extractGroundingSnippets(notes: string, concepts: string[], limit = 3) {
  return unique(
    concepts
      .map((concept) => findEvidenceForConcept(notes, concept))
      .filter(Boolean)
      .map((entry) => entry.slice(0, 220)),
  ).slice(0, limit);
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
    createSeededRandom(`${pack.id}-${focus.join("|")}-practice-${requestedCount}`),
  ).slice(0, requestedCount);
}

export function adaptStudyPlanForProgress(pack: StudyPack, progress: ProgressState) {
  const weakTopics = deriveWeakTopics(pack, progress);

  if (!weakTopics.length) return pack.studyPlan;

  return pack.studyPlan.map((session, index) => {
    const priorityConcept = weakTopics[index % weakTopics.length];
    const focusConcepts = unique([priorityConcept, ...session.focusConcepts]).slice(0, 3);
    const tasks = unique([
      `Priority review: self-test ${priorityConcept} before reopening your notes.`,
      ...session.tasks,
    ]).slice(0, 4);
    const objective = session.objective.toLowerCase().includes(priorityConcept.toLowerCase())
      ? session.objective
      : `Prioritize ${priorityConcept} first. ${session.objective}`;

    return {
      ...session,
      focusConcepts,
      tasks,
      objective,
    };
  });
}

export function buildFallbackStudyPack(input: StudyGenerationInput): StudyPack {
  const notes = normalizeWhitespace(input.notes);
  const conceptHints = buildConceptHints(input);
  const prioritizedWeakTopics = unique(
    (input.weakTopics ?? [])
      .map((entry) => toTitleCase(entry.trim()))
      .filter(Boolean),
  ).slice(0, 4);
  const keyConcepts = unique([
    ...prioritizedWeakTopics,
    ...conceptHints,
    ...extractConcepts(input.subject, input.topic, notes, conceptHints),
  ]).slice(0, 6);
  const seededRandom = createSeededRandom(
    `${input.subject}|${input.topic}|${input.learningStyle ?? "mixed"}|${notes.slice(0, 400)}`,
  );
  const explanationLookup = buildExplanationLookup(keyConcepts, notes, input.topic);
  const summary = buildSummary(
    keyConcepts,
    explanationLookup,
    notes,
    input.topic,
    input.learningStyle,
  );
  const checklist = buildChecklist(keyConcepts, input.learningStyle);
  const flashcards = buildFlashcards(keyConcepts, explanationLookup, input.learningStyle);
  const quiz = buildQuizFromConcepts(
    keyConcepts,
    explanationLookup,
    input.topic,
    (_, index) => (index < 2 ? "easy" : index < 4 ? "medium" : "hard"),
    "quiz",
    seededRandom,
  );
  const studyPlan = buildStudyPlan(
    keyConcepts,
    checklist,
    input.examDate,
    input.availableHoursPerWeek,
    input.learningStyle,
    prioritizedWeakTopics,
  );
  const weakDrills = buildWeakDrills(
    keyConcepts,
    explanationLookup,
    input.topic,
    input.learningStyle,
  );

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
