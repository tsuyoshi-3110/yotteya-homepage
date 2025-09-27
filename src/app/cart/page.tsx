"use client";
import { useState, useMemo } from "react";
import Image from "next/image";
import { useCart } from "@/lib/cart/CartContext";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";

export default function CartPage() {
  const { items, subtotalJPY, changeQty, remove } = useCart();
  const [loading, setLoading] = useState(false);

  const canCheckout = useMemo(
    () => items.length > 0 && !loading,
    [items, loading]
  );

  const checkout = async () => {
    if (!items.length || loading) return;
    try {
      setLoading(true);

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ★ サーバで戻りURL作るのに origin を渡す（同一オリジンでもOK）
        body: JSON.stringify({
          items: items.map((i) => ({ id: i.productId, qty: i.qty })),
          siteKey: SITE_KEY,
          origin: window.location.origin,
        }),
      });

      if (!res.ok) {
        // 失敗時は一度だけ読む（text → 必要なら JSON.parse）
        const text = await res.text().catch(() => "");
        let msg = text || `${res.status} ${res.statusText}`;
        try {
          const j = JSON.parse(text);
          msg = j?.error || msg;
        } catch {}
        console.error("checkout failed:", res.status, msg);
        alert(`決済エラー: ${msg}`);
        return;
      }

      // 成功時はまだ未読なので json() でOK
      const { url } = (await res.json()) as { url?: string };
      if (url) {
        window.location.assign(url);
      } else {
        alert("決済URLが取得できませんでした。");
      }
    } catch (e) {
      console.error("checkout exception:", e);
      alert("決済処理に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-4">買い物かご</h1>

      {!items.length ? (
        <p>カートに商品はありません。</p>
      ) : (
        <div className="grid gap-6">
          <ul className="grid gap-4">
            {items.map((it) => (
              <li
                key={it.productId}
                className="flex gap-3 items-center rounded-xl border p-3"
              >
                {it.imageUrl && (
                  <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-gray-100 shrink-0">
                    <Image
                      src={it.imageUrl}
                      alt={it.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{it.name}</div>
                  <div className="text-sm opacity-70">
                    ¥{Number(it.unitAmount || 0).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="h-8 w-8 rounded bg-gray-200"
                    onClick={() =>
                      changeQty(it.productId, Math.max(1, it.qty - 1))
                    }
                    disabled={loading}
                    aria-label="数量を1減らす"
                  >
                    -
                  </button>
                  <input
                    className="w-12 text-center border rounded h-8"
                    type="number"
                    min={1}
                    value={it.qty}
                    onChange={(e) =>
                      changeQty(
                        it.productId,
                        Math.max(1, Number(e.target.value) || 1)
                      )
                    }
                    disabled={loading}
                    aria-label="数量入力"
                  />
                  <button
                    className="h-8 w-8 rounded bg-gray-200"
                    onClick={() => changeQty(it.productId, it.qty + 1)}
                    disabled={loading}
                    aria-label="数量を1増やす"
                  >
                    +
                  </button>
                </div>

                <button
                  className="ml-2 text-sm underline"
                  onClick={() => remove(it.productId)}
                  disabled={loading}
                >
                  削除
                </button>
              </li>
            ))}
          </ul>

          <div className="ml-auto grid gap-2 w-full sm:w-80">
            <div className="flex justify-between text-lg">
              <span>小計</span>
              <span>¥{subtotalJPY.toLocaleString()}</span>
            </div>

            {/* 送料・税の扱いは運用に合わせて表示（Stripe Tax/Shipping Rates を使うならUIも調整） */}

            <button
              disabled={!canCheckout}
              onClick={checkout}
              className="h-12 rounded-xl bg-black text-white font-semibold disabled:opacity-50"
            >
              {loading ? "リダイレクト中..." : "一括決済へ（Stripe）"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
