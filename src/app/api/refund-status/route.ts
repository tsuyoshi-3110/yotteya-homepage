// app/api/refund-status/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";

type Body = {
  siteKey?: string;
  orderId?: string;
  itemName?: string; // 任意（商品単位で依頼済み判定したいとき）
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body | null;
    const siteKey = body?.siteKey || SITE_KEY;
    const orderId = body?.orderId;
    const itemName = body?.itemName;

    if (!orderId) {
      return NextResponse.json({ status: "none" as const });
    }

    // 1) siteOrders（正式な注文レコード）を優先判定
    //    ここで Firestore に保存された返金結果を見て「返金済み/一部返金」を返す。
    const orderSnap = await adminDb.collection("siteOrders").doc(orderId).get();
    if (orderSnap.exists) {
      const o = orderSnap.data() as any;

      // よく使うフィールド名に対応（いずれかが true/一致していれば返金済み扱い）
      const refundedFlag =
        o?.refunded === true ||
        o?.status === "refunded" ||
        o?.payment_status === "refunded" ||
        !!o?.refundId; // 単発返金の痕跡が doc に付く場合

      if (refundedFlag) {
        return NextResponse.json({ status: "refunded" as const });
      }

      // 一部返金の痕跡があれば processed 扱い（存在すれば true とするライトな判定）
      const partialFlag =
        (typeof o?.refundedAmount === "number" && o.refundedAmount > 0) ||
        (Array.isArray(o?.refunds) && o.refunds.length > 0);

      if (partialFlag) {
        return NextResponse.json({ status: "processed" as const });
      }
    }

    // 2) refundRequests の依頼履歴で補完（インデックス不要: すべて等価比較 & orderBy なし）
    //    商品単位で見たい場合のみ item.name で絞る。
    let baseQuery = adminDb
      .collection("refundRequests")
      .where("type", "==", "refundRequest")
      .where("siteKey", "==", siteKey)
      .where("orderId", "==", orderId);

    if (itemName) {
      baseQuery = baseQuery.where("item.name", "==", itemName);
    }

    // まずは確定系（refunded）
    let snap = await baseQuery.where("status", "==", "refunded").limit(1).get();
    if (!snap.empty) {
      return NextResponse.json({ status: "refunded" as const });
    }

    // 次に処理中・一部返金（processed）
    snap = await baseQuery.where("status", "==", "processed").limit(1).get();
    if (!snap.empty) {
      return NextResponse.json({ status: "processed" as const });
    }

    // 最後に依頼済み（requested）
    snap = await baseQuery.where("status", "==", "requested").limit(1).get();
    if (!snap.empty) {
      return NextResponse.json({ status: "requested" as const });
    }

    // どれも該当なし
    return NextResponse.json({ status: "none" as const });
  } catch (e) {
    console.error("[refund-status] error:", e);
    // エラー時も UI を止めない
    return NextResponse.json({ status: "none" as const });
  }
}
