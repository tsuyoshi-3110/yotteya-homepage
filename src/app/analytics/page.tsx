"use client";

import { useCallback, useEffect, useState } from "react";
import { format, subDays } from "date-fns";
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

import {
  fetchPagesByPeriod,
  fetchEventsByPeriod,
  fetchReferrersByPeriod,
  fetchVisitorsByPeriod,
  fetchBounceByPeriod,
  fetchGeoByPeriod,
  fetchHourlyByPeriod,
  fetchDailyByPeriod,
  fetchWeekdayByPeriod,
} from "@/lib/logAnalytics";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";

Chart.register(CategoryScale, LinearScale, BarElement, Tooltip);

/* 期間計算 */
const calcStart = (daysAgo: number) =>
  format(subDays(new Date(), daysAgo), "yyyy-MM-dd");
const TODAY = format(new Date(), "yyyy-MM-dd");
const DEFAULT_START = calcStart(30);

/* 固定ラベル */
const PAGE_LABELS: Record<string, string> = {
  home: "ホーム",
  about: "当店の思い",
  products: "商品一覧ページ",
  stores: "店舗一覧ページ",
  "uber-eats": "デリバリーページ",
  news: "お知らせページ",
  email: "メールアクセス",
  map_click: "マップアクセス",
  staffs: "スタッフ紹介ぺージ",
  jobApp: "応募ページ",
  blog: "ブログページ",
  company: "会社概要ページ"
};

const EVENT_LABELS: Record<string, string> = {
  home_stay_seconds_home: "ホーム滞在",
  home_stay_seconds_about: "当店の思い滞在",
  home_stay_seconds_products: "商品一覧滞在",
  home_stay_seconds_stores: "店舗一覧滞在",
  home_stay_seconds_staffs: "スタッフ紹介滞在",
  home_stay_seconds_jobApp: "応募滞在",
  home_stay_seconds_news: "お知らせ滞在",
  home_stay_seconds_email: "メールアクセス滞在",
  home_stay_seconds_map_click: "マップアクセス滞在",
  home_stay_seconds_company: "会社概要滞在",
};

/* 生IDレベルの除外 */
const EXCLUDED_PAGE_IDS = ["login", "analytics", "community", "postList"];

/* ラベル化後に表示から除外するカテゴリ */
const EXCLUDE_LABELS = new Set<string>([
  "ブログ編集ページ",
  "ブログ新規作成",
  "api_probe",
  "ポーセラーツ",
  "アクセス解析",
  "postList",
  "login",
]);

/* オーナー専用ページ（直帰率から除外） */
const OWNER_ONLY_LABELS = new Set<string>([
  "アクセス解析",
  "analytics",
  "ブログ編集ページ",
  "ブログ新規作成",
  "postList",
  "login",
  "api_probe",
  "ポーセラーツ",
]);

/* ラベル変換 */
function formatPageLabelByRule(id: string): string {
  if (PAGE_LABELS[id]) return PAGE_LABELS[id];
  if (
    (id.startsWith("blog_") || id.startsWith("blog.")) &&
    id.endsWith("_edit")
  )
    return "ブログ編集ページ";
  if (id === "blog") return "ブログページ";
  if (id.startsWith("blog_") || id.startsWith("blog.")) return "ブログページ";
  if (id === "blog_new") return "ブログ新規作成";
  if (id.startsWith("products")) return "商品一覧ページ";
  if (id.length > 24) return "その他ページ";
  return id;
}

function formatEventLabelByRule(eventId: string): {
  label: string;
  keyForGroup: string;
  pageLabel?: string;
} {
  if (EVENT_LABELS[eventId])
    return { label: EVENT_LABELS[eventId], keyForGroup: EVENT_LABELS[eventId] };
  const m = /^home_stay_seconds_(.+)$/.exec(eventId);
  if (m) {
    const pageId = m[1];
    const pageLabel = formatPageLabelByRule(pageId);
    const label = `${pageLabel}滞在`;
    return { label, keyForGroup: label, pageLabel };
  }
  return { label: eventId, keyForGroup: eventId };
}

/* グラフ補助 */
function getHourlyChartData(counts: number[]) {
  return {
    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    datasets: [
      {
        label: "アクセス数",
        data: counts,
        backgroundColor: "rgba(255,159,64,0.6)",
      },
    ],
  };
}

export default function AnalyticsPage() {
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

  useEffect(() => setAdvice(""), [startDate, endDate]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setHourlyLoading(true);
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      const [
        pagesTotals,
        eventsTotals,
        refTotals,
        visitors,
        bouncePerPage,
        geoTotals,
        hourlyCounts,
        dailyRows,
        weekdayCounts,
      ] = await Promise.all([
        fetchPagesByPeriod(SITE_KEY, start, end),
        fetchEventsByPeriod(SITE_KEY, start, end),
        fetchReferrersByPeriod(SITE_KEY, start, end),
        fetchVisitorsByPeriod(SITE_KEY, start, end),
        fetchBounceByPeriod(SITE_KEY, start, end),
        fetchGeoByPeriod(SITE_KEY, start, end),
        fetchHourlyByPeriod(SITE_KEY, start, end),
        fetchDailyByPeriod(SITE_KEY, start, end),
        fetchWeekdayByPeriod(SITE_KEY, start, end),
      ]);

      /* ページ別アクセス */
      const pageMap: Record<string, number> = {};
      Object.entries(pagesTotals).forEach(([rawId, count]) => {
        if (EXCLUDED_PAGE_IDS.includes(rawId)) return;
        const label = formatPageLabelByRule(rawId);
        if (EXCLUDE_LABELS.has(label)) return;
        pageMap[label] = (pageMap[label] || 0) + (count || 0);
      });
      setPageData(
        Object.entries(pageMap)
          .map(([id, count]) => ({ id, count }))
          .sort((a, b) => b.count - a.count)
      );

      /* イベント（滞在時間） */
      const evtMap: Record<string, { totalSeconds: number; count: number }> =
        {};
      Object.entries(eventsTotals).forEach(([eventId, v]) => {
        const { keyForGroup, pageLabel } = formatEventLabelByRule(eventId);
        if (pageLabel && EXCLUDE_LABELS.has(pageLabel)) return;
        if (!evtMap[keyForGroup])
          evtMap[keyForGroup] = { totalSeconds: 0, count: 0 };
        evtMap[keyForGroup].totalSeconds += v.totalSeconds ?? 0;
        evtMap[keyForGroup].count += v.count ?? 0;
      });
      setEventData(
        Object.entries(evtMap)
          .map(([id, v]) => ({
            id,
            total: v.totalSeconds,
            count: v.count,
            average: v.count ? Math.round(v.totalSeconds / v.count) : 0,
          }))
          .sort((a, b) => b.total - a.total)
      );

      /* リファラー */
      setReferrerData(refTotals.buckets);

      /* 新規/リピーター */
      setVisitorStats(visitors);

      /* 直帰率：オーナー専用ページを除外 */
      const bounceMap: Record<string, { bounces: number; views: number }> = {};
      Object.entries(bouncePerPage).forEach(([rawPageId, v]) => {
        const label = formatPageLabelByRule(rawPageId);
        if (OWNER_ONLY_LABELS.has(label)) return; // ★ 除外
        if (!bounceMap[label]) bounceMap[label] = { bounces: 0, views: 0 };
        bounceMap[label].bounces += v.bounces || 0;
        bounceMap[label].views += v.views || 0;
      });
      setBounceRates(
        Object.entries(bounceMap).map(([page, v]) => ({
          page,
          rate: v.views > 0 ? (v.bounces / v.views) * 100 : 0,
        }))
      );

      /* 地域 */
      setGeoData(
        Object.entries(geoTotals).map(([region, count]) => ({ region, count }))
      );

      /* 時間帯 */
      setHourlyRawCounts(hourlyCounts);
      setHourlyData(getHourlyChartData(hourlyCounts));

      /* 日別アクセス */
      setDailyData({
        labels: dailyRows.map((r) => r.id),
        datasets: [
          {
            label: "日別アクセス数",
            data: dailyRows.map((r) => r.count),
            fill: false,
            borderColor: "rgba(75,192,192,1)",
            tension: 0.3,
          },
        ],
      });

      /* 曜日別 */
      setWeekdayData({
        labels: ["日", "月", "火", "水", "木", "金", "土"],
        datasets: [
          {
            label: "曜日別アクセス数",
            data: weekdayCounts,
            backgroundColor: "rgba(139,92,246,0.6)",
          },
        ],
      });
    } finally {
      setHourlyLoading(false);
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /* AI提案 */
  const handleAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: `${startDate}〜${endDate}`,
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
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <h2 className="text-xl font-bold text-white">アクセス解析</h2>

      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { label: "過去 1 週間", days: 7 },
          { label: "過去 1 か月", days: 30 },
          { label: "過去 3 か月", days: 90 },
        ].map((p) => {
          const isActive = startDate === calcStart(p.days) && endDate === TODAY;
          return (
            <Button
              key={p.days}
              onClick={() => {
                setStartDate(calcStart(p.days));
                setEndDate(TODAY);
                setAdvice("");
              }}
              variant={isActive ? "default" : "secondary"}
              className={`text-xs ${isActive ? "pointer-events-none" : ""}`}
            >
              {p.label}
            </Button>
          );
        })}
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
              <Button>AIの改善提案を見る</Button>
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
      </div>

      {loading ? (
        <CardSpinner />
      ) : (
        <>
          {/* ページ別アクセス数 */}
          <div className="bg-white/50 rounded p-4 shadow mt-6">
            <h3 className="font-semibold text-lg mb-4">ページ別アクセス数</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="w-full h-64">
                <Bar
                  data={{
                    labels: pageData.map((d) => d.id), // 既にラベル化・統合済み
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
                        <td className="p-2 border">{row.id}</td>
                        <td className="p-2 border text-right">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ページ別平均滞在時間 */}
          <div className="bg-white/50 rounded p-4 shadow mt-6">
            <h3 className="font-semibold text-lg mb-4">ページ別平均滞在時間</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="w-full h-64">
                <Bar
                  data={{
                    labels: eventData.map((d) => d.id), // 既にラベル化（◯◯滞在）
                    datasets: [
                      {
                        label: "平均滞在秒数",
                        data: eventData.map((d) => d.average),
                        backgroundColor: "rgba(16, 185, 129, 0.6)",
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
                        <td className="p-2 border">{row.id}</td>
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

          {/* 時間帯別アクセス */}
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

          {/* 曜日別アクセス */}
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

          {/* 日別アクセス（ライン） */}
          {dailyData && (
            <div className="mt-8 bg-white/50">
              <DailyAccessChart data={dailyData} />
            </div>
          )}

          {/* リファラー（SNS/検索/直接） */}
          {referrerData && (
            <div className="p-6">
              <h2 className="text-lg font-bold mb-4">アクセス分析</h2>
              <ReferrerChart data={referrerData} />
            </div>
          )}
        </>
      )}

      {/* 新規 vs. リピーター */}
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

      {/* 直帰率（%） */}
      {bounceRates.length > 0 && (
        <div className="bg-white/50 rounded p-4 shadow mt-6">
          <h3 className="font-semibold text-sm mb-2">直帰率（%）</h3>
          <Bar
            data={{
              labels: bounceRates.map((d) => d.page), // ラベル化・統合後
              datasets: [
                {
                  label: "直帰率 (%)",
                  data: bounceRates.map((d) => Number(d.rate.toFixed(1))),
                  backgroundColor: "rgba(239, 68, 68, 0.6)",
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
                tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y}%` } },
              },
            }}
          />
        </div>
      )}

      {/* 地域別アクセス */}
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
                  backgroundColor: "rgba(37, 99, 235, 0.6)",
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
