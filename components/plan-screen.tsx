"use client";

import Link from "next/link";
import { BarChart3, CalendarDays, Target, Zap } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  adaptStudyPlanForProgress,
  deriveWeakTopics,
  getChecklistProgress,
  getQuizAccuracy,
} from "@/lib/study-engine";
import { useStudyStore } from "@/lib/store";
import { daysUntil, formatLongDate } from "@/lib/utils";

export function PlanScreen() {
  const { currentPack, progress } = useStudyStore();

  if (!currentPack) {
    return (
      <AppShell
        eyebrow="Study plan"
        title="No personalized plan available yet"
        description="Generate a study pack to see the timetable, progress roll-up, and last-minute revision mode."
        actions={
          <Link href="/workspace" className="rounded-2xl bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950">
            Open workspace
          </Link>
        }
      >
        <div className="surface-card p-8 text-sm leading-7 text-slate-300">
          The plan view connects exam timing, free hours, weak chapters, and current progress into one simple revision schedule.
        </div>
      </AppShell>
    );
  }

  const weakTopics = deriveWeakTopics(currentPack, progress);
  const checklistProgress = getChecklistProgress(currentPack, progress);
  const quizAccuracy = getQuizAccuracy(progress);
  const nextTask = currentPack.checklist.find((item) => !progress.completedChecklist.includes(item));
  const examCountdown = daysUntil(currentPack.examDate);
  const lastMinuteFocus = [...new Set([...(currentPack.weakTopicsInput ?? []), ...weakTopics, ...currentPack.keyConcepts])].slice(0, 3);
  const adaptedPlan = adaptStudyPlanForProgress(currentPack, progress);

  return (
    <AppShell
      eyebrow="Study plan"
      title="A personalized revision timetable that adapts to exam pressure"
      description="StudyPilot spreads the highest-value concepts across short sessions, then re-prioritizes the focus when you mark topics hard or miss quiz questions."
      actions={
        <Link href="/dashboard" className="rounded-2xl bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950">
          Back to dashboard
        </Link>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div className="surface-card p-5">
          <div className="flex items-center gap-3 text-white">
            <CalendarDays className="h-5 w-5 text-sky-200" />
            <span className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">Exam timing</span>
          </div>
          <p className="mt-4 text-2xl font-semibold text-white">
            {examCountdown === null ? "Flexible" : `${examCountdown} days left`}
          </p>
          <p className="mt-2 text-sm text-slate-400">{formatLongDate(currentPack.examDate)}</p>
        </div>
        <div className="surface-card p-5">
          <div className="flex items-center gap-3 text-white">
            <Target className="h-5 w-5 text-sky-200" />
            <span className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">Next best move</span>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-200">{nextTask ?? "All checklist items completed. Run a timed recap next."}</p>
        </div>
        <div className="surface-card p-5">
          <div className="flex items-center gap-3 text-white">
            <BarChart3 className="h-5 w-5 text-sky-200" />
            <span className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">Readiness</span>
          </div>
          <p className="mt-4 text-2xl font-semibold text-white">{Math.round((checklistProgress + quizAccuracy) / 2)}%</p>
          <p className="mt-2 text-sm text-slate-400">Blend of checklist progress and quiz accuracy.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="surface-card p-6 sm:p-7">
          <h2 className="text-xl font-semibold text-white">Personalized revision timetable</h2>
          <div className="mt-5 space-y-4">
            {adaptedPlan.map((session) => (
              <article key={session.id} className="subtle-card p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">{session.dayLabel}</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">{session.title}</h3>
                  </div>
                  <span className="pill-chip">{session.durationMinutes} min</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{session.objective}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {session.focusConcepts.map((concept) => (
                    <span key={concept} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200">
                      {concept}
                    </span>
                  ))}
                </div>
                <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-200">
                  {session.tasks.map((task) => (
                    <li key={task}>• {task}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="surface-card p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-amber-300" />
              <h2 className="text-xl font-semibold text-white">Last-minute revision mode</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              This is the 20-minute rescue path for the final stretch before the exam. It prioritizes the most urgent weak concepts first.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {lastMinuteFocus.map((concept) => (
                <span key={concept} className="rounded-full border border-amber-300/30 bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-100">
                  {concept}
                </span>
              ))}
            </div>
            <ol className="mt-5 space-y-3 text-sm leading-6 text-slate-200">
              <li className="subtle-card px-4 py-3">1. Read the short summary once and say the main story out loud.</li>
              <li className="subtle-card px-4 py-3">2. Self-test the top weak concepts before reopening notes.</li>
              <li className="subtle-card px-4 py-3">3. Flip through the flashcards and finish with one fast quiz round.</li>
            </ol>
          </div>

          <div className="surface-card p-6 sm:p-7">
            <h2 className="text-xl font-semibold text-white">Priority weak chapters</h2>
            {weakTopics.length ? (
              <div className="mt-4 flex flex-wrap gap-3">
                {weakTopics.map((concept) => (
                  <span key={concept} className="rounded-full border border-rose-300/30 bg-rose-400/10 px-4 py-2 text-sm font-medium text-rose-100">
                    {concept}
                  </span>
                ))}
              </div>
            ) : currentPack.weakTopicsInput.length ? (
              <div className="mt-4 flex flex-wrap gap-3">
                {currentPack.weakTopicsInput.map((concept) => (
                  <span key={concept} className="rounded-full border border-rose-300/30 bg-rose-400/10 px-4 py-2 text-sm font-medium text-rose-100">
                    {concept}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-300">
                No weak topics recorded yet. Rate concepts or take the quiz to adapt the plan.
              </p>
            )}
          </div>

          <div className="surface-card p-6 sm:p-7">
            <h2 className="text-xl font-semibold text-white">Study settings</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-200">
              <div className="subtle-card px-4 py-3">
                <span className="text-slate-400">Subject:</span> {currentPack.subject}
              </div>
              <div className="subtle-card px-4 py-3">
                <span className="text-slate-400">Topic:</span> {currentPack.topic}
              </div>
              <div className="subtle-card px-4 py-3">
                <span className="text-slate-400">Hours per week:</span> {currentPack.availableHoursPerWeek ?? "Flexible"}
              </div>
              <div className="subtle-card px-4 py-3">
                <span className="text-slate-400">Learning style:</span> {currentPack.learningStyle ?? "Mixed"}
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
