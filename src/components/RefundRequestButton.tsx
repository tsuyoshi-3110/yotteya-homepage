"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { Loader2 } from "lucide-react";

type OrderItem = { name: string; qty: number; unitAmount: number };
type RefundStatus = "none" | "requested" | "processed" | "refunded";

export default function RefundRequestButton({
  siteKey,
  orderId,
  item,
  customerName,
  customerEmail,
  customerPhone,
  addressText,
}: {
  siteKey: string;
  orderId: string;
  item: OrderItem;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  addressText?: string;
}) {
  const [sending, setSending] = useState(false);
  const [remoteStatus, setRemoteStatus] = useState<RefundStatus>("none");

  // サイズは統一（高さ:32px / 最小幅:96px）
  const BTN_BASE =
    "inline-flex items-center justify-center rounded border px-3 text-xs h-8 min-w-[96px] whitespace-nowrap";

  // 初期表示でサーバーから状態を取得（保持）
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const res = await fetch("/api/refund-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteKey,
            orderId,
            itemName: item?.name ?? undefined,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!aborted && res.ok && json?.status) {
          setRemoteStatus(json.status as RefundStatus);
        }
      } catch {
        // 失敗してもUIは既定のまま
      }
    })();
    return () => {
      aborted = true;
    };
  }, [siteKey, orderId, item?.name]);

  const isFullyRefunded = remoteStatus === "refunded";
  const isPartiallyRefunded = remoteStatus === "processed";
  const isRequested = remoteStatus === "requested";

  async function sendRequest(intent: "first" | "retry") {
    setSending(true);
    try {
      const uid = auth.currentUser?.uid ?? null;

      // Firestore へログ追加
      const docRef = await addDoc(collection(db, "refundRequests"), {
        type: "refundRequest",
        siteKey,
        orderId,
        item, // { name, qty, unitAmount }
        customer: {
          name: customerName || null,
          email: customerEmail || null,
          phone: customerPhone || null,
          addressText: addressText || null,
        },
        requestedByUid: uid,
        status: "requested", // 管理側で processed / refunded / canceled 等に更新
        reason: null,
        createdAt: serverTimestamp(),
        // 既依頼後の再送を区別したい場合の最低限メタ
        retry: intent === "retry",
      });

      // 通知API（メール）
      let notified = false;
      try {
        const res = await fetch("/api/refund-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ docId: docRef.id }),
        });
        if (res.ok) notified = true;
      } catch {
        // noop
      }

      // 状態を保持
      setRemoteStatus("requested");

      alert(
        notified
          ? intent === "retry"
            ? "返金依頼を再送しました。"
            : "返金依頼を送信しました。"
          : "返金依頼は保存されましたが、通知に失敗しました。時間をおいて再度お試しください。"
      );
    } catch (e) {
      console.error(e);
      alert("送信に失敗しました。通信状態をご確認ください。");
    } finally {
      setSending(false);
    }
  }

  async function handleClick() {
    if (sending) return;

    // 返金済み・一部返金は操作不可
    if (isFullyRefunded || isPartiallyRefunded) return;

    // 既に依頼済み → 再送の確認
    if (isRequested) {
      const ok = confirm("すでに依頼済みです。再度依頼を送信しますか？");
      if (!ok) return;
      return sendRequest("retry");
    }

    // 初回依頼
    const ok = confirm(
      "この商品について返金依頼を送信します。よろしいですか？"
    );
    if (!ok) return;
    return sendRequest("first");
  }

  // 返金済み（全額）
  if (isFullyRefunded) {
    return (
      <span
        className={`${BTN_BASE} bg-gray-200 text-gray-600 cursor-default`}
        title="返金済み（全額）"
      >
        返金済み
      </span>
    );
  }

  // 一部返金
  if (isPartiallyRefunded) {
    return (
      <span
        className={`${BTN_BASE} bg-gray-200 text-gray-600 cursor-default`}
        title="一部返金済み"
      >
        一部返金
      </span>
    );
  }

  // 依頼済み（オレンジ表示・再送可能）
  if (isRequested) {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={sending}
        className={`${BTN_BASE} ${
          sending
            ? "bg-orange-200 text-orange-700 border-orange-300 cursor-wait"
            : "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200"
        }`}
        title="依頼済み（クリックで再送）"
      >
        {sending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
        依頼済み
      </button>
    );
  }

  // 通常（未依頼）
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={sending}
      className={`${BTN_BASE} ${
        sending
          ? "bg-gray-200 text-gray-500 cursor-wait"
          : "bg-white hover:bg-gray-50 text-gray-800"
      }`}
      title="返金依頼を送信"
    >
      {sending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
      返金依頼
    </button>
  );
}
