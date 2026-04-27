"use client";

import Link from "next/link";
import { BarChart3, BookOpen, CalendarDays, CheckCircle2, Target } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  adaptStudyPlanForProgress,
  deriveWeakTopics,
  extractGroundingSnippets,
  getChecklistProgress,
  getFlashcardProgress,
  getQuizAccuracy,
} from "@/lib/study-engine";
import { resetStudyState, setTopicRating, toggleChecklistItem, useStudyStore } from "@/lib/store";
import { daysUntil, formatLongDate } from "@/lib/utils";

const providerLabels = {
  "nvidia-nim": "NVIDIA NIM",
  "demo-fallback": "Demo fallback",
  "instant-demo": "Instant demo",
};

export function DashboardScreen() {
  const { currentPack, progress } = useStudyStore();

  if (!currentPack) {
    return (
      <AppShell
        eyebrow="Dashboard"
        title="No study pack loaded yet"
        description="Generate a pack from the workspace or launch the instant demo to see the complete judge flow."
        actions={
          <Link href="/workspace" className="rounded-2xl bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950">
            Open workspace
          </Link>
        }
      >
        <div className="surface-card p-8 text-sm leading-7 text-slate-300">
          StudyPilot AI stores the current study system in local browser state so judges can move between the dashboard, quiz, flashcards, and study plan without needing a database.
        </div>
      </AppShell>
    );
  }

  const weakTopics = deriveWeakTopics(currentPack, progress);
  const checklistProgress = getChecklistProgress(currentPack, progress);
  const flashcardProgress = getFlashcardProgress(currentPack, progress);
  const quizAccuracy = getQuizAccuracy(progress);
  const daysLeft = daysUntil(currentPack.examDate);
  const adaptedPlan = adaptStudyPlanForProgress(currentPack, progress);
  const groundingSnippets = extractGroundingSnippets(currentPack.inputText, currentPack.keyConcepts, 3);

  return (
    <AppShell
      eyebrow="Progress dashboard"
      title={currentPack.topic}
      description="Track readiness across summary review, checklist completion, flashcard mastery, and priority weak-topic practice."
      actions={
        <>
          <Link href="/quiz" className="rounded-2xl bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950">
            Start quiz
          </Link>
          <button
            onClick={resetStudyState}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            Reset session
          </button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Checklist", value: `${checklistProgress}%`, hint: `${progress.completedChecklist.length}/${currentPack.checklist.length} completed`, icon: CheckCircle2 },
          { label: "Quiz accuracy", value: `${quizAccuracy}%`, hint: `${progress.quizAttempts.length} attempts recorded`, icon: BarChart3 },
          { label: "Flashcards", value: `${flashcardProgress}%`, hint: `${progress.flashcardsMastered.length}/${currentPack.flashcards.length} mastered`, icon: BookOpen },
          { label: "Exam runway", value: daysLeft === null ? "Flexible" : `${daysLeft} days`, hint: formatLongDate(currentPack.examDate), icon: CalendarDays },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="surface-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300">{card.label}</span>
                <Icon className="h-5 w-5 text-sky-200" />
              </div>
              <p className="mt-4 text-3xl font-semibold text-white">{card.value}</p>
              <p className="mt-2 text-sm text-slate-400">{card.hint}</p>
            </article>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="surface-card p-6 sm:p-7">
          <div className="flex flex-wrap items-center gap-3">
            <span className="pill-chip">{providerLabels[currentPack.provider]}</span>
            {currentPack.fallbackReason ? <span className="pill-chip">{currentPack.fallbackReason}</span> : null}
          </div>

          <h2 className="mt-5 text-2xl font-semibold text-white">Summary snapshot</h2>
          <p className="mt-3 text-sm leading-7 text-slate-200">{currentPack.summary.short}</p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="subtle-card p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">Key bullets</h3>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-200">
                {currentPack.summary.bullets.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
            <div className="subtle-card p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">Misconception watchlist</h3>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-200">
                {currentPack.summary.misconceptions.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-6 subtle-card p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">Grounded in your notes</h3>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-200">
              {groundingSnippets.map((snippet) => (
                <li key={snippet}>“{snippet}”</li>
              ))}
            </ul>
          </div>

          <div className="mt-6">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-sky-200" />
              <h3 className="text-lg font-semibold text-white">Topic confidence</h3>
            </div>
            <div className="mt-4 space-y-4">
              {currentPack.keyConcepts.map((concept) => {
                const rating = progress.topicRatings[concept] ?? "medium";
                return (
                  <div key={concept} className="subtle-card p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-semibold text-white">{concept}</p>
                      <div className="flex gap-2">
                        {(["easy", "medium", "hard"] as const).map((difficulty) => (
                          <button
                            key={difficulty}
                            onClick={() => setTopicRating(concept, difficulty)}
                            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                              rating === difficulty
                                ? difficulty === "hard"
                                  ? "bg-rose-400 text-slate-950"
                                  : difficulty === "medium"
                                    ? "bg-amber-300 text-slate-950"
                                    : "bg-emerald-300 text-slate-950"
                                : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                            }`}
                          >
                            {difficulty}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="surface-card p-6 sm:p-7">
            <h2 className="text-xl font-semibold text-white">Revision checklist</h2>
            <div className="mt-4 space-y-3">
              {currentPack.checklist.map((item) => {
                const checked = progress.completedChecklist.includes(item);
                return (
                  <button
                    key={item}
                    onClick={() => toggleChecklistItem(item)}
                    className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                      checked
                        ? "border-emerald-300/40 bg-emerald-300/10"
                        : "border-white/8 bg-white/5 hover:bg-white/8"
                    }`}
                  >
                    <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${checked ? "text-emerald-300" : "text-slate-500"}`} />
                    <span className="text-sm leading-6 text-slate-200">{item}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="surface-card p-6 sm:p-7">
            <h2 className="text-xl font-semibold text-white">Weak-topic focus</h2>
            {weakTopics.length ? (
              <div className="mt-4 flex flex-wrap gap-3">
                {weakTopics.map((topic) => (
                  <span key={topic} className="rounded-full border border-rose-300/30 bg-rose-400/10 px-4 py-2 text-sm font-medium text-rose-100">
                    {topic}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-300">
                No weak topics yet. Rate concepts or attempt a quiz to unlock adaptive drills.
              </p>
            )}

            <div className="mt-6 grid gap-3">
              {adaptedPlan.slice(0, 2).map((session) => (
                <div key={session.id} className="subtle-card p-4">
                  <p className="text-sm font-semibold text-white">{session.dayLabel}: {session.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{session.objective}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
