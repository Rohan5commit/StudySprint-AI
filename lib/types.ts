export type Difficulty = "easy" | "medium" | "hard";
export type SourceMode = "nvidia-nim" | "demo-fallback" | "instant-demo";
export type LearningStyle = "visual" | "practice-first" | "step-by-step" | "mixed";

export interface SummaryBlock {
  short: string;
  bullets: string[];
  misconceptions: string[];
}

export interface Flashcard {
  id: string;
  concept: string;
  front: string;
  back: string;
}

export interface QuizQuestion {
  id: string;
  concept: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: Difficulty;
}

export interface RevisionSession {
  id: string;
  dayLabel: string;
  title: string;
  focusConcepts: string[];
  durationMinutes: number;
  objective: string;
  tasks: string[];
}

export interface WeakDrill {
  id: string;
  concept: string;
  question: string;
  answer: string;
  hint: string;
  difficulty: Difficulty;
}

export interface StudyGenerationInput {
  subject: string;
  topic: string;
  notes: string;
  examDate?: string | null;
  availableHoursPerWeek?: number | null;
  weakTopics?: string[] | null;
  learningStyle?: LearningStyle | null;
  sourcePresetId?: string | null;
  provider?: SourceMode;
  fallbackReason?: string;
}

export interface StudyPack {
  id: string;
  subject: string;
  topic: string;
  inputText: string;
  examDate?: string | null;
  availableHoursPerWeek?: number | null;
  weakTopicsInput: string[];
  learningStyle?: LearningStyle | null;
  generatedAt: string;
  provider: SourceMode;
  fallbackReason?: string;
  sourcePresetId?: string | null;
  keyConcepts: string[];
  summary: SummaryBlock;
  checklist: string[];
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
  studyPlan: RevisionSession[];
  weakDrills: WeakDrill[];
}

export interface DemoPreset {
  id: string;
  subject: string;
  topic: string;
  notes: string;
  examDate: string;
  availableHoursPerWeek: number;
  highlight: string;
  focus: string;
}

export interface QuizAttempt {
  questionId: string;
  selectedAnswer: string;
  correct: boolean;
  concept: string;
  difficulty: Difficulty;
  createdAt: string;
}

export interface ProgressState {
  completedChecklist: string[];
  flashcardsMastered: string[];
  topicRatings: Record<string, Difficulty>;
  quizAttempts: QuizAttempt[];
  lastGeneratedPractice: QuizQuestion[];
}

export interface AppState {
  currentPack: StudyPack | null;
  progress: ProgressState;
  lastError: string | null;
}
