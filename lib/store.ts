"use client";

import { useSyncExternalStore } from "react";
import { buildInstantDemoState, createEmptyProgress, createProgressState } from "@/lib/study-engine";
import type { AppState, Difficulty, ProgressState, QuizQuestion, StudyPack } from "@/lib/types";

const STORAGE_KEY = "studypilot-ai::state";
const listeners = new Set<() => void>();

function getDefaultState(): AppState {
  return {
    currentPack: null,
    progress: createEmptyProgress(),
    lastError: null,
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) listener();
}

function safeParse(raw: string | null): AppState {
  if (!raw) return getDefaultState();

  try {
    const parsed = JSON.parse(raw) as AppState;
    return {
      currentPack: parsed.currentPack ?? null,
      progress: parsed.progress ?? createEmptyProgress(),
      lastError: parsed.lastError ?? null,
    };
  } catch {
    return getDefaultState();
  }
}

function readSnapshot(): AppState {
  if (typeof window === "undefined") return getDefaultState();
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

function writeSnapshot(state: AppState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  emit();
}

function updateState(updater: (state: AppState) => AppState) {
  writeSnapshot(updater(readSnapshot()));
}

export function useStudyStore() {
  return useSyncExternalStore(subscribe, readSnapshot, getDefaultState);
}

export function resetStudyState() {
  writeSnapshot(getDefaultState());
}

export function saveGeneratedPack(pack: StudyPack) {
  writeSnapshot({
    currentPack: pack,
    progress: createProgressState(pack),
    lastError: null,
  });
}

export function loadInstantDemoPack(presetId: string) {
  const state = buildInstantDemoState(presetId);
  writeSnapshot(state);
  return state.currentPack;
}

export function toggleChecklistItem(item: string) {
  updateState((state) => {
    const completed = new Set(state.progress.completedChecklist);

    if (completed.has(item)) completed.delete(item);
    else completed.add(item);

    return {
      ...state,
      progress: {
        ...state.progress,
        completedChecklist: [...completed],
      },
    };
  });
}

export function toggleFlashcardMastered(flashcardId: string) {
  updateState((state) => {
    const mastered = new Set(state.progress.flashcardsMastered);

    if (mastered.has(flashcardId)) mastered.delete(flashcardId);
    else mastered.add(flashcardId);

    return {
      ...state,
      progress: {
        ...state.progress,
        flashcardsMastered: [...mastered],
      },
    };
  });
}

export function setTopicRating(concept: string, difficulty: Difficulty) {
  updateState((state) => ({
    ...state,
    progress: {
      ...state.progress,
      topicRatings: {
        ...state.progress.topicRatings,
        [concept]: difficulty,
      },
    },
  }));
}

export function recordQuizAttempt(question: QuizQuestion, selectedAnswer: string) {
  updateState((state) => {
    const nextAttempts = state.progress.quizAttempts.filter(
      (attempt) => attempt.questionId !== question.id,
    );

    nextAttempts.push({
      questionId: question.id,
      selectedAnswer,
      correct: selectedAnswer === question.correctAnswer,
      concept: question.concept,
      difficulty: question.difficulty,
      createdAt: new Date().toISOString(),
    });

    return {
      ...state,
      progress: {
        ...state.progress,
        quizAttempts: nextAttempts,
      },
    };
  });
}

export function setPracticeQuestions(questions: QuizQuestion[]) {
  updateState((state) => ({
    ...state,
    progress: {
      ...state.progress,
      lastGeneratedPractice: questions,
    },
  }));
}

export function clearPracticeQuestions() {
  updateState((state) => ({
    ...state,
    progress: {
      ...state.progress,
      lastGeneratedPractice: [],
    },
  }));
}

export function hydrateProgress(progress: ProgressState) {
  updateState((state) => ({
    ...state,
    progress,
  }));
}
