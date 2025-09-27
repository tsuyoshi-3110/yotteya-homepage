// src/app/orders/page.tsx
"use client";

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";

type Order = {
  id: string;
  amountTotal: number;
  createdAt: number;
  customer: { name: string; email: string };
  lineItems: { name: string; qty: number; subtotal: number }[];
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, "orders"),
      where("siteKey", "==", SITE_KEY),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: Order[] = snap.docs.map((doc) => {
        const data = doc.data() as Omit<Order, "id">;
        return { id: doc.id, ...data };
      });
      setOrders(list);
    });
    return () => unsub();
  }, []);

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-4">注文履歴</h1>
      {!orders.length ? (
        <p>注文履歴はありません。</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left">日付</th>
              <th className="p-2 text-left">顧客名</th>
              <th className="p-2 text-right">合計</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b">
                <td className="p-2">
                  {new Date(o.createdAt).toLocaleString("ja-JP")}
                </td>
                <td className="p-2">{o.customer?.name || "不明"}</td>
                <td className="p-2 text-right">
                  ¥{o.amountTotal.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
