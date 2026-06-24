"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useSiteKey } from "@/lib/atoms/siteKeyAtom";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function AIKeywordsPage() {
  const siteKey = useSiteKey();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [lines, setLines] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setIsLoggedIn(!!u));
    return () => unsub();
  }, []);

  useEffect(() => {
    (async () => {
      const ref = doc(db, "aiKnowledge", siteKey, "docs", "keywords");
      const snap = await getDoc(ref);
      const data = snap.exists() ? (snap.data() as any) : null;
      const items: string[] = Array.isArray(data?.items) ? data!.items : [];
      setLines(items.join("\n"));
      const d = data?.updatedAt?.toDate?.();
      if (d instanceof Date) setSavedAt(d);
    })();
  }, []);

  const parse = (text: string) =>
    text
      .split("\n")
      .map((s) => s.replace(/^(\s*[-*・]\s*|\s+)/, "").trim())
      .filter(Boolean)
      .slice(0, 300);

  const handleSave = async () => {
    if (!isLoggedIn) return alert("ログインしてください。");
    setSaving(true);
    try {
      const ref = doc(db, "aiKnowledge", siteKey, "docs", "keywords");
      await setDoc(
        ref,
        { items: parse(lines), updatedAt: serverTimestamp() },
        { merge: true }
      );
      const now = new Date();
      setSavedAt(now);
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold mb-3">AI 学習キーワード</h1>
        <p className="mb-4">このページは管理者専用です。</p>
        <Link href="/login" className="underline text-blue-600">
          ログインへ
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-3">AI 学習キーワード</h1>
      <p className="text-sm text-gray-600 mb-4">
        箇条書きで入力してください（1行＝1キーワード / 最大300行）。
        回答時は「参照知識」として優先的に活用されます。
      </p>

      <textarea
        className="w-full min-h-[360px] rounded border p-3 font-mono text-sm"
        placeholder={`例）\n主力商品・サービスの特徴\nよくある質問と回答\n対応エリア・最寄り駅`}
        value={lines}
        onChange={(e) => setLines(e.target.value)}
      />

      <div className="mt-3 flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "保存中…" : "保存"}
        </Button>
        {savedAt && (
          <span className="text-xs text-gray-500">
            最終保存: {savedAt.toLocaleString()}
          </span>
        )}
      </div>

      <div className="mt-6 text-sm text-gray-700 space-y-2">
        <p>💡おすすめの書き方</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>価格やメニュー名、所要時間などの“断片知識”を短文で。</li>
          <li>営業ポリシーや安全上の注意など、守ってほしい方針も可。</li>
          <li>URLや固有名詞はそのまま書いてOK。</li>
        </ul>
      </div>
    </div>
  );
}
