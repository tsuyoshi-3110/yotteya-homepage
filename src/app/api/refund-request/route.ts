// app/api/refund-request/route.ts
// Node ランタイムでメール送信を使うため
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import nodemailer from "nodemailer";
import { google } from "googleapis";

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN,
  GOOGLE_REDIRECT_URI,
  GOOGLE_SENDER_EMAIL,
  ADMIN_NOTIFY_EMAIL, // あれば優先。なければ送信元にフォールバック
} = process.env as Record<string, string>;

const oauth2 = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);
oauth2.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });

type RefundItem = { name: string; qty: number; unitAmount: number };
type RefundPayload = {
  // どちらかを受け付ける：docId か 直接ペイロード
  docId?: string;

  // 直接ペイロード用（docIdが無い場合に使用）
  siteKey?: string;
  orderId?: string;
  item?: RefundItem;
  customer?: { name?: string; email?: string; phone?: string };
  addressText?: string;
  reason?: string | null;
};

function jpy(n: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
  }).format(n);
}

async function sendMail(lines: string[], subject: string) {
  const accessToken = await oauth2.getAccessToken(); // 無くても refreshToken から自動取得されます
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      type: "OAuth2",
      user: GOOGLE_SENDER_EMAIL,
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      refreshToken: GOOGLE_REFRESH_TOKEN,
      accessToken: accessToken?.token ?? undefined,
    },
  });

  const to = ADMIN_NOTIFY_EMAIL || GOOGLE_SENDER_EMAIL;
  await transporter.sendMail({
    from: GOOGLE_SENDER_EMAIL,
    to,
    subject,
    text: lines.join("\n"),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RefundPayload | null;
    if (!body) {
      return NextResponse.json(
        { ok: false, error: "invalid_body" },
        { status: 400 }
      );
    }

    // 1) docId が来たら、refundRequests から読み取って送信
    if (body.docId) {
      const snap = await adminDb
        .collection("refundRequests")
        .doc(body.docId)
        .get();
      if (!snap.exists) {
        return NextResponse.json(
          { ok: false, error: "not_found" },
          { status: 404 }
        );
      }
      const d = snap.data() as any;

      const siteKey = d.siteKey || SITE_KEY;
      const subject = `[返金依頼] ${siteKey} / 注文 ${d.orderId}`;
      const lines = [
        `サイト: ${siteKey}`,
        `注文ID: ${d.orderId}`,
        `商品: ${d.item?.name ?? ""} ×${d.item?.qty ?? 1}（${jpy(
          Number(d.item?.unitAmount || 0)
        )}）`,
        `顧客: ${d.customer?.name ?? ""}`,
        `メール: ${d.customer?.email ?? ""}`,
        `電話: ${d.customer?.phone ?? ""}`,
        `住所: ${d.addressText ?? ""}`,
        `理由: ${d.reason ?? ""}`,
        `ログID: ${snap.id}`,
      ];

      await sendMail(lines, subject);
      await snap.ref.update({
        notifyStatus: "sent",
        notifiedAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({ ok: true, id: snap.id });
    }

    // 2) docId が無い場合は、直接ペイロードでログ作成 → 送信
    const { siteKey, orderId, item } = body;
    if (!orderId || !item?.name || !Number.isFinite(item?.unitAmount)) {
      return NextResponse.json(
        { ok: false, error: "invalid_payload" },
        { status: 400 }
      );
    }

    const docData = {
      type: "refundRequest",
      siteKey: siteKey || SITE_KEY,
      orderId,
      item: {
        name: item.name,
        qty: Number(item.qty || 1),
        unitAmount: Number(item.unitAmount || 0),
      },
      customer: body.customer ?? null,
      addressText: body.addressText ?? "",
      reason: (body.reason ?? "") || null,
      status: "requested" as const,
      createdAt: FieldValue.serverTimestamp(),
    };
    const ref = await adminDb.collection("refundRequests").add(docData);

    const subject = `[返金依頼] ${docData.siteKey} / 注文 ${orderId}`;
    const lines = [
      `サイト: ${docData.siteKey}`,
      `注文ID: ${orderId}`,
      `商品: ${item.name} ×${item.qty ?? 1}（${jpy(
        Number(item.unitAmount || 0)
      )}）`,
      `顧客: ${body.customer?.name ?? ""}`,
      `メール: ${body.customer?.email ?? ""}`,
      `電話: ${body.customer?.phone ?? ""}`,
      `住所: ${body.addressText ?? ""}`,
      `理由: ${body.reason ?? ""}`,
      `ログID: ${ref.id}`,
    ];

    await sendMail(lines, subject);
    await ref.update({
      notifyStatus: "sent",
      notifiedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, id: ref.id });
  } catch (e) {
    console.error("[refund-request] error:", e);
    const msg =
      e instanceof Error
        ? e.message
        : typeof e === "string"
        ? e
        : JSON.stringify(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
