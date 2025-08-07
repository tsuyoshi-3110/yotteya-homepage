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
} from "@/lib/logAnalytics";

const SITE_KEY = "yotteya";

export default function AnalyticsLogger() {
  const pathname = usePathname() || "/";
  const startTsRef = useRef(Date.now());
  const prevPathRef = useRef(pathname);
  const pageCountRef = useRef(0);

  // ── 一度だけ IP ベースの地域取得 ＋ ログ
  useEffect(() => {
    if (sessionStorage.getItem("geoLogged")) return;
    sessionStorage.setItem("geoLogged", "1");

    // IP geolocation の例（無料の ipapi.co を利用）
    fetch("https://ipapi.co/json")
      .then((res) => res.json())
      .then((data) => {
        const region = data.region || data.country_name || "Unknown";
        logGeo("yotteya", region);
      })
      .catch((e) => console.error("地域取得失敗:", e));
  }, []);

  // ── セッション中のページ数をカウントし、
  //    1ページのみで離脱したらバウンスとしてログ
  useEffect(() => {
    pageCountRef.current++;

    const handleBounce = () => {
      if (pageCountRef.current === 1) {
        const pageId = pathname === "/" ? "home" : pathname.slice(1);
        logBounce(SITE_KEY, pageId);
      }
    };

    window.addEventListener("beforeunload", handleBounce);
    window.addEventListener("pagehide", handleBounce);
    return () => {
      window.removeEventListener("beforeunload", handleBounce);
      window.removeEventListener("pagehide", handleBounce);
    };
  }, [pathname]);

  useEffect(() => {
    const prev = prevPathRef.current;
    const now = Date.now();

    const prevClean = prev && prev !== "/" ? prev.slice(1) : "home";
    const currClean = pathname && pathname !== "/" ? pathname.slice(1) : "home";

    const sec = Math.floor((now - startTsRef.current) / 1000);
    if (sec > 0 && sec <= 60) {
      logStayTime(SITE_KEY, sec, prevClean);
    }

    logPageView(currClean, SITE_KEY);
    logHourlyAccess(SITE_KEY, currClean);
    logDailyAccess(SITE_KEY);
    logWeekdayAccess(SITE_KEY);
    logVisitorType(SITE_KEY);

    // ✅ 初回のみ referrer を記録（sessionStorage制御）
    if (!sessionStorage.getItem("refLogged")) {
      logReferrer(SITE_KEY);
      sessionStorage.setItem("refLogged", "1");
    }

    prevPathRef.current = pathname;
    startTsRef.current = now;
  }, [pathname]);

  useEffect(() => {
    const handleLeave = () => {
      const clean = pathname && pathname !== "/" ? pathname.slice(1) : "home";
      const sec = Math.floor((Date.now() - startTsRef.current) / 1000);
      if (sec > 0 && sec <= 60) {
        logStayTime(SITE_KEY, sec, clean);
      }
    };

    window.addEventListener("beforeunload", handleLeave);
    window.addEventListener("pagehide", handleLeave);

    return () => {
      window.removeEventListener("beforeunload", handleLeave);
      window.removeEventListener("pagehide", handleLeave);
    };
  }, [pathname]);

  return null;
}
