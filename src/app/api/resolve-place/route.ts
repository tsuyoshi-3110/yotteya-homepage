// app/api/resolve-place/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Resolved = {
  placeId?: string;
  lat?: number;
  lng?: number;
  formattedAddress?: string;
  source?: "findplace" | "textsearch" | "geocode";
};

type StepLog = {
  step: "findplace" | "textsearch" | "geocode";
  requestUrl: string;
  httpStatus?: number;
  ok?: boolean;
  googleStatus?: string;
  googleError?: string;
  note?: string;
  sample?: any; // 返却JSONの一部
};

const oneLine = (s: string) =>
  (s ?? "")
    .replace(/\s+/g, " ")
    .replace(/[\r\n]+/g, " ")
    .trim();

function slice(s: string, n = 1200) {
  return s.length > n ? s.slice(0, n) + "...(truncated)" : s;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name") || "";
  const address = searchParams.get("address") || "";
  const debug = searchParams.get("debug") === "1";
  return handler(name, address, debug);
}

export async function POST(req: Request) {
  try {
    const { name, address, debug } = await req.json();
    if (!name || !address) {
      return NextResponse.json(
        { error: "name and address required" },
        { status: 400 }
      );
    }
    return handler(String(name), String(address), !!debug);
  } catch {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }
}

async function handler(nameRaw: string, addressRaw: string, debug = false) {
  // ❗ ここは「公開」ではなくサーバー秘密鍵を使う
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "missing GOOGLE_MAPS_API_KEY" },
      { status: 500 }
    );
  }

  // 入力正規化（解決率UP）
  const name = oneLine(nameRaw);
  const address = oneLine(addressRaw);
  const query = `${name} ${address}`.trim();

  const common = { language: "ja", region: "jp" as const };
  const steps: StepLog[] = [];

  // ヘルパー: fetch→テキスト→JSON化まで
  const grab = async (u: URL, step: StepLog["step"]) => {
    const reqUrl = u.toString();
    try {
      const r = await fetch(reqUrl, { cache: "no-store" });
      const txt = await r.text();
      const httpStatus = r.status;
      let j: any = null;
      try {
        j = JSON.parse(txt);
      } catch {
        /* noop */
      }

      const log: StepLog = {
        step,
        requestUrl: reqUrl,
        httpStatus,
        ok: r.ok,
        googleStatus: j?.status,
        googleError: j?.error_message,
        sample: debug
          ? typeof j === "object"
            ? pickPreview(j)
            : slice(txt)
          : undefined,
      };
      steps.push(log);
      return { httpStatus, ok: r.ok, json: j, raw: txt };
    } catch (e: any) {
      steps.push({
        step,
        requestUrl: reqUrl,
        note: `fetch error: ${String(e?.message || e)}`,
      });
      return { httpStatus: 0, ok: false, json: null, raw: "" };
    }
  };

  // 1) Find Place From Text
  {
    const url = new URL(
      "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
    );
    url.searchParams.set("input", query);
    url.searchParams.set("inputtype", "textquery");
    url.searchParams.set(
      "fields",
      "place_id,name,geometry/location,formatted_address,business_status"
    );
    url.searchParams.set("language", common.language);
    url.searchParams.set("region", common.region);
    url.searchParams.set("key", key);

    const { ok, json } = await grab(url, "findplace");
    if (
      ok &&
      json?.status === "OK" &&
      Array.isArray(json.candidates) &&
      json.candidates.length
    ) {
      const c = json.candidates[0];
      const out: Resolved = {
        placeId: c.place_id,
        lat: c.geometry?.location?.lat,
        lng: c.geometry?.location?.lng,
        formattedAddress: c.formatted_address,
        source: "findplace",
      };
      return NextResponse.json(
        debug
          ? { ...out, debug: { normalized: { name, address, query }, steps } }
          : out
      );
    }
  }

  // 2) Text Search（Find Placeで拾えないときの保険）
  {
    const url = new URL(
      "https://maps.googleapis.com/maps/api/place/textsearch/json"
    );
    url.searchParams.set("query", query);
    url.searchParams.set("language", common.language);
    url.searchParams.set("region", common.region);
    url.searchParams.set("key", key);

    const { ok, json } = await grab(url, "textsearch");
    if (
      ok &&
      json?.status === "OK" &&
      Array.isArray(json.results) &&
      json.results.length
    ) {
      const c = json.results[0];
      const out: Resolved = {
        placeId: c.place_id,
        lat: c.geometry?.location?.lat,
        lng: c.geometry?.location?.lng,
        formattedAddress: c.formatted_address,
        source: "textsearch",
      };
      return NextResponse.json(
        debug
          ? { ...out, debug: { normalized: { name, address, query }, steps } }
          : out
      );
    }
  }

  // 3) Geocoding（住所のみで座標取得＋place_id）
  {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", address);
    url.searchParams.set("language", common.language);
    url.searchParams.set("region", common.region);
    url.searchParams.set("key", key);

    const { ok, json } = await grab(url, "geocode");
    if (!ok) {
      return NextResponse.json(
        {
          error: "upstream http error",
          debug: debug
            ? { normalized: { name, address, query }, steps }
            : undefined,
        },
        { status: 502 }
      );
    }
    if (
      json?.status !== "OK" ||
      !Array.isArray(json?.results) ||
      json.results.length === 0
    ) {
      return NextResponse.json(
        {
          error: "not found",
          googleStatus: json?.status,
          googleError: json?.error_message,
          debug: debug
            ? { normalized: { name, address, query }, steps }
            : undefined,
        },
        { status: 404 }
      );
    }
    const g = json.results[0];
    const out: Resolved = {
      placeId: g.place_id,
      lat: g.geometry?.location?.lat,
      lng: g.geometry?.location?.lng,
      formattedAddress: g.formatted_address,
      source: "geocode",
    };
    return NextResponse.json(
      debug
        ? { ...out, debug: { normalized: { name, address, query }, steps } }
        : out
    );
  }
}

// でかいJSONを少量サンプル化（個人情報配慮）
function pickPreview(j: any) {
  if (!j || typeof j !== "object") return j;
  const shallow: any = {};
  for (const k of Object.keys(j)) {
    if (k === "candidates" && Array.isArray(j[k]) && j[k][0]) {
      shallow[k] = [minifyCandidate(j[k][0])];
    } else if (k === "results" && Array.isArray(j[k]) && j[k][0]) {
      shallow[k] = [minifyCandidate(j[k][0])];
    } else if (k === "result" && j[k]) {
      shallow[k] = minifyCandidate(j[k]);
    } else if (["status", "error_message"].includes(k)) {
      shallow[k] = j[k];
    }
  }
  return shallow;
}

function minifyCandidate(c: any) {
  return {
    place_id: c?.place_id,
    formatted_address: c?.formatted_address,
    name: c?.name,
    geometry: { location: c?.geometry?.location },
    business_status: c?.business_status,
    types: c?.types?.slice?.(0, 3),
  };
}
