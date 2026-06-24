// components/company/CompanyOverview.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

import { Button } from "@/components/ui/button";
import CardSpinner from "@/components/CardSpinner";
import { useSiteKey } from "@/lib/atoms/siteKeyAtom";
import { Building2 } from "lucide-react";
import { useUILang } from "@/lib/atoms/uiLangAtom";
import { StaggerChars } from "../animated/StaggerChars";
import { motion } from "framer-motion";

/* ========= Firebase（共通ラッパーを利用） ========= */
import { auth, db, storage } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

import { COMPANY_OVERVIEW_T, LANGS } from "@/lib/company/text";
import { type LangKey } from "@/lib/langs";
import {
  type TranslatableFields,
  type CompanyDoc,
  type CompanyProfileView,
  type AiTarget,
} from "@/types/company";
import { InlineMediaEditor } from "./InlineMediaEditor";
import InlineMediaViewer from "./InlineMediaViewer";
import { translateCompany } from "@/lib/company/translateCompany";
import { pickLocalizedCompany } from "@/lib/company/pickLocalizedCompany";
import { readBaseFromDoc } from "@/lib/company/readBaseFromDoc";
import AiGenerateModal from "./AiGenerateModal";
import EditView from "./EditView";
import ReadOnlyView from "./ReadOnlyView";

import { animations, transition } from "@/lib/animation";

// 追加：見出し「会社概要」の多言語マップ

const EMPTY_EDIT_BASE: Required<TranslatableFields> = {
  name: "",
  tagline: "",
  about: "",
  business: [],
  address: "",
};

/**
 * 既に embed URL ならそのまま返し、それ以外は q= に詰めて output=embed へ変換
 * （APIキー不要バージョン）
 */

/** 住所＋チェックボックスから埋め込みURLを決定 */

/** 後方互換：ドキュメントから原文(base)を抽出 */

/** ロケールに応じて表示内容を合成（見つからなければ原文(base)） */

/* ========= タイトル直下メディア Viewer ========= */

/* ========= タイトル直下メディア Uploader ========= */

/* ========= AI生成モーダル ========= */

/* ========= 多言語翻訳（原文 → target へ一括） ========= */

/* ========= Main ========= */
export default function CompanyOverview() {
  const siteKey = useSiteKey();
  const { uiLang } = useUILang();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Firestore ドキュメント生データ（base/t 含む）
  const [docData, setDocData] = useState<CompanyDoc | null>(null);

  // 編集用（原文=ja のみ編集）
  const [editBase, setEditBase] =
    useState<Required<TranslatableFields>>(EMPTY_EDIT_BASE);
  const [editCommon, setEditCommon] = useState<
    Pick<
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
    >
  >({
    founded: "",
    ceo: "",
    capital: "",
    employees: "",
    phone: "",
    email: "",
    website: "",
    heroMediaUrl: "",
    heroMediaType: null,
    useAddressForMap: true,
  });
  const [isEditing, setIsEditing] = useState(false);
  const headingText =
    COMPANY_OVERVIEW_T[(uiLang as keyof typeof COMPANY_OVERVIEW_T) ?? "ja"] ??
    COMPANY_OVERVIEW_T.ja;

  // ログイン監視
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // 初期ロード
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const ref = doc(db, "siteMeta", siteKey, "company", "profile");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as CompanyDoc;
          setDocData(data);
          // 編集用に原文(base)と共通を展開
          const base = readBaseFromDoc(data);
          setEditBase({ ...EMPTY_EDIT_BASE, ...base });
          setEditCommon({
            founded: data.founded ?? "",
            ceo: data.ceo ?? "",
            capital: data.capital ?? "",
            employees: data.employees ?? "",
            phone: data.phone ?? "",
            email: data.email ?? "",
            website: data.website ?? "",
            heroMediaUrl: data.heroMediaUrl ?? "",
            heroMediaType: data.heroMediaType ?? null,
            useAddressForMap: data.useAddressForMap ?? true,
          });
        } else {
          // 新規
          const initialDoc: CompanyDoc = {
            base: { ...EMPTY_EDIT_BASE },
            t: [],
            useAddressForMap: true,
          };
          setDocData(initialDoc);
          setEditBase({ ...EMPTY_EDIT_BASE });
          setEditCommon({
            founded: "",
            ceo: "",
            capital: "",
            employees: "",
            phone: "",
            email: "",
            website: "",
            heroMediaUrl: "",
            heroMediaType: null,
            useAddressForMap: true,
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const canEdit = !!user;

  // 表示用（uiLang に応じてローカライズ）
  const displayData: CompanyProfileView | null = useMemo(() => {
    if (!docData) return null;
    return pickLocalizedCompany(docData, uiLang);
  }, [docData, uiLang]);

  const startEdit = () => setIsEditing(true);
  const cancelEdit = () => {
    // ドキュメントの値に戻す
    if (docData) {
      const base = readBaseFromDoc(docData);
      setEditBase({ ...EMPTY_EDIT_BASE, ...base });
      setEditCommon({
        founded: docData.founded ?? "",
        ceo: docData.ceo ?? "",
        capital: docData.capital ?? "",
        employees: docData.employees ?? "",
        phone: docData.phone ?? "",
        email: docData.email ?? "",
        website: docData.website ?? "",
        heroMediaUrl: docData.heroMediaUrl ?? "",
        heroMediaType: docData.heroMediaType ?? null,
        useAddressForMap: docData.useAddressForMap ?? true,
      });
    }
    setIsEditing(false);
  };

  // 保存（原文を更新し、全言語を上書き再生成）
  const saveEdit = async () => {
    if (!editBase.name.trim()) {
      alert("会社名は必須です。");
      return;
    }
    setSaving(true);
    try {
      // 全言語翻訳（ja は base に保持、その他は t へ）
      const targets: LangKey[] = LANGS.map((l) => l.key) as LangKey[];
      const tAll = await Promise.all(
        targets.map((lang) => translateCompany(editBase, lang))
      );

      const ref = doc(db, "siteMeta", siteKey, "company", "profile");

      const payload: CompanyDoc = {
        // 多言語
        base: {
          name: editBase.name,
          tagline: editBase.tagline ?? "",
          about: editBase.about ?? "",
          business: Array.isArray(editBase.business) ? editBase.business : [],
          address: editBase.address ?? "",
        },
        t: tAll,

        // 非翻訳
        founded: editCommon.founded ?? "",
        ceo: editCommon.ceo ?? "",
        capital: editCommon.capital ?? "",
        employees: editCommon.employees ?? "",
        phone: editCommon.phone ?? "",
        email: editCommon.email ?? "",
        website: editCommon.website ?? "",
        heroMediaUrl: editCommon.heroMediaUrl ?? "",
        heroMediaType: editCommon.heroMediaType ?? null,
        useAddressForMap: editCommon.useAddressForMap ?? true,

        // メタ
        updatedAt: serverTimestamp(),
        updatedByUid: user?.uid ?? null,
        updatedByName: user?.displayName ?? null,

        // 後方互換（原文を平坦にも保存）
        name: editBase.name,
        tagline: editBase.tagline ?? "",
        about: editBase.about ?? "",
        business: Array.isArray(editBase.business) ? editBase.business : [],
        address: editBase.address ?? "",
      };

      await setDoc(ref, payload, { merge: true });
      setDocData(payload); // ローカルにも反映
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました。権限またはネットワークをご確認ください。");
    } finally {
      setSaving(false);
    }
  };

  // AI結果の反映
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTarget, setAiTarget] = useState<AiTarget>("about");
  const applyAiResult = useCallback(
    (result: { about?: string; business?: string[] }) => {
      if (result.about != null) {
        setEditBase((prev) => ({ ...prev, about: result.about ?? "" }));
      }
      if (result.business != null) {
        setEditBase((prev) => ({ ...prev, business: result.business ?? [] }));
      }
    },
    []
  );

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="relative rounded bg-white/10 backdrop-blur-md shadow-xl border border-white/50 ring-1 ring-black/5 p-0 overflow-hidden">
          <CardSpinner />
          <div className="p-8">読み込み中…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-semibold text-black mb-4">
        <StaggerChars text={headingText} />
      </h1>
      {/* ===== 会社概要カード ===== */}
      <motion.div
        {...animations.fadeInUp}
        transition={transition.slow}
        className="relative rounded bg-white/10 backdrop-blur-md shadow-xl border border-white/50 ring-1 ring-black/5 p-0 overflow-hidden"
      >
        {saving && <CardSpinner />}

        {/* 先頭：編集/保存ボタン */}
        {canEdit && (
          <div className="px-6 md:px-8 pt-4">
            <div className="flex justify-end gap-2">
              {!isEditing ? (
                <Button
                  onClick={startEdit}
                  className="bg-blue-500 hover:bg-blue-400"
                >
                  編集
                </Button>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    onClick={cancelEdit}
                    disabled={saving}
                    className="bg-white/70 text-slate-700 hover:bg-white"
                  >
                    キャンセル
                  </Button>
                  <Button
                    onClick={saveEdit}
                    disabled={saving}
                    className="bg-blue-500 hover:bg-blue-400"
                  >
                    保存
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ヘッダー帯（タイトル） */}
        <div className="px-6 md:px-8 pb-4 pt-2 text-slate-900">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded bg-white/60 flex items-center justify-center ring-1 ring-black/5">
              <Building2 className="h-6 w-6 text-slate-700" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-semibold text-black">
                {(!isEditing ? displayData?.name ?? "" : editBase.name) ||
                  "（会社名未設定）"}
              </h1>
              {(!isEditing
                ? displayData?.tagline ?? ""
                : editBase.tagline ?? "") && (
                <p className="text-black mt-1 ">
                  {!isEditing ? displayData?.tagline : editBase.tagline}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* タイトル直下のメディア（編集 or 閲覧） */}
        {isEditing ? (
          <InlineMediaEditor
            data={
              {
                heroMediaUrl: editCommon.heroMediaUrl ?? "",
                heroMediaType: editCommon.heroMediaType ?? null,
              } as CompanyDoc
            }
            onChange={(v) =>
              setEditCommon((prev) => ({
                ...prev,
                heroMediaUrl: v.heroMediaUrl ?? "",
                heroMediaType: v.heroMediaType ?? null,
              }))
            }
            storage={storage}
          />
        ) : (
          <InlineMediaViewer
            url={displayData?.heroMediaUrl}
            type={displayData?.heroMediaType ?? null}
          />
        )}

        {/* 本体 */}
        <div className="p-6 md:p-8">
          {!isEditing ? (
            <ReadOnlyView data={displayData!} />
          ) : (
            <EditView
              base={editBase}
              common={editCommon}
              onBaseChange={setEditBase}
              onCommonChange={setEditCommon}
              onOpenAi={(target) => {
                setAiTarget(target);
                setAiOpen(true);
              }}
            />
          )}
        </div>
      </motion.div>

      {/* AIモーダル（文脈を渡す） */}
      <AiGenerateModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onGenerate={applyAiResult}
        target={aiTarget}
        context={{
          companyName: editBase.name,
          tagline: editBase.tagline,
          location: editBase.address,
          existingAbout: editBase.about ?? undefined,
          existingBusiness: editBase.business,
        }}
      />
    </div>
  );
}

/* ===================== ReadOnly ===================== */

/* ===================== Edit ===================== */
