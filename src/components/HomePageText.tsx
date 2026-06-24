"use client";

import { copy, site } from "@/config/site";
import { useUILang } from "@/lib/atoms/uiLangAtom";
import { useSiteKey } from "@/lib/atoms/siteKeyAtom";
import { motion, AnimatePresence, type Variants, type Transition } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function HomePageText() {
  const { uiLang } = useUILang();
  const siteKey = useSiteKey();
  const bundle = copy[uiLang] ?? copy["ja"];

  const [headline, setHeadline] = useState(bundle.home.headline || site.name);
  const [description, setDescription] = useState(bundle.home.description || "");
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftHeadline, setDraftHeadline] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      getDoc(doc(db, "siteSettings", siteKey)),
      getDoc(doc(db, "siteSettingsEditable", siteKey)),
    ]).then(([s, e]) => {
      const name = s.data()?.siteName as string | undefined;
      const desc = e.data()?.homeDescription as string | undefined;
      if (name) setHeadline(name);
      if (desc !== undefined) setDescription(desc);
    });
  }, [siteKey]);

  useEffect(() => onAuthStateChanged(auth, (u) => setIsAdmin(!!u)), []);

  const openEdit = () => {
    setDraftHeadline(headline);
    setDraftDesc(description);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await Promise.all([
      setDoc(doc(db, "siteSettings", siteKey), { siteName: draftHeadline }, { merge: true }),
      setDoc(doc(db, "siteSettingsEditable", siteKey), { homeDescription: draftDesc }, { merge: true }),
    ]);
    setHeadline(draftHeadline);
    setDescription(draftDesc);
    setSaving(false);
    setEditing(false);
  };

  // ★ スクロール検知
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.2 });

  const EASE: Transition["ease"] = [0.16, 1, 0.3, 1];

  function StaggerText({
    text, className, as = "p", delay = 0.2, duration = 0.7, stagger = 0.035,
  }: {
    text: string; className?: string; as?: "h1" | "p";
    delay?: number; duration?: number; stagger?: number;
  }) {
    const parent: Variants = {
      hidden: {},
      show: { transition: { staggerChildren: stagger, delayChildren: delay } },
    };
    const child: Variants = {
      hidden: { opacity: 0, y: 8 },
      show: { opacity: 1, y: 0, transition: { duration, ease: EASE } },
    };
    const MotionTag = as === "h1" ? motion.h1 : motion.p;
    return (
      <MotionTag variants={parent} initial="hidden" animate={inView ? "show" : "hidden"} className={className}>
        {Array.from(text).map((ch, i) => (
          <motion.span key={i} variants={child} className="inline-block">
            {ch === " " ? " " : ch}
          </motion.span>
        ))}
      </MotionTag>
    );
  }

  return (
    <>
      <div ref={ref} className="flex flex-col items-center text-center space-y-6 bg-white/30 backdrop-blur-md rounded-3xl shadow-2xl border border-white/50 px-8 py-10 max-w-2xl mx-auto">
        <StaggerText
          text={headline}
          as="h1"
          className="text-3xl lg:text-4xl font-extrabold leading-tight text-white text-outline"
          stagger={0.05}
          duration={0.7}
          delay={0.1}
        />
        {description && (
          <StaggerText
            text={description}
            className="max-w-3xl text-sm md:text-lg opacity-80 leading-relaxed text-black"
            delay={0.3}
            stagger={0.02}
            duration={0.5}
          />
        )}
        {isAdmin && (
          <motion.button
            onClick={openEdit}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
          >
            編集する
          </motion.button>
        )}
      </div>

      {/* 編集モーダル */}
      <AnimatePresence>
        {isAdmin && editing && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/50"
              aria-hidden
              onClick={() => setEditing(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              className="relative w-full max-w-lg mx-4 rounded-2xl bg-white shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
            >
              <h2 className="text-lg font-bold text-gray-800">トップテキストを編集</h2>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">店舗名・見出し</label>
                <input
                  value={draftHeadline}
                  onChange={(e) => setDraftHeadline(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="店舗名"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">説明文</label>
                <textarea
                  value={draftDesc}
                  onChange={(e) => setDraftDesc(e.target.value)}
                  rows={5}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  placeholder="お店の紹介文を入力..."
                />
                <p className="text-right text-xs text-gray-400">{draftDesc.length}文字</p>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "保存中..." : "保存する"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
