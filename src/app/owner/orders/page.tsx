// src/app/owner/orders/page.tsx
import { adminDb } from "@/lib/firebase-admin";
import { resolveCurrentTenant } from "@/lib/customer-config/tenant-resolver-server";
import Pager from "./Pager";
import RefundRequestButton from "@/components/RefundRequestButton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderItem = { name: string; qty: number; unitAmount: number };
type Address = {
  city?: string;
  state?: string;
  line1?: string;
  line2?: string;
  postal_code?: string;
  country?: string;
};
type OrderDoc = {
  siteKey: string;
  payment_status: "paid" | "requires_action" | "canceled";
  amount_total?: number; // 最小通貨単位（JPYなら1円）
  currency?: string; // "jpy"
  createdAt?: FirebaseFirestore.Timestamp | number | string;
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: Address;
  };
  /** 互換: 古いドキュメントで address がルートにある場合に備える */
  address?: Address;
  items?: OrderItem[];
};

function jpy(n: number | undefined) {
  const v = typeof n === "number" ? n : 0;
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
  }).format(v);
}

function tsToDate(x: unknown): Date {
  if (!x) return new Date(0);
  const anyX = x as any;
  if (typeof anyX?.toDate === "function") return anyX.toDate();
  if (typeof x === "number") return new Date(x);
  if (typeof x === "string") return new Date(x);
  return new Date(0);
}

// JST固定の日時表示
const formatJST = (d: Date) =>
  new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);

function sum(items: OrderItem[] = []) {
  return items.reduce((a, b) => a + b.qty * b.unitAmount, 0);
}

/** customer.address 優先、なければルート address を使って整形 */
function formatAddressFromOrder(o: OrderDoc) {
  const addr: Address | undefined = o.customer?.address ?? o.address;
  if (!addr) return "—";
  const parts = [
    addr.postal_code ? `〒${addr.postal_code}` : "",
    addr.state ?? "",
    addr.city ?? "",
    addr.line1 ?? "",
    addr.line2 ?? "",
    addr.country && addr.country !== "JP" ? addr.country : "",
  ]
    .map((s) => (s || "").trim())
    .filter(Boolean);
  return parts.length ? parts.join(" ") : "—";
}

const PAGE_SIZE = 10;

export default async function OrdersPage({
  // Next.js 15+ では searchParams は Promise。await してから使う
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const tenant = await resolveCurrentTenant();
  const siteKey = tenant.siteKey;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp?.p ?? "1"));
  const startIndex = (page - 1) * PAGE_SIZE;

  const snap = await adminDb
    .collection("siteOrders")
    .where("siteKey", "==", siteKey)
    .orderBy("createdAt", "desc")
    .limit(50) // 直近50件を対象にページング
    .get();

  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderDoc) }));
  const pageRows = rows.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold text-black">販売履歴</h1>
        <Pager initialPage={page} totalCount={rows.length} pageSize={PAGE_SIZE} />
      </div>

      {/* ====== モバイル表示（カード型） ====== */}
      <div className="md:hidden space-y-3">
        {rows.length === 0 && (
          <div className="text-center text-gray-500 text-sm bg-white rounded-lg py-10">
            販売履歴はまだありません
          </div>
        )}

        {pageRows.map((o) => {
          const dt = tsToDate(o.createdAt);
          const total = typeof o.amount_total === "number" ? o.amount_total : sum(o.items);
          const addressText = formatAddressFromOrder(o);

          return (
            <section key={o.id} className="bg-white rounded-lg shadow p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-gray-600">{formatJST(dt)}</div>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                    o.payment_status === "paid"
                      ? "bg-green-100 text-green-700"
                      : o.payment_status === "requires_action"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {o.payment_status}
                </span>
              </div>

              {/* 注文ID */}
              <div className="mt-1 font-mono text-[11px] text-gray-500 break-all">ID: {o.id}</div>

              {/* 顧客 */}
              <div className="mt-2">
                <div className="font-medium">{o.customer?.name ?? "—"}</div>
                {o.customer?.email && (
                  <a
                    href={`mailto:${o.customer.email}`}
                    className="text-blue-600 underline break-all text-sm"
                  >
                    {o.customer.email}
                  </a>
                )}
                <div className="text-gray-700 text-sm">
                  {o.customer?.phone ? (
                    <a
                      href={`tel:${o.customer.phone.replace(/\s+/g, "")}`}
                      className="underline"
                    >
                      {o.customer.phone}
                    </a>
                  ) : (
                    "—"
                  )}
                </div>
              </div>

              {/* 住所 */}
              <div className="mt-2 text-gray-700 text-sm break-words">{addressText}</div>

              {/* 商品 */}
              <ul className="mt-3 divide-y">
                {(o.items ?? []).map((it, i) => (
                  <li key={i} className="py-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm text-gray-900 break-words">
                        {it.name} ×{it.qty}
                      </div>
                      <div className="text-xs text-gray-500">{jpy(it.unitAmount)}</div>
                    </div>
                    <RefundRequestButton
                      siteKey={o.siteKey}
                      orderId={o.id as string}
                      item={it}
                      customerName={o.customer?.name}
                      customerEmail={o.customer?.email}
                      customerPhone={o.customer?.phone}
                      addressText={addressText}
                    />
                  </li>
                ))}
              </ul>

              {/* 合計 */}
              <div className="mt-2 text-right font-semibold">{jpy(total)}</div>
            </section>
          );
        })}
      </div>

      {/* ====== デスクトップ表示（テーブル） ====== */}
      <div className="hidden md:block overflow-x-auto bg-white rounded-lg shadow-md mt-4 md:mt-6">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">日時</th>
              <th className="p-3 text-left">顧客</th>
              <th className="p-3 text-left">注文ID</th>
              <th className="p-3 text-left">住所</th>
              <th className="p-3 text-left">商品</th>
              <th className="p-3 text-right">合計</th>
              <th className="p-3 text-left">ステータス</th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={7}>
                  販売履歴はまだありません
                </td>
              </tr>
            )}

            {pageRows.map((o) => {
              const dt = tsToDate(o.createdAt);
              const total = typeof o.amount_total === "number" ? o.amount_total : sum(o.items);
              const addressText = formatAddressFromOrder(o);

              return (
                <tr key={o.id} className="border-t align-top">
                  {/* 日時（JST固定） */}
                  <td className="p-3 whitespace-nowrap text-gray-700">{formatJST(dt)}</td>

                  {/* 顧客（名前＋メール＋電話） */}
                  <td className="p-3">
                    <div className="font-medium">{o.customer?.name ?? "—"}</div>

                    {o.customer?.email && (
                      <div>
                        <a
                          href={`mailto:${o.customer.email}`}
                          className="text-blue-600 underline break-all"
                        >
                          {o.customer.email}
                        </a>
                      </div>
                    )}

                    <div className="text-gray-700">
                      {o.customer?.phone ? (
                        <a
                          href={`tel:${o.customer.phone.replace(/\s+/g, "")}`}
                          className="text-gray-700 underline"
                        >
                          {o.customer.phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </div>
                  </td>

                  {/* 注文ID（モノスペース + 省略表示） */}
                  <td className="p-3 max-w-[260px] truncate font-mono text-[11px]" title={o.id}>
                    {o.id}
                  </td>

                  {/* 住所 */}
                  <td className="p-3 text-gray-700 break-words">{addressText}</td>

                  {/* 商品（縦並び） */}
                  <td className="p-3">
                    <ul className="space-y-1">
                      {(o.items ?? []).map((it, i) => (
                        <li
                          key={i}
                          className="border-b last:border-none pb-1 text-gray-800 flex items-center justify-between gap-2"
                        >
                          <span className="min-w-0">
                            {it.name} ×{it.qty}（{jpy(it.unitAmount)}）
                          </span>

                          <RefundRequestButton
                            siteKey={o.siteKey}
                            orderId={o.id as string}
                            item={it}
                            customerName={o.customer?.name}
                            customerEmail={o.customer?.email}
                            customerPhone={o.customer?.phone}
                            addressText={addressText}
                          />
                        </li>
                      ))}
                    </ul>
                  </td>

                  {/* 合計 */}
                  <td className="p-3 text-right">{jpy(total)}</td>

                  {/* ステータス */}
                  <td className="p-3 text-gray-700">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        o.payment_status === "paid"
                          ? "bg-green-100 text-green-700"
                          : o.payment_status === "requires_action"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {o.payment_status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-gray-400 text-xs mt-3 md:mt-4">
        ※ 顧客名・メール・<span className="font-medium">電話番号</span>・住所・商品内容を確認のうえ、発送や連絡にご利用ください。
      </p>
    </main>
  );
}
