"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  logPageView,
  logStayTime,
  logHourlyAccess,
  logDailyAccess,
  logReferrer,
  logWeekdayAccess,
  logVisitorType,
  logBounce,
  logGeo,
  logLandingView,
  normalizePageId as normalizeId,
} from "@/lib/logAnalytics";
import { useSiteKey } from "@/lib/atoms/siteKeyAtom";

const STAY_MAX_SEC = 60;
const EXCLUDED = new Set(["login", "analytics", "community", "postList"]);

export default function AnalyticsLogger() {
  const siteKey = useSiteKey();
  const pathname = usePathname() || "/";
  const startTsRef = useRef<number>(Date.now());
  const prevPathRef = useRef<string>(pathname);
  const pageCountRef = useRef<number>(0);

  const flushedRef = useRef(false);
  const bouncedRef = useRef(false);

  /* 1) セッション一度だけ：地域 */
  useEffect(() => {
    const key = `geoLogged:${siteKey}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    const ac = new AbortController();
    fetch("https://ipapi.co/json", { signal: ac.signal })
      .then((res) => res.json())
      .then((data) => {
        const region = data?.region || data?.country_name || "Unknown";
        logGeo(siteKey, region);
      })
      .catch((e) => {
        if (e?.name !== "AbortError") console.error("地域取得失敗:", e);
      });

    return () => ac.abort();
  }, [siteKey]);

  /* 2) セッション一度だけ：リファラー */
  useEffect(() => {
    const key = `refLogged:${siteKey}`;
    if (sessionStorage.getItem(key)) return;
    logReferrer(siteKey);
    sessionStorage.setItem(key, "1");
  }, [siteKey]);

  /* 3) ランディング views と バウンス（セッション内） */
  useEffect(() => {
    pageCountRef.current++;

    if (pageCountRef.current === 1) {
      const firstId = normalizeId(pathname);
      if (!EXCLUDED.has(firstId)) {
        logLandingView(siteKey, firstId);
      }
    }

    bouncedRef.current = false;

    const handleBounce = () => {
      if (bouncedRef.current) return;
      bouncedRef.current = true;

      if (pageCountRef.current === 1) {
        const id = normalizeId(pathname);
        if (!EXCLUDED.has(id)) {
          logBounce(siteKey, id);
        }
      }
    };

    window.addEventListener("beforeunload", handleBounce);
    window.addEventListener("pagehide", handleBounce);
    const visHandler = () => {
      if (document.visibilityState === "hidden") handleBounce();
    };
    document.addEventListener("visibilitychange", visHandler);

    return () => {
      window.removeEventListener("beforeunload", handleBounce);
      window.removeEventListener("pagehide", handleBounce);
      document.removeEventListener("visibilitychange", visHandler);
    };
  }, [pathname, siteKey]);

  /* 4) ルート変更：直前滞在時間を反映し、各種ログ */
  useEffect(() => {
    const prev = prevPathRef.current;
    const now = Date.now();

    const prevId = normalizeId(prev);
    const currId = normalizeId(pathname);

    const sec = Math.floor((now - startTsRef.current) / 1000);
    if (sec > 0 && sec <= STAY_MAX_SEC) {
      logStayTime(siteKey, sec, prevId);
    }

    if (!EXCLUDED.has(currId)) {
      logPageView(pathname, siteKey);
      logHourlyAccess(siteKey, currId);
      logDailyAccess(siteKey);
      logWeekdayAccess(siteKey);
      logVisitorType(siteKey);
    }

    prevPathRef.current = pathname;
    startTsRef.current = now;
    flushedRef.current = false;
  }, [pathname, siteKey]);

  /* 5) タブクローズ/遷移直前：最終滞在時間フラッシュ（二重防止） */
  useEffect(() => {
    flushedRef.current = false;

    const handleLeave = () => {
      if (flushedRef.current) return;
      flushedRef.current = true;

      const id = normalizeId(pathname);
      const sec = Math.floor((Date.now() - startTsRef.current) / 1000);
      if (sec > 0 && sec <= STAY_MAX_SEC) {
        logStayTime(siteKey, sec, id);
      }
    };

    window.addEventListener("beforeunload", handleLeave);
    window.addEventListener("pagehide", handleLeave);
    const visHandler = () => {
      if (document.visibilityState === "hidden") handleLeave();
    };
    document.addEventListener("visibilitychange", visHandler);

    return () => {
      window.removeEventListener("beforeunload", handleLeave);
      window.removeEventListener("pagehide", handleLeave);
      document.removeEventListener("visibilitychange", visHandler);
    };
  }, [pathname, siteKey]);

  return null;
}
