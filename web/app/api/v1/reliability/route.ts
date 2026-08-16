// app/api/v1/reliability/route.ts
//
// Prerendered to static JSON at build time — no runtime cost, no database.
// See web/lib/api/v1.ts for the projection rules.
import { NextResponse } from "next/server";
import { reliabilityPayload } from "@/lib/api/v1";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(reliabilityPayload());
}
