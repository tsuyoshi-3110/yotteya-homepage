import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

// 除外対象のページID
const EXCLUDE_PAGES = ["login", "analytics", "community", "postList"];

/**
 * ページ表示のログを記録する（除外対象は記録しない）
 */
export const logPageView = async (path: string, siteKey: string) => {
  const pageId = normalizePageId(path);
  if (EXCLUDE_PAGES.includes(pageId)) return;

  const docRef = doc(db, "analytics", siteKey, "pages", pageId);

  await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(docRef);
    if (docSnap.exists()) {
      transaction.update(docRef, {
        count: (docSnap.data().count || 0) + 1,
        updatedAt: serverTimestamp(),
      });
    } else {
      transaction.set(docRef, {
        count: 1,
        updatedAt: serverTimestamp(),
      });
    }
  });
};

/**
 * イベントクリック数の記録（除外対象なし）
 */
export const logEvent = async (
  eventName: string,
  siteKey: string,
  label?: string
) => {
  const docRef = doc(db, "analytics", siteKey, "events", eventName);

  await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(docRef);
    if (docSnap.exists()) {
      transaction.update(docRef, {
        count: (docSnap.data().count || 0) + 1,
        updatedAt: serverTimestamp(),
        label: label || null,
      });
    } else {
      transaction.set(docRef, {
        count: 1,
        updatedAt: serverTimestamp(),
        label: label || null,
      });
    }
  });
};

/**
 * 滞在時間を記録（除外対象のページは記録しない）
 */
export const logStayTime = async (
  siteKey: string,
  seconds: number,
  pageId?: string
) => {
  const cleanId = normalizePageId(pageId || "home");
  if (EXCLUDE_PAGES.includes(cleanId)) return;

  const eventDoc = `home_stay_seconds_${cleanId}`;
  const docRef = doc(db, "analytics", siteKey, "events", eventDoc);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(docRef);
    const prev = snap.exists() ? snap.data() : { totalSeconds: 0, count: 0 };

    tx.set(
      docRef,
      {
        totalSeconds: (prev.totalSeconds ?? 0) + seconds,
        count: (prev.count ?? 0) + 1,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });
};

/**
 * ページIDの正規化（スラッシュ削除、クエリ・ハッシュ除去、スラッシュをアンダースコアに変換）
 */
function normalizePageId(path: string): string {
  return path
    .replace(/^\/+/, "") // 先頭のスラッシュを削除
    .split("?")[0]       // クエリパラメータを削除
    .split("#")[0]       // ハッシュを削除
    .replaceAll("/", "_"); // スラッシュをアンダースコアに置換
}
