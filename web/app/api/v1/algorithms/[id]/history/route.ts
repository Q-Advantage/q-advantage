// web/app/api/v1/algorithms/[id]/history/route.ts
//
// The full measured series for one algorithm across every committed run —
// all nine timing fields per operation, not the three the sparkline needed.
// Prerendered per algorithm at build time.
import { NextResponse } from "next/server";
import { loadAllRuns } from "@/lib/data/load";
import { historyPayload } from "@/lib/api/v1";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  const ids = new Set<string>();
  for (const run of loadAllRuns()) {
    for (const a of run.algorithms) ids.add(a.id);
  }
  return [...ids].map((id) => ({ id }));
}

export function GET(_request: Request, { params }: { params: { id: string } }) {
  const payload = historyPayload(params.id);
  if (!payload) {
    return NextResponse.json({ error: `No algorithm with id ${params.id}` }, { status: 404 });
  }
  return NextResponse.json(payload);
}
