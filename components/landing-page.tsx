"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Brain,
  CalendarDays,
  CheckCircle2,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { demoPresets } from "@/lib/demo-presets";
import { loadInstantDemoPack } from "@/lib/store";

const featureCards = [
  {
    title: "Personalized study plan",
    body: "Turns exam date, weekly study hours, and topic urgency into a realistic revision timetable.",
    icon: CalendarDays,
  },
  {
    title: "Weak-area prioritization",
    body: "Pushes weak chapters and low-confidence concepts to the top so students revise what matters first.",
    icon: Target,
  },
  {
    title: "Active recall outputs",
    body: "Generates summaries, chapter checklists, quizzes, and flashcards instead of generic AI paragraphs.",
    icon: Brain,
  },
  {
    title: "Progress tracker",
    body: "Checklist completion, quiz accuracy, and flashcard mastery stay visible in one polished dashboard.",
    icon: BarChart3,
  },
];

const outputHighlights = [
  "Personalized revision timetable",
  "Chapter-by-chapter checklist",
  "Quick summaries + misconceptions",
  "Quiz mode + flashcards",
  "Last-minute revision mode",
];

export function LandingPage() {
  const router = useRouter();

  const launchInstantDemo = () => {
    loadInstantDemoPack(demoPresets[0].id);
    router.push("/dashboard");
  };

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="surface-card overflow-hidden p-8 sm:p-10">
          <div className="inline-flex rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">
            Genesis: The AI Buildathon 2026
          </div>

          <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            StudyPilot AI
          </h1>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300 sm:text-xl">
            A student web app that turns subjects, exam dates, weak chapters, free hours, and learning style into a personalized study system.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={launchInstantDemo}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300"
            >
              Launch judge demo
              <ArrowRight className="h-4 w-4" />
            </button>
            <Link
              href="/workspace"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Start onboarding
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-300">
            <span className="pill-chip">Next.js + TypeScript + Tailwind</span>
            <span className="pill-chip">NVIDIA NIM assisted generation</span>
            <span className="pill-chip">Demo mode always works</span>
          </div>
        </div>

        <div className="surface-card p-8">
          <div className="flex items-center gap-3 text-white">
            <Trophy className="h-5 w-5 text-amber-300" />
            <h2 className="text-xl font-semibold">Judge-friendly in under 30 seconds</h2>
          </div>

          <div className="mt-6 space-y-3">
            {outputHighlights.map((item) => (
              <div key={item} className="subtle-card flex items-center gap-3 px-4 py-3 text-sm text-slate-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-3xl border border-sky-400/20 bg-sky-400/8 p-5">
            <div className="flex items-start gap-3">
              <Target className="mt-0.5 h-5 w-5 text-sky-200" />
              <div>
                <h3 className="text-sm font-semibold text-white">Why it stands out</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  StudyPilot AI solves a real student problem with a simple product story: what should I study first, and how do I revise fast? It feels useful, polished, and fully demoable in one sprint.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {featureCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.title} className="surface-card p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-200">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{card.body}</p>
            </article>
          );
        })}
      </section>

      <section className="mt-6 surface-card p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="pill-chip">Demo sample data</span>
            <h2 className="mt-3 text-2xl font-semibold text-white">Open a polished student workflow instantly</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Judges can start from a realistic preset immediately, or switch to onboarding and enter their own subject details.
            </p>
          </div>
          <Link href="/workspace" className="text-sm font-semibold text-sky-200 hover:text-sky-100">
            Open workspace →
          </Link>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {demoPresets.map((preset) => (
            <article key={preset.id} className="subtle-card p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="pill-chip">{preset.subject}</span>
                <span className="text-xs uppercase tracking-[0.22em] text-slate-400">{preset.availableHoursPerWeek}h/week</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">{preset.topic}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{preset.highlight}</p>
              <p className="mt-4 rounded-2xl border border-white/6 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
                Focus: {preset.focus}
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.22em] text-slate-400">Exam date: {preset.examDate}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
