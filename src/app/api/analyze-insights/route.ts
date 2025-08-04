import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";

// 分析対象のページとイベントのラベル
const PAGE_PATH_LABELS: Record<string, string> = {
  home: "ホームページ",
  about: "当店の思い",
  products: "商品一覧ページ",
  stores: "店舗一覧ページ",
  "uber-eats": "デリバリーページ",
  news: "お知らせページ",
  email: "メールアクセス",
  map_click: "Googleマップ",
};

const EVENT_LABELS: Record<string, string> = {
  home_stay_seconds_home: "ホームページ",
  home_stay_seconds_about: "当店の思い",
  home_stay_seconds_products: "商品一覧ページ",
  home_stay_seconds_stores: "店舗一覧ページ",
  home_stay_seconds_news: "お知らせページ",
  home_stay_seconds_email: "メールアクセス",
  home_stay_seconds_map_click: "Googleマップ",
};

// 除外対象ID
const IGNORED_PAGE_IDS = ["postList", "community", "login", "analytics"];
const IGNORED_EVENT_IDS = [
  "home_stay_seconds_postList",
  "home_stay_seconds_community",
  "home_stay_seconds_login",
  "home_stay_seconds_analytics",
];

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const { period, pageData, eventData } = await req.json();

    // 型アノテーション明示
    const filteredPages = pageData.filter(
      (p: { id: string; count: number }) =>
        !IGNORED_PAGE_IDS.includes(p.id) && PAGE_PATH_LABELS[p.id]
    );

    const filteredEvents = eventData.filter(
      (e: { id: string; value: number }) =>
        !IGNORED_EVENT_IDS.includes(e.id) && EVENT_LABELS[e.id]
    );

    const totalPageCount = filteredPages.reduce(
      (sum: number, p: { count: number }) => sum + p.count,
      0
    );
    const totalEventCount = filteredEvents.length;

    if (totalPageCount < 5 && totalEventCount < 3) {
      return NextResponse.json({
        advice:
          "まだデータが少ないため、現時点での分析は難しいです。もうしばらくしてからお試しください。",
      });
    }

    const pageSummaries = filteredPages
      .map((p: { id: string; count: number }) => `・${PAGE_PATH_LABELS[p.id]}：${p.count}回`)
      .join("\n");

    const eventSummaries = filteredEvents
      .map((e: { id: string; value: number }) => {
        const minutes = Math.floor(e.value / 60);
        const seconds = e.value % 60;
        return `・${EVENT_LABELS[e.id]}：${minutes}分${seconds}秒 滞在（合計）`;
      })
      .join("\n");

    const prompt = `
以下はホームページの分析データです（期間：${period}）。

【ページ別アクセス数】
${pageSummaries || "データがありません"}

【ページ別滞在時間】
${eventSummaries || "データがありません"}

この情報をもとに、**ホームページのオーナーが管理画面から簡単にできる改善内容**を3つ提案してください。

【必ず守るルール】
- HTMLやCSS、プログラミングの話は禁止です。
- 専門用語（SEO、インデックス、メタタグなど）も禁止です。
- 「コードを修正する」「システムを変更する」などの指示は絶対にしないでください。
- 「新しい機能を追加する」「デザインの構造を変える」などの提案は禁止です。
- 「◯◯ページに○○を追加する」など、管理画面からできないことは禁止です。
- 写真を変える、文章の順番を変える、など管理画面で完結するものに限定してください。
- データが少ないときは「まだデータが少ないため、現時点で分析は難しい」と正直に伝えてください。
- 無理に提案をひねり出さないでください。
- 文章はやさしく、誰でも「自分でもできそう！」と思えるように書いてください。

例としてふさわしい改善内容：
- 写真を明るいものに変えてみる
- ページの冒頭に「お店のこだわり」を一文だけ加えてみる
- 見出しをもう少しわかりやすい表現に変えてみる

では、改善提案を3つ出してください。
`;

    const chat = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
    });

    const advice = chat.choices[0].message.content?.trim() ?? "提案が見つかりませんでした。";

    return NextResponse.json({ advice });
  } catch (error) {
    console.error("分析APIエラー:", error);
    return NextResponse.json(
      { advice: "エラーが発生しました。" },
      { status: 500 }
    );
  }
}
