// components/products/KeywordModal.tsx
import { useEffect, useState } from "react";

export type KeywordModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (keywords: string[]) => void;
};

export default function KeywordModal({
  open,
  onClose,
  onSubmit,
}: KeywordModalProps) {
  const [k1, setK1] = useState("");
  const [k2, setK2] = useState("");
  const [k3, setK3] = useState("");

  // モーダルを閉じたら必ずリセット
  useEffect(() => {
    if (!open) {
      setK1("");
      setK2("");
      setK3("");
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = () => {
    const kws = [k1, k2, k3].map((s) => s.trim()).filter(Boolean);
    if (kws.length === 0) {
      alert("キーワードを1つ以上入力してください（最大3つまで）");
      return;
    }
    onSubmit(kws);
    // 完了時もリセット
    setK1("");
    setK2("");
    setK3("");
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md bg-white rounded-lg p-5 space-y-4 shadow-xl">
        <h3 className="text-lg font-semibold text-center">
          AI紹介文のキーワード
        </h3>
        <p className="text-sm text-gray-600 text-center">
          最大3つまで入力できます。少なくとも1つ入力すると生成します。
        </p>
        <div className="space-y-2">
          <input
            value={k1}
            onChange={(e) => setK1(e.target.value)}
            placeholder="キーワード1（例：濃厚クリーム）"
            className="w-full border rounded px-3 h-10"
          />
          <input
            value={k2}
            onChange={(e) => setK2(e.target.value)}
            placeholder="キーワード2（任意）"
            className="w-full border rounded px-3 h-10"
          />
          <input
            value={k3}
            onChange={(e) => setK3(e.target.value)}
            placeholder="キーワード3（任意）"
            className="w-full border rounded px-3 h-10"
          />
        </div>
        <div className="flex gap-2 justify-center pt-1">
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            生成する
          </button>
          <button
            onClick={() => {
              // キャンセル時もリセット
              setK1("");
              setK2("");
              setK3("");
              onClose();
            }}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
