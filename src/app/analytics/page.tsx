"use client";

import { useCallback, useEffect, useState } from "react";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format, subDays } from "date-fns"; // ★ subDays を追加
import CardSpinner from "@/components/CardSpinner";
import { Bar } from "react-chartjs-2";
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from "chart.js";

import DailyAccessChart from "@/components/DailyAccessChart";
import ReferrerChart from "@/components/ReferrerChart";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

Chart.register(CategoryScale, LinearScale, BarElement, Tooltip);

/* ───────── 期間計算用ヘルパー ───────── */
const calcStart = (daysAgo: number) =>
  format(subDays(new Date(), daysAgo), "yyyy-MM-dd");

const TODAY = format(new Date(), "yyyy-MM-dd"); // 例: 2025-08-06
const DEFAULT_START = calcStart(30); // デフォルト = 過去 30 日

/* ───────── ラベル定義 ───────── */
const PAGE_LABELS: Record<string, string> = {
  home: "ホーム",
  about: "当店の思い",
  products: "商品一覧ページ",
  stores: "店舗一覧ページ",
  "uber-eats": "デリバリーページ",
  news: "お知らせページ",
  email: "メールアクセス",
  map_click: "マップアクセス",
  analytics: "アクセス解析",
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
  const [startDate, setStartDate] = useState(DEFAULT_START);
  const [endDate, setEndDate] = useState(TODAY);
  const [advice, setAdvice] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [hourlyData, setHourlyData] = useState<any | null>(null);
  const [hourlyLoading, setHourlyLoading] = useState(false);
  const [hourlyRawCounts, setHourlyRawCounts] = useState<number[]>([]);
  const [dailyData, setDailyData] = useState<any | null>(null);
  const [referrerData, setReferrerData] = useState({
    sns: 0,
    search: 0,
    direct: 0,
  });
  const [weekdayData, setWeekdayData] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [visitorStats, setVisitorStats] = useState<{
    new: number;
    returning: number;
  } | null>(null);
  const [bounceRates, setBounceRates] = useState<
    { page: string; rate: number }[]
  >([]);
  const [geoData, setGeoData] = useState<{ region: string; count: number }[]>(
    []
  );

  const presets = [
    { label: "過去 1 週間", days: 7 },
    { label: "過去 1 か月", days: 30 },
    { label: "過去 3 か月", days: 90 },
  ];

  const handlePreset = (days: number) => {
    setStartDate(calcStart(days));
    setEndDate(TODAY); // 常に今日まで
    setAdvice("");
  };

  useEffect(() => {
    const fetchGeo = async () => {
      const ref = collection(db, "analytics", "yotteya", "geoStats");
      const snap = await getDocs(ref);
      const arr = snap.docs.map((d) => ({
        region: d.id,
        count: d.data().count as number,
      }));
      setGeoData(arr);
    };
    fetchGeo();
  }, []);

  // 期間が変わるたび自動で AI 提案をリセットしておきたい場合
  useEffect(() => {
    setAdvice("");
  }, [startDate, endDate]);

  // AnalyticsPage.tsx で集計
  useEffect(() => {
    const fetchBounce = async () => {
      const statsRef = collection(db, "analytics", siteKey, "bounceStats");
      const snap = await getDocs(statsRef);
      const bounceRates = snap.docs.map((d) => {
        const { count, totalViews } = d.data();
        return {
          page: d.id,
          rate: totalViews > 0 ? (count / totalViews) * 100 : 0,
        };
      });
      setBounceRates(bounceRates);
    };
    fetchBounce();
  }, [siteKey]);

  useEffect(() => {
    const fetchVisitorStats = async () => {
      const ref = collection(db, "analytics", siteKey, "visitorStats");
      const snap = await getDocs(ref);

      let newTotal = 0;
      let returningTotal = 0;

      snap.docs.forEach((d) => {
        const data = d.data() as { new?: number; returning?: number };
        newTotal += data.new ?? 0;
        returningTotal += data.returning ?? 0;
      });

      setVisitorStats({ new: newTotal, returning: returningTotal });
    };

    fetchVisitorStats();
  }, [siteKey]);

  /* ───────── fetchData (依存配列を追加済) ───────── */

  useEffect(() => {
    const fetchWeekdayAccessData = async () => {
      try {
        // ── analytics/{siteKey}/weekdayLogs/{sun|mon|tue|…} ──
        const ref = collection(db, "analytics", siteKey, "weekdayLogs");
        const snap = await getDocs(ref);

        // Firestore の doc.id ➜ 0‒6 に変換する対応表
        const weekdayIndex: Record<string, number> = {
          sun: 0,
          mon: 1,
          tue: 2,
          wed: 3,
          thu: 4,
          fri: 5,
          sat: 6,
        };

        const countsByWeekday = Array(7).fill(0); // 0:日〜6:土

        snap.docs.forEach((doc) => {
          const idx = weekdayIndex[doc.id]; // ← doc.id を見る
          if (idx !== undefined) {
            countsByWeekday[idx] += doc.data().count ?? 0;
          }
        });

        setWeekdayData({
          labels: ["日", "月", "火", "水", "木", "金", "土"],
          datasets: [
            {
              label: "曜日別アクセス数",
              data: countsByWeekday,
              backgroundColor: "rgba(139, 92, 246, 0.6)", // violet
            },
          ],
        });
      } catch (err) {
        console.error("曜日別アクセスデータ取得エラー:", err);
      }
    };

    fetchWeekdayAccessData();
  }, [siteKey]);

  useEffect(() => {
    const fetchReferrerData = async () => {
      const ref = collection(db, "analytics", siteKey, "referrers"); // ★ 修正
      const snap = await getDocs(ref);

      const total = { sns: 0, search: 0, direct: 0 };

      snap.docs.forEach((doc) => {
        const host = doc.id; // 例: "instagram.com" or "direct"
        const cnt = doc.data().count ?? 0; // 例: {count: 12}

        if (host === "direct") {
          total.direct += cnt;
        } else if (
          /google\./.test(host) ||
          /bing\.com/.test(host) ||
          /yahoo\./.test(host)
        ) {
          total.search += cnt;
        } else {
          total.sns += cnt; // その他は SNS 扱い
        }
      });

      setReferrerData(total);
    };

    fetchReferrerData();
  }, [siteKey]);

  useEffect(() => {
    const fetchDailyData = async () => {
      try {
        const start = new Date(startDate);
        const end = new Date(new Date(endDate).setHours(23, 59, 59, 999));
        const ref = collection(db, "analytics", siteKey, "dailyLogs");
        const snap = await getDocs(ref);

        type DailyLog = {
          updatedAt?: Timestamp;
          count?: number;
        };

        const raw = snap.docs
          .map((doc) => {
            const data = doc.data() as DailyLog;
            return {
              id: doc.id,
              count: data.count ?? 0,
              updatedAt: data.updatedAt?.toDate?.(),
            };
          })
          .filter((doc) => {
            return (
              doc.updatedAt && doc.updatedAt >= start && doc.updatedAt <= end
            );
          });

        const sorted = raw.sort((a, b) => (a.id < b.id ? -1 : 1));
        const labels = sorted.map((d) => d.id);
        const counts = sorted.map((d) => d.count);

        setDailyData({
          labels,
          datasets: [
            {
              label: "日別アクセス数",
              data: counts,
              fill: false,
              borderColor: "rgba(75,192,192,1)",
              tension: 0.3,
            },
          ],
        });
      } catch (err) {
        console.error("日別データ取得エラー:", err);
      }
    };

    fetchDailyData();
  }, [siteKey, startDate, endDate]);

  function groupByHour(
    logs: { hour: number; accessedAt?: any }[],
    start: Date,
    end: Date
  ): number[] {
    const hourlyCounts = Array(24).fill(0);

    for (const log of logs) {
      const ts = log.accessedAt?.toDate?.();
      if (!ts) continue;
      if (ts >= start && ts <= end && typeof log.hour === "number") {
        hourlyCounts[log.hour]++;
      }
    }

    return hourlyCounts;
  }

  function getHourlyChartData(counts: number[]) {
    return {
      labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      datasets: [
        {
          label: "アクセス数",
          data: counts,
          backgroundColor: "rgba(255, 159, 64, 0.6)", // orange
        },
      ],
    };
  }

  useEffect(() => {
    const fetchHourlyData = async () => {
      setHourlyLoading(true);
      try {
        const start = new Date(startDate);
        const end = new Date(new Date(endDate).setHours(23, 59, 59, 999));
        const logsRef = collection(db, "analytics", siteKey, "hourlyLogs");
        const snap = await getDocs(logsRef);
        const logs = snap.docs.map(
          (doc) => doc.data() as { hour: number; accessedAt?: Timestamp }
        );
        const hourlyCounts = groupByHour(logs, start, end);
        setHourlyRawCounts(hourlyCounts); // ← これをAIへ渡す
        setHourlyData(getHourlyChartData(hourlyCounts)); // ← これはChart用
      } catch (err) {
        console.error("時間帯データ取得エラー:", err);
      } finally {
        setHourlyLoading(false);
      }
    };

    fetchHourlyData();
  }, [siteKey, startDate, endDate]);

  const fetchData = useCallback(async () => {
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
  }, [siteKey, startDate, endDate]);

  const handleAnalysis = async () => {
    console.log("referrerData:", referrerData);

    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          period: startDate && endDate ? `${startDate}〜${endDate}` : "全期間",
          pageData,
          eventData,
          hourlyData: hourlyRawCounts,
          dailyData,
          referrerData,
          weekdayData,
          visitorStats,
          bounceRates,
          geoData,
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

      <div className="flex flex-wrap gap-2 mb-4">
        {presets.map((p) => {
          // 現在の startDate / endDate と一致するか判定
          const isActive = startDate === calcStart(p.days) && endDate === TODAY;

          return (
            <Button
              key={p.days}
              onClick={() => handlePreset(p.days)}
              // ── 選択中は濃い色、未選択は淡い色 ──
              variant={isActive ? "default" : "secondary"}
              className={`text-xs ${isActive ? "pointer-events-none" : ""}`}
            >
              {p.label}
            </Button>
          );
        })}
        {/* カスタム日付入力を残す場合はここに追加 */}
      </div>

      <div className="flex gap-3">
        {!advice && (
          <button
            onClick={handleAnalysis}
            disabled={analyzing}
            className={`px-3 py-1 rounded text-sm text-white w-50 ${
              analyzing ? "bg-purple-300 cursor-not-allowed" : "bg-purple-600"
            }`}
          >
            {analyzing ? "分析中..." : "AI による改善提案"}
          </button>
        )}

        {advice && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="">AIの改善提案を見る</Button>
            </DialogTrigger>

            <DialogContent className="max-w-md sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>AIによる改善提案</DialogTitle>
                <DialogDescription>
                  この期間のアクセスデータをもとに、ホームページの改善案を表示しています。
                </DialogDescription>
              </DialogHeader>

              <div className="mt-2 text-sm whitespace-pre-wrap leading-relaxed">
                {advice}
              </div>
            </DialogContent>
          </Dialog>
        )}
        {/* <button
          onClick={handleCSVExport}
          className="bg-gray-700 text-white px-3 py-1 rounded text-sm"
        >
          CSV 出力
        </button> */}
      </div>

      {loading ? (
        <CardSpinner />
      ) : (
        <>
          <div className="bg-white/50 rounded p-4 shadow mt-6">
            <h3 className="font-semibold text-lg mb-4">ページ別アクセス数</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* グラフ */}
              <div className="w-full h-64">
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
                    scales: {
                      y: {
                        beginAtZero: true,
                        title: { display: true, text: "件数" },
                      },
                    },
                  }}
                />
              </div>

              {/* テーブル */}
              <div className="overflow-auto">
                <table className="w-full bg-gray-100/50 border text-sm table-fixed">
                  <thead>
                    <tr className="bg-gray-200">
                      <th className="p-2 border">ページ名</th>
                      <th className="p-2 border text-right">アクセス数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.map((row) => (
                      <tr key={row.id}>
                        <td className="p-2 border">
                          {PAGE_LABELS[row.id] || row.id}
                        </td>
                        <td className="p-2 border text-right">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="bg-white/50 rounded p-4 shadow mt-6">
            <h3 className="font-semibold text-lg mb-4">ページ別平均滞在時間</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 棒グラフ */}
              <div className="w-full h-64">
                <Bar
                  data={{
                    labels: eventData.map((d) => EVENT_LABELS[d.id] || d.id),
                    datasets: [
                      {
                        label: "平均滞在秒数",
                        data: eventData.map((d) => d.average),
                        backgroundColor: "rgba(16, 185, 129, 0.6)", // teal系
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    plugins: { tooltip: { enabled: true } },
                    scales: {
                      y: {
                        beginAtZero: true,
                        title: { display: true, text: "秒" },
                      },
                    },
                  }}
                />
              </div>

              {/* テーブル */}
              <div className="overflow-auto">
                <table className="w-full bg-gray-100/50 border text-sm table-fixed">
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
                        <td className="p-2 border">
                          {EVENT_LABELS[row.id] || row.id}
                        </td>
                        <td className="p-2 border text-right">{row.total}</td>
                        <td className="p-2 border text-right">{row.count}</td>
                        <td className="p-2 border text-right">{row.average}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {hourlyLoading ? (
            <CardSpinner />
          ) : hourlyData ? (
            <div className="bg-white/50 rounded p-4 shadow mt-6">
              <h3 className="font-semibold text-sm mb-2">時間帯別アクセス数</h3>
              <Bar
                data={hourlyData}
                options={{
                  responsive: true,
                  plugins: { tooltip: { enabled: true } },
                  scales: {
                    y: {
                      beginAtZero: true,
                      title: { display: true, text: "アクセス数" },
                    },
                  },
                }}
              />
            </div>
          ) : null}

          {weekdayData && (
            <div className="bg-white/50 rounded p-4 shadow mt-6">
              <h3 className="font-semibold text-sm mb-2">曜日別アクセス数</h3>
              <Bar
                data={weekdayData}
                options={{
                  responsive: true,
                  plugins: { tooltip: { enabled: true } },
                  scales: {
                    y: {
                      beginAtZero: true,
                      title: { display: true, text: "アクセス数" },
                    },
                  },
                }}
              />
            </div>
          )}

          {dailyData && (
            <div className="mt-8 bg-white/50">
              <DailyAccessChart data={dailyData} />
            </div>
          )}

          {referrerData && (
            <div className="p-6">
              <h2 className="text-lg font-bold mb-4">アクセス分析</h2>
              <ReferrerChart data={referrerData} />
            </div>
          )}
        </>
      )}

      {visitorStats && (
        <div className="bg-white/50 rounded p-4 shadow mt-6">
          <h3 className="font-semibold text-sm mb-2">新規 vs. リピーター</h3>
          <Bar
            data={{
              labels: ["新規", "リピーター"],
              datasets: [
                {
                  label: "訪問者数",
                  data: [visitorStats.new, visitorStats.returning],
                  backgroundColor: [
                    "rgba(96, 165, 250, 0.6)",
                    "rgba(34, 197, 94, 0.6)",
                  ],
                },
              ],
            }}
            options={{
              responsive: true,
              plugins: { tooltip: { enabled: true } },
              scales: { y: { beginAtZero: true } },
            }}
          />
        </div>
      )}

      {/* 直帰率グラフ */}
      {bounceRates.length > 0 && (
        <div className="bg-white/50 rounded p-4 shadow mt-6">
          <h3 className="font-semibold text-sm mb-2">直帰率（%）</h3>
          <Bar
            data={{
              labels: bounceRates.map((d) => PAGE_LABELS[d.page] || d.page),
              datasets: [
                {
                  label: "直帰率 (%)",
                  data: bounceRates.map((d) => Number(d.rate.toFixed(1))),
                  backgroundColor: "rgba(239, 68, 68, 0.6)", // red系
                },
              ],
            }}
            options={{
              responsive: true,
              scales: {
                y: {
                  beginAtZero: true,
                  max: 100,
                  title: { display: true, text: "直帰率 (%)" },
                },
              },
              plugins: {
                tooltip: {
                  callbacks: {
                    label: (ctx) => `${ctx.parsed.y}%`,
                  },
                },
              },
            }}
          />
        </div>
      )}

      {geoData.length > 0 && (
        <div className="bg-white/50 rounded p-4 shadow mt-6">
          <h3 className="font-semibold text-sm mb-2">地域別アクセス分布</h3>
          <Bar
            data={{
              labels: geoData.map((d) => d.region),
              datasets: [
                {
                  label: "アクセス数",
                  data: geoData.map((d) => d.count),
                  backgroundColor: "rgba(37, 99, 235, 0.6)", // blue
                },
              ],
            }}
            options={{
              responsive: true,
              plugins: { tooltip: { enabled: true } },
              scales: {
                y: {
                  beginAtZero: true,
                  title: { display: true, text: "アクセス数" },
                },
              },
            }}
          />
        </div>
      )}
    </div>
  );
}
