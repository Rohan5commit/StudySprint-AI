import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateStudyPack } from "@/lib/ai";

const requestSchema = z.object({
  subject: z.string().trim().min(2).max(80),
  topic: z.string().trim().min(2).max(120),
  notes: z.string().trim().min(24).max(12_000),
  examDate: z.string().trim().nullable().optional(),
  availableHoursPerWeek: z.number().min(1).max(40).nullable().optional(),
  weakTopics: z.array(z.string().trim().min(1).max(80)).max(8).nullable().optional(),
  learningStyle: z.enum(["visual", "practice-first", "step-by-step", "mixed"]).nullable().optional(),
  selectedPresetId: z.string().trim().nullable().optional(),
});

function formatValidationError(error: z.ZodError) {
  const issue = error.issues[0];
  const field = issue?.path[0];

  if (field === "subject") return "Please enter a subject name.";
  if (field === "topic") return "Please enter the chapter, unit, or exam topic.";
  if (field === "notes") {
    if (issue.code === "too_small") return "Please paste at least 2-3 lines of notes so StudyPilot has enough context.";
    if (issue.code === "too_big") return "Please keep the notes under 12,000 characters for a fast, reliable demo.";
    return "Please paste valid text notes before generating the study system.";
  }
  if (field === "availableHoursPerWeek") return "Study hours should be between 1 and 40 hours per week.";
  if (field === "weakTopics") return "Please keep weak topics to 8 short entries or fewer.";
  if (field === "learningStyle") return "Please choose one of the available learning styles.";
  if (field === "examDate") return "Please enter a valid exam date.";

  return "Please check the study input and try again.";
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = requestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: formatValidationError(parsed.error) },
        { status: 400 },
      );
    }

    const body = parsed.data;
    const studyPack = await generateStudyPack({
      subject: body.subject,
      topic: body.topic,
      notes: body.notes,
      examDate: body.examDate ?? null,
      availableHoursPerWeek: body.availableHoursPerWeek ?? null,
      weakTopics: body.weakTopics ?? null,
      learningStyle: body.learningStyle ?? null,
      sourcePresetId: body.selectedPresetId ?? null,
    });

    return NextResponse.json({ studyPack }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "StudyPilot could not generate a study system right now.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
