import { useEffect, useState } from "react";
import { Input } from "../ui/input";
import { Wand2 } from "lucide-react";
import { Button } from "../ui/button";
import { AiContext, AiTarget } from "@/types/company";

export default function AiGenerateModal({
  open,
  onClose,
  onGenerate,
  target,
  context,
}: {
  open: boolean;
  onClose: () => void;
  onGenerate: (result: { about?: string; business?: string[] }) => void;
  target: AiTarget;
  context?: AiContext;
}) {
  const [k1, setK1] = useState("");
  const [k2, setK2] = useState("");
  const [k3, setK3] = useState("");
  const [loading, setLoading] = useState(false);

  const canStart = [k1, k2, k3].some((v) => v.trim().length > 0);

  useEffect(() => {
    if (!open) {
      setK1("");
      setK2("");
      setK3("");
      setLoading(false);
    }
  }, [open]);

  const start = async () => {
    if (!canStart) return;
    setLoading(true);
    const keywords = [k1, k2, k3].map((v) => v.trim()).filter(Boolean);

    try {
      const res = await fetch("/api/generate-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          target,
          keywords,
          temperature: 0.85,
          seed: Date.now() + Math.random(),
          ...context,
        }),
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        console.error("AI generate failed:", res.status, msg);
        alert("AI生成に失敗しました。時間をおいて再度お試しください。");
        return;
      }

      const data = await res.json();

      if (target === "about") {
        if (typeof data.about !== "string" || !data.about.trim()) {
          alert(
            "AIから有効な『会社説明』が返りませんでした。キーワードや文脈を見直してください。"
          );
          return;
        }
        onGenerate({ about: data.about.trim() });
      } else {
        if (!Array.isArray(data.business) || data.business.length === 0) {
          alert(
            "AIから有効な『事業内容』が返りませんでした。キーワードや文脈を見直してください。"
          );
          return;
        }
        onGenerate({
          business: data.business
            .map((s: any) => String(s).trim())
            .filter(Boolean),
        });
      }

      onClose();
    } catch (e) {
      console.error(e);
      alert(
        "AI生成リクエストでエラーが発生しました。ネットワークをご確認ください。"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded bg-white/90 shadow-2xl border border-white/40 ring-1 ring-black/5">
        <div className="p-5 border-b bg-gradient-to-r from-purple-600/10 to-fuchsia-600/10">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-purple-600" />
            {target === "about" ? "会社説明をAIで生成" : "事業内容をAIで生成"}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            キーワードを最大3つまで入力（1つ以上で開始可能）
          </p>
        </div>

        <div className="p-5 space-y-3">
          <Input
            value={k1}
            onChange={(e) => setK1(e.target.value)}
            placeholder="キーワード1（例：短納期／CMS構築 など）"
          />
          <Input
            value={k2}
            onChange={(e) => setK2(e.target.value)}
            placeholder="キーワード2（任意）"
          />
          <Input
            value={k3}
            onChange={(e) => setK3(e.target.value)}
            placeholder="キーワード3（任意）"
          />
        </div>

        <div className="p-5 pt-0 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            キャンセル
          </Button>
          <Button
            onClick={start}
            disabled={!canStart || loading}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {loading ? "生成中..." : "生成開始"}
          </Button>
        </div>
      </div>
    </div>
  );
}
