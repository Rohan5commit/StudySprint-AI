import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "StudyPilot AI",
  description:
    "Build a personalized student study system with revision timetables, summaries, quizzes, flashcards, and last-minute revision mode.",
  keywords: [
    "StudyPilot AI",
    "student revision planner",
    "personalized study plan",
    "quiz generator",
    "flashcards",
    "NVIDIA NIM",
    "Genesis AI Buildathon",
  ],
  openGraph: {
    title: "StudyPilot AI",
    description:
      "A student study copilot that turns syllabus text and weak chapters into a personalized revision system.",
    url: "https://studypilot-ai-rohan-santhoshs-projects.vercel.app",
    siteName: "StudyPilot AI",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>{children}</body>
    </html>
  );
}
