// web/app/api/v1/runs/[date]/route.ts
//
// One run, by date. Every committed run is prerendered at build time, so this
// is a static file per date with no runtime lookup.
import { NextResponse } from "next/server";
import { loadAllRuns } from "@/lib/data/load";
import { runPayload } from "@/lib/api/v1";

export const dynamic = "force-static";
/** A date that was never measured is a 404, not an empty run. */
export const dynamicParams = false;

export function generateStaticParams() {
  return loadAllRuns().map((r) => ({ date: r.date_string }));
}

export function GET(_request: Request, { params }: { params: { date: string } }) {
  const run = loadAllRuns().find((r) => r.date_string === params.date);
  if (!run) {
    return NextResponse.json({ error: `No run for date ${params.date}` }, { status: 404 });
  }
  return NextResponse.json(runPayload(run));
}
