import {
  addDoc,
  collection,
  doc,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { format } from "date-fns";

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

function safeDecode(str: string) {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

/**
 * ページIDの正規化（スラッシュ削除、クエリ・ハッシュ除去、スラッシュをアンダースコアに変換）
 */
function normalizePageId(path: string): string {
  // ① 余分な部分を除去
  const raw = path.replace(/^\/+/, "").split("?")[0].split("#")[0];

  // ② パーセントエンコード → 生文字列に
  const decoded = safeDecode(raw);

  // ③ 動的プレフィックスはまとめる
  if (decoded.startsWith("products/")) return "products";

  // ④ 残りはスラッシュをアンダースコアへ
  return decoded.replaceAll("/", "_");
}

export async function logHourlyAccess(siteKey: string, pageId: string) {
  try {
    const hour = new Date().getHours();

    await addDoc(collection(db, "analytics", siteKey, "hourlyLogs"), {
      siteKey,
      pageId,
      accessedAt: serverTimestamp(),
      hour,
    });
  } catch (error) {
    console.error("アクセスログ保存失敗:", error);
  }
}

export async function logDailyAccess(siteKey: string) {
  try {
    const todayId = format(new Date(), "yyyy-MM-dd");
    const dailyRef = doc(db, "analytics", siteKey, "dailyLogs", todayId);

    await runTransaction(db, async (transaction) => {
      const dailySnap = await transaction.get(dailyRef);
      if (dailySnap.exists()) {
        transaction.update(dailyRef, {
          count: (dailySnap.data().count || 0) + 1,
          updatedAt: serverTimestamp(),
        });
      } else {
        transaction.set(dailyRef, {
          count: 1,
          updatedAt: serverTimestamp(),
          accessedAt: serverTimestamp(),
        });
      }
    });
  } catch (error) {
    console.error("日別アクセスログ保存失敗:", error);
  }
}

export const logReferrer = async (siteKey: string) => {
  try {
    let referrer = document.referrer;

    if (!referrer) {
      referrer = "direct";
    } else {
      const url = new URL(referrer);
      referrer = url.hostname.replace(/^www\./, "");
    }

    const docRef = doc(db, "analytics", siteKey, "referrers", referrer);
    await setDoc(docRef, { count: increment(1) }, { merge: true });
  } catch (e) {
    console.error("リファラー記録エラー:", e);
  }
};

export async function logWeekdayAccess(siteKey: string) {
  try {
    const dayOfWeek = new Date().getDay(); // 0:日曜〜6:土曜
    const weekdayLabels = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const weekdayId = weekdayLabels[dayOfWeek];

    const ref = doc(db, "analytics", siteKey, "weekdayLogs", weekdayId);

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref);
      if (snap.exists()) {
        transaction.update(ref, {
          count: (snap.data().count || 0) + 1,
          updatedAt: serverTimestamp(),
        });
      } else {
        transaction.set(ref, {
          count: 1,
          updatedAt: serverTimestamp(),
        });
      }
    });
  } catch (error) {
    console.error("曜日別アクセスログ保存失敗:", error);
  }
}

// ① visitorId を localStorage に保持
/* ───────── ここから置き換え ───────── */
function generateUUID(): string {
  // 1. モダンブラウザ（crypto.randomUUID がある）
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // 2. getRandomValues で RFC4122 v4 を生成（iOS 15 以前でも動く）
  if (typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

    return [...bytes]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
  }

  // 3. さらに古い環境 → 簡易 ID
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}
/**
 * 新規 / リピーター を記録
 *   - 初訪問 → new++
 *   - 2 回目以降 → returning++
 */
export async function logVisitorType(siteKey: string) {
  try {
    const id = generateUUID();
    const ref = doc(db, "analytics", siteKey, "visitorStats", id);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const isNew = !snap.exists();

      tx.set(
        ref,
        {
          /* 初訪問であれば new:1 / returning:0 を入れる */
          new: isNew ? 1 : 0,
          returning: isNew ? 0 : 1,
          lastVisit: serverTimestamp(),
        },
        { merge: true }
      );
    });
  } catch (e) {
    console.error("visitorType 記録エラー:", e);
  }
}

export async function logBounce(siteKey: string, pageId: string) {
  const ref = doc(db, "analytics", siteKey, "bounceStats", pageId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) {
      tx.update(ref, {
        count: increment(1),
        totalViews: increment(1),
      });
    } else {
      tx.set(ref, {
        count: 1,
        totalViews: 1,
      });
    }
  });
}


export async function logGeo(siteKey: string, region: string) {
  try {
    const ref = doc(db, "analytics", siteKey, "geoStats", region);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists()) {
        tx.update(ref, { count: increment(1) });
      } else {
        tx.set(ref, { count: 1 });
      }
    });
  } catch (e) {
    console.error("地域別アクセスログ失敗:", e);
  }
}
