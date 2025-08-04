"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format } from "date-fns";
import CardSpinner from "@/components/CardSpinner";
import { Bar } from "react-chartjs-2";
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from "chart.js";
import { saveAs } from "file-saver";

Chart.register(CategoryScale, LinearScale, BarElement, Tooltip);

const todayDate = new Date();
const oneMonthAgo = new Date();
oneMonthAgo.setDate(todayDate.getDate() - 30);

const today = format(todayDate, "yyyy-MM-dd");
const defaultStart = format(oneMonthAgo, "yyyy-MM-dd");

const PAGE_LABELS: Record<string, string> = {
  home: "ホーム",
  about: "当店の思い",
  products: "商品一覧ページ",
  stores: "店舗一覧ページ",
  "uber-eats": "デリバリーページ",
  news: "お知らせページ",
  email: "メールアクセス",
  map_click: "マップアクセス",
};

const EVENT_LABELS: Record<string, string> = {
  home_stay_seconds_home: "ホーム滞在",
  home_stay_seconds_about: "当店の思い滞在",
  home_stay_seconds_products: "商品一覧滞在",
  home_stay_seconds_stores: "店舗一覧滞在",
  home_stay_seconds_news: "お知らせ滞在",
  home_stay_seconds_email: "メールアクセス滞在",
  home_stay_seconds_map_click: "マップアクセス滞在",
};

const EXCLUDED_PAGE_IDS = ["login", "analytics", "community", "postList"];

export default function AnalyticsPage() {
  const siteKey = "yotteya";

  const [pageData, setPageData] = useState<{ id: string; count: number }[]>([]);
  const [eventData, setEventData] = useState<
    { id: string; total: number; count: number; average: number }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(today);
  const [advice, setAdvice] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate
        ? new Date(new Date(endDate).setHours(23, 59, 59, 999))
        : null;

      const pagesRef = collection(db, "analytics", siteKey, "pages");
      const pagesSnap = await getDocs(pagesRef);
      const pages: Record<string, number> = {};
      pagesSnap.forEach((doc) => {
        const data = doc.data();
        const updatedAt: Timestamp = data.updatedAt;
        if (
          updatedAt &&
          (!start || updatedAt.toDate() >= start) &&
          (!end || updatedAt.toDate() <= end)
        ) {
          pages[doc.id] = (pages[doc.id] || 0) + (data.count ?? 0);
        }
      });

      const sortedPages = Object.entries(pages)
        .map(([id, count]) => ({ id, count }))
        .filter((item) => !EXCLUDED_PAGE_IDS.includes(item.id))
        .sort((a, b) => b.count - a.count);
      setPageData(sortedPages);

      const eventsRef = collection(db, "analytics", siteKey, "events");
      const eventsSnap = await getDocs(eventsRef);
      const events: Record<string, { totalSeconds: number; count: number }> =
        {};
      eventsSnap.forEach((doc) => {
        const data = doc.data();
        const updatedAt: Timestamp = data.updatedAt;
        if (
          updatedAt &&
          (!start || updatedAt.toDate() >= start) &&
          (!end || updatedAt.toDate() <= end)
        ) {
          const id = doc.id;
          const total = data.totalSeconds ?? 0;
          const cnt = data.count ?? 1;
          if (!events[id]) {
            events[id] = { totalSeconds: total, count: cnt };
          } else {
            events[id].totalSeconds += total;
            events[id].count += cnt;
          }
        }
      });

      const sortedEvents = Object.entries(events)
        .map(([id, val]) => ({
          id,
          total: val.totalSeconds,
          count: val.count,
          average: val.count ? Math.round(val.totalSeconds / val.count) : 0,
        }))
        .sort((a, b) => b.total - a.total);
      setEventData(sortedEvents);
    } catch (e) {
      console.error("取得エラー:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCSVExport = () => {
    const csv = ["ページ,アクセス数"];
    pageData.forEach((d) => {
      csv.push(`${PAGE_LABELS[d.id] || d.id},${d.count}`);
    });

    csv.push("", "イベント,合計秒数,回数,平均秒数");
    eventData.forEach((d) => {
      csv.push(
        `${EVENT_LABELS[d.id] || d.id},${d.total},${d.count},${d.average}`
      );
    });

    const blob = new Blob([csv.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    saveAs(blob, `analytics_${today}.csv`);
  };

  const handleAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-insights", {
        method: "POST",
        body: JSON.stringify({
          period: startDate && endDate ? `${startDate}〜${endDate}` : "全期間",
          pageData,
          eventData,
        }),
      });
      const data = await res.json();
      setAdvice(data.advice);
    } catch (err) {
      console.error("分析エラー:", err);
      setAdvice("AIによる提案の取得に失敗しました。");
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <h2 className="text-xl font-bold text-white">アクセス解析</h2>

      <div className="flex gap-4 text-white text-sm items-end mb-2">
        <div>
          <label>開始日:</label>
          <input
            type="date"
            value={startDate}
            max={today}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-black"
          />
        </div>
        <div>
          <label>終了日:</label>
          <input
            type="date"
            value={endDate}
            min={startDate || "1970-01-01"}
            max={today}
            onChange={(e) => setEndDate(e.target.value)}
            className="text-black"
          />
        </div>
        <button
          onClick={fetchData}
          className="bg-blue-600 text-white px-3 py-1 rounded"
        >
          更新
        </button>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleAnalysis}
          disabled={analyzing}
          className={`px-3 py-1 rounded text-sm text-white ${
            analyzing ? "bg-purple-300 cursor-not-allowed" : "bg-purple-600"
          }`}
        >
          {analyzing ? "分析中..." : "AI による改善提案（ChatGPT分析）"}
        </button>
        <button
          onClick={handleCSVExport}
          className="bg-gray-700 text-white px-3 py-1 rounded text-sm"
        >
          CSV 出力
        </button>
      </div>

      {loading ? (
        <CardSpinner />
      ) : (
        <>
          <table className="w-full bg-gray-100/50 border text-sm table-fixed">
            <thead>
              <tr className="bg-gray-200">
                <th className="p-2 border w-3/4">ページ名</th>
                <th className="p-2 border text-right w-1/4">アクセス数</th>
              </tr>
            </thead>
            <tbody>
              {pageData.map((row) => (
                <tr key={row.id}>
                  <td className="p-2 border">{PAGE_LABELS[row.id] || row.id}</td>
                  <td className="p-2 border text-right">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <table className="w-full bg-gray-100/50 border text-sm table-fixed mt-6">
            <thead>
              <tr className="bg-gray-200">
                <th className="p-2 border w-2/5">イベント名</th>
                <th className="p-2 border text-right w-1/5">合計秒数</th>
                <th className="p-2 border text-right w-1/5">回数</th>
                <th className="p-2 border text-right w-1/5">平均秒数</th>
              </tr>
            </thead>
            <tbody>
              {eventData.map((row) => (
                <tr key={row.id}>
                  <td className="p-2 border">{EVENT_LABELS[row.id] || row.id}</td>
                  <td className="p-2 border text-right">{row.total}</td>
                  <td className="p-2 border text-right">{row.count}</td>
                  <td className="p-2 border text-right">{row.average}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {pageData.length > 0 && (
        <div className="bg-white rounded p-4 shadow">
          <Bar
            data={{
              labels: pageData.map((d) => PAGE_LABELS[d.id] || d.id),
              datasets: [
                {
                  label: "アクセス数",
                  data: pageData.map((d) => d.count),
                  backgroundColor: "rgba(59, 130, 246, 0.6)",
                },
              ],
            }}
            options={{
              responsive: true,
              plugins: { tooltip: { enabled: true } },
            }}
          />
        </div>
      )}

      {advice && (
        <div className="bg-white rounded p-4 text-sm leading-relaxed space-y-2">
          <h3 className="font-semibold mb-2">AIによる改善提案</h3>
          <pre className="whitespace-pre-wrap">{advice}</pre>
        </div>
      )}
    </div>
  );
}
