import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const idToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!idToken) {
    return NextResponse.json(
      { error: "Pageitへログインしてください。" },
      { status: 401 },
    );
  }

  try {
    await adminAuth.verifyIdToken(idToken, true);
  } catch {
    return NextResponse.json(
      { error: "Pageitのログイン情報を確認できませんでした。" },
      { status: 401 },
    );
  }

  const xenocardUrl = (
    process.env.XENOCARD_URL || "https://xeno-card.vercel.app"
  ).replace(/\/$/, "");

  try {
    const response = await fetch(`${xenocardUrl}/api/sso/start`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
      cache: "no-store",
    });
    const json = (await response.json().catch(() => null)) as {
      redirectUrl?: string;
      error?: string;
    } | null;

    if (!response.ok || !json?.redirectUrl) {
      return NextResponse.json(
        {
          error:
            json?.error ||
            "XenoCardのSSO APIがまだ利用できません。XenoCardを起動またはデプロイしてください。",
        },
        { status: response.status || 502 },
      );
    }

    return NextResponse.json({ redirectUrl: json.redirectUrl });
  } catch {
    return NextResponse.json(
      { error: "XenoCardへ接続できませんでした。" },
      { status: 502 },
    );
  }
}
