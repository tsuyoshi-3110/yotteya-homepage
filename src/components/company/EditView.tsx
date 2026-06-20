import { CompanyDoc, TranslatableFields } from "@/types/company";
import AutoResizeTextarea from "../AutoResizeTextarea";
import LabeledInput from "./LabeledInput";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Wand2 } from "lucide-react";
import { computeMapEmbedSrc } from "@/lib/company/computeMapEmbedSrc";
/* ========= Utils ========= */
// 空行も末尾改行も保持
function linesToArrayPreserve(s: string) {
  return s.split("\n");
}
function arrayToLinesPreserve(a?: string[]) {
  return (a ?? []).join("\n");
}






export default function EditView({
  base,
  common,
  onBaseChange,
  onCommonChange,
  onOpenAi,
}: {
  base: Required<TranslatableFields>;
  common: Pick<
    CompanyDoc,
    | "founded"
    | "ceo"
    | "capital"
    | "employees"
    | "phone"
    | "email"
    | "website"
    | "heroMediaUrl"
    | "heroMediaType"
    | "useAddressForMap"
  >;
  onBaseChange: (v: Required<TranslatableFields>) => void;
  onCommonChange: (v: typeof common) => void;
  onOpenAi: (target: "about" | "business") => void;
}) {
  const previewSrc = computeMapEmbedSrc({
    address: base.address,
    useAddressForMap: common.useAddressForMap,
  });

  return (
    <div className="space-y-8">
      {/* 必須は会社名のみ（原文=ja） */}
      <div className="grid md:grid-cols-2 gap-4 ">
        <LabeledInput
          label="会社名 *"
          value={base.name}
          onChange={(v) => onBaseChange({ ...base, name: v })}
        />
        <LabeledInput
          label="キャッチコピー（任意）"
          value={base.tagline ?? ""}
          onChange={(v) => onBaseChange({ ...base, tagline: v })}
        />
      </div>

      {/* 会社情報（代表者・設立・資本金・従業員数） */}
      <div className="grid md:grid-cols-2 gap-4">
        <LabeledInput
          label="代表者（任意）"
          value={common.ceo ?? ""}
          onChange={(v) => onCommonChange({ ...common, ceo: v })}
          placeholder="例）山田 太郎"
        />
        <LabeledInput
          label="設立（任意）"
          value={common.founded ?? ""}
          onChange={(v) => onCommonChange({ ...common, founded: v })}
          placeholder="例）2020年4月"
        />
        <LabeledInput
          label="資本金（任意）"
          value={common.capital ?? ""}
          onChange={(v) => onCommonChange({ ...common, capital: v })}
          placeholder="例）1,000万円"
        />
        <LabeledInput
          label="従業員数（任意）"
          value={common.employees ?? ""}
          onChange={(v) => onCommonChange({ ...common, employees: v })}
          placeholder="例）25名（アルバイト含む）"
        />
      </div>

      {/* 連絡先（住所・電話・メール・Web） */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* 住所＋チェックボックス */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="text-sm text-black">
              所在地（任意・翻訳対象）
            </div>
            <label className="flex items-center gap-1 text-xs text-black">
              <input
                type="checkbox"
                className="h-3 w-3"
                checked={!!common.useAddressForMap}
                onChange={(e) =>
                  onCommonChange({
                    ...common,
                    useAddressForMap: e.target.checked,
                  })
                }
              />
              <span>住所から地図を表示</span>
            </label>
          </div>
          <Input
            value={base.address ?? ""}
            onChange={(e) =>
              onBaseChange({ ...base, address: e.target.value })
            }
            placeholder="住所または地名"
            className="bg-white/80"
          />
          <p className="mt-1 text-xs text-black">
            ※ チェックONのとき、この住所からGoogleマップを自動表示します。
          </p>
        </div>

        <LabeledInput
          label="電話番号（任意）"
          value={common.phone ?? ""}
          onChange={(v) => onCommonChange({ ...common, phone: v })}
          placeholder="例）03-1234-5678"
        />
        <LabeledInput
          label="メール（任意）"
          value={common.email ?? ""}
          onChange={(v) => onCommonChange({ ...common, email: v })}
          placeholder="info@example.com"
        />
        <LabeledInput
          label="Webサイト（任意）"
          value={common.website ?? ""}
          onChange={(v) => onCommonChange({ ...common, website: v })}
          placeholder="https://example.com"
        />
      </div>

      {/* 会社説明 + AI（自動伸縮） */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm text-black">
            会社説明（任意・翻訳対象）
          </div>
          <Button
            onClick={() => onOpenAi("about")}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Wand2 className="h-4 w-4 mr-1" />
            AIで生成
          </Button>
        </div>
        <AutoResizeTextarea
          value={base.about ?? ""}
          onValueChange={(v) => onBaseChange({ ...base, about: v })}
          minRows={4}
          maxRows={40}
          placeholder="（任意）会社の特徴・強み・提供価値などを記載"
          className="bg-white/80"
        />
      </div>

      {/* 事業内容（自動伸縮 / 空行・末尾改行を保持） */}
      <div className="space-y-2">
        <div className="text-sm text-black">
          事業内容（任意・翻訳対象 / 1行につき1項目 / 空行OK）
        </div>
        <AutoResizeTextarea
          value={arrayToLinesPreserve(base.business)}
          onValueChange={(v) =>
            onBaseChange({ ...base, business: linesToArrayPreserve(v) })
          }
          minRows={6}
          maxRows={50}
          placeholder={"例：\n主要サービスA\nCMS構築\n運用サポート\n"}
          className="bg-white/80"
        />
        <p className="text-xs text-black">
          ※ Enter
          での空行や、最後の改行も保持されます（閲覧表示では空行は表示されません）。
        </p>
      </div>

      {/* Googleマップ プレビュー（住所＋チェックONのときのみ表示） */}
      {previewSrc && (
        <div>

          <div className="aspect-video w-full overflow-hidden rounded border bg-white/40">
            <iframe
              src={previewSrc}
              className="w-full h-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      )}
    </div>
  );
}
