import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateStudyPack } from "@/lib/ai";

const requestSchema = z.object({
  subject: z.string().min(2).max(80),
  topic: z.string().min(2).max(120),
  notes: z.string().min(24).max(12000),
  examDate: z.string().nullable().optional(),
  availableHoursPerWeek: z.number().min(1).max(40).nullable().optional(),
  weakTopics: z.array(z.string().min(1).max(80)).max(8).nullable().optional(),
  learningStyle: z.enum(["visual", "practice-first", "step-by-step", "mixed"]).nullable().optional(),
  selectedPresetId: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());
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
    const message = error instanceof Error ? error.message : "Unable to generate study pack.";
    const status =
      message.toLowerCase().includes("required") || message.toLowerCase().includes("expected")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
