"use client";

import Image from "next/image";
import { useRef, useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  getStorage,
  ref as storageRef,
  deleteObject,
  getMetadata,
} from "firebase/storage";
import { doc, updateDoc, deleteField, onSnapshot } from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { useSiteKey } from "@/lib/atoms/siteKeyAtom";

export default function FaviconPicker({
  onSelectFile,
}: {
  onSelectFile: (file: File) => void;
}) {
  const siteKey = useSiteKey();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "siteSettingsEditable", siteKey),
      (snap) => {
        const data = snap.data();
        if (data?.faviconUrl?.startsWith("http")) {
          setUrl(data.faviconUrl);
        } else {
          setUrl("");
        }
      }
    );
    return () => unsub();
  }, [siteKey]);

  const handleDelete = async () => {
    if (!confirm("本当にfaviconを削除しますか？")) return;
    setDeleting(true);
    const faviconRef = storageRef(
      getStorage(),
      `images/public/${siteKey}/favicon.png`
    );
    try {
      await updateDoc(doc(db, "siteSettingsEditable", siteKey), {
        faviconUrl: deleteField(),
      });
      await getMetadata(faviconRef);
      await deleteObject(faviconRef);
      alert("faviconを削除しました。");
    } catch (error) {
      if (error instanceof FirebaseError && error.code === "storage/object-not-found") {
        alert("FirestoreのURLは削除しましたが、Storage上には画像が見つかりませんでした。");
      } else {
        alert("削除に失敗しました。");
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="relative w-16 h-16 rounded shadow border overflow-hidden bg-gray-100">
      {url ? (
        <Image
          src={url}
          alt="favicon"
          fill
          sizes="64px"
          className="object-contain p-1"
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs text-center leading-tight px-1">
          No favicon
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelectFile(file);
        }}
      />

      {url && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="absolute top-0 right-0 z-20 bg-red-500 text-white text-xs px-1 py-0.5 rounded-bl hover:bg-red-600"
        >
          削除
        </button>
      )}
    </div>
  );
}
