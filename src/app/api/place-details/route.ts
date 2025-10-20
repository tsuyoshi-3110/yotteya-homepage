import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Out = { name?: string; formattedAddress?: string; lat?: number; lng?: number };

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") || "";
  return handler(id);
}

export async function POST(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  return handler(String(id));
}

async function handler(id: string) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return NextResponse.json({ error: "missing GOOGLE_MAPS_API_KEY" }, { status: 500 });

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", id);
  url.searchParams.set("fields", "place_id,name,formatted_address,geometry/location");
  url.searchParams.set("language", "ja");
  url.searchParams.set("region", "jp");
  url.searchParams.set("key", key);

  const r = await fetch(url.toString(), { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.status !== "OK") {
    return NextResponse.json(
      { error: "lookup failed", googleStatus: j?.status, googleError: j?.error_message },
      { status: 404 }
    );
  }

  const c = j.result;
  const out: Out = {
    name: c?.name,
    formattedAddress: c?.formatted_address,
    lat: c?.geometry?.location?.lat,
    lng: c?.geometry?.location?.lng,
  };
  return NextResponse.json(out);
}
