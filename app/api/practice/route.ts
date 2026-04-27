import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateAdaptivePractice } from "@/lib/ai";
import type { ProgressState, StudyPack } from "@/lib/types";

const requestSchema = z.object({
  pack: z.custom<StudyPack>(
    (value) => Boolean(value && typeof value === "object"),
    "Invalid study pack payload.",
  ),
  progress: z.custom<ProgressState>(
    (value) => Boolean(value && typeof value === "object"),
    "Invalid progress payload.",
  ),
  requestedCount: z.number().int().min(3).max(8).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());
    const practice = await generateAdaptivePractice(
      body.pack,
      body.progress,
      body.requestedCount ?? 5,
    );

    return NextResponse.json(practice, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create weak-area drill.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
