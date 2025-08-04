"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { logPageView, logStayTime } from "@/lib/logAnalytics";

const SITE_KEY = "yotteya";

export default function AnalyticsLogger() {
  const pathname = usePathname() || "/";
  const startTsRef = useRef(Date.now());
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    const prev = prevPathRef.current;
    const now = Date.now();

    const prevClean =
      prev && prev !== "/" ? prev.slice(1) : "home"; // 🔧 空文字対策
    const currClean =
      pathname && pathname !== "/" ? pathname.slice(1) : "home";

    const sec = Math.floor((now - startTsRef.current) / 1000);
    if (sec > 0 && sec <= 60) {
      logStayTime(SITE_KEY, sec, prevClean);
    }

    logPageView(currClean, SITE_KEY);
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
