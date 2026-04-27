"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Brain, Loader2, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { clearPracticeQuestions, recordQuizAttempt, setPracticeQuestions, useStudyStore } from "@/lib/store";
import type { QuizAttempt, QuizQuestion } from "@/lib/types";

function latestAttemptsByQuestion(attempts: QuizAttempt[]) {
  const map = new Map<string, QuizAttempt>();
  for (const attempt of attempts) map.set(attempt.questionId, attempt);
  return map;
}

export function QuizScreen() {
  const { currentPack, progress } = useStudyStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerNote, setProviderNote] = useState<string | null>(null);

  const activeAttempts = useMemo(
    () => latestAttemptsByQuestion(progress.quizAttempts),
    [progress.quizAttempts],
  );

  if (!currentPack) {
    return (
      <AppShell
        eyebrow="Quiz"
        title="No study pack loaded"
        description="Generate a pack first so StudyPilot can create a quiz from your notes."
        actions={
          <Link href="/workspace" className="rounded-2xl bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950">
            Open workspace
          </Link>
        }
      >
        <div className="surface-card p-8 text-sm leading-7 text-slate-300">
          The quiz view adapts to weak areas after you rate topics or answer initial questions.
        </div>
      </AppShell>
    );
  }

  const questions = progress.lastGeneratedPractice.length
    ? progress.lastGeneratedPractice
    : currentPack.quiz;
  const score = questions.filter((question) => activeAttempts.get(question.id)?.correct).length;

  const requestWeakDrill = async () => {
    setLoading(true);
    setError(null);
    setProviderNote(null);

    try {
      const response = await fetch("/api/practice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pack: currentPack,
          progress,
          requestedCount: 5,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create practice questions.");
      }

      setPracticeQuestions(payload.questions);
      if (payload.fallbackReason) setProviderNote(payload.fallbackReason);
    } catch (practiceError) {
      setError(practiceError instanceof Error ? practiceError.message : "Practice generation failed.");
    } finally {
      setLoading(false);
    }
  };

  const answerQuestion = (question: QuizQuestion, option: string) => {
    if (activeAttempts.has(question.id)) return;
    recordQuizAttempt(question, option);
  };

  return (
    <AppShell
      eyebrow="Quiz + weak-area drill"
      title="Practice from the exact notes you loaded"
      description="Start with the generated quiz, then request a weak-topic drill focused on hard ratings and wrong answers."
      actions={
        <>
          <button
            onClick={requestWeakDrill}
            disabled={loading}
            className="rounded-2xl bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
          >
            {loading ? "Generating drill..." : "Generate weak-area drill"}
          </button>
          {progress.lastGeneratedPractice.length ? (
            <button
              onClick={clearPracticeQuestions}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Reset to core quiz
            </button>
          ) : null}
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div className="surface-card p-5">
          <div className="flex items-center gap-3 text-white">
            <Brain className="h-5 w-5 text-sky-200" />
            <span className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">Current mode</span>
          </div>
          <p className="mt-4 text-2xl font-semibold text-white">
            {progress.lastGeneratedPractice.length ? "Adaptive drill" : "Core quiz"}
          </p>
          <p className="mt-2 text-sm text-slate-400">{questions.length} questions active</p>
        </div>
        <div className="surface-card p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">Answered</p>
          <p className="mt-4 text-2xl font-semibold text-white">{activeAttempts.size}</p>
          <p className="mt-2 text-sm text-slate-400">Attempts are saved across screens.</p>
        </div>
        <div className="surface-card p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">Score on this set</p>
          <p className="mt-4 text-2xl font-semibold text-white">{score}/{questions.length}</p>
          <p className="mt-2 text-sm text-slate-400">Mistakes feed into the next drill.</p>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}
      {providerNote ? (
        <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          {providerNote}
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        {questions.map((question, index) => {
          const attempt = activeAttempts.get(question.id);
          return (
            <article key={question.id} className="surface-card p-6 sm:p-7">
              <div className="flex flex-wrap items-center gap-3">
                <span className="pill-chip">Question {index + 1}</span>
                <span className="pill-chip">{question.concept}</span>
                <span className="pill-chip">{question.difficulty}</span>
              </div>

              <h2 className="mt-4 text-lg font-semibold text-white">{question.question}</h2>

              <div className="mt-5 grid gap-3">
                {question.options.map((option) => {
                  const correct = option === question.correctAnswer;
                  const selected = attempt?.selectedAnswer === option;
                  const answered = Boolean(attempt);
                  const classes = answered
                    ? correct
                      ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-50"
                      : selected
                        ? "border-rose-300/40 bg-rose-400/10 text-rose-100"
                        : "border-white/8 bg-white/5 text-slate-300"
                    : "border-white/8 bg-white/5 text-slate-200 hover:bg-white/8";

                  return (
                    <button
                      key={option}
                      onClick={() => answerQuestion(question, option)}
                      className={`rounded-2xl border px-4 py-3 text-left text-sm leading-6 transition ${classes}`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              {attempt ? (
                <div className="mt-4 rounded-2xl border border-white/8 bg-slate-950/60 px-4 py-4 text-sm leading-6 text-slate-200">
                  <p className="font-semibold text-white">
                    {attempt.correct ? "Correct." : "Not quite."}
                  </p>
                  <p className="mt-2">{question.explanation}</p>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-3 text-sm text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          Building a new drill around the weakest concepts...
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={requestWeakDrill}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh weak-area drill
        </button>
        <Link href="/dashboard" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10">
          Back to dashboard
        </Link>
      </div>
    </AppShell>
  );
}
