import { NextResponse } from "next/server";
import { search } from "@/lib/services/search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  if (query.trim().length < 2) return NextResponse.json({ results: [] });
  try {
    return NextResponse.json({ results: search(query, 24) });
  } catch {
    return NextResponse.json({ results: [], error: "Search failed." }, { status: 500 });
  }
}
