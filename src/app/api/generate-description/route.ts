import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: NextRequest) {
  const { title } = await req.json();

  if (!title) {
    return NextResponse.json({ error: "タイトルが必要です" }, { status: 400 });
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "あなたは商品説明を日本語で親しみやすく簡潔に書くプロのコピーライターです。価格・メーカー名・産地の情報は一切含めないでください。",
    },
    {
      role: "user",
      content: `商品タイトル: ${title}\n→ 商品の紹介文を短めに生成してください。価格・メーカー名・産地は書かないでください。`,
    },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages,
    temperature: 0.8,
    max_tokens: 200,
  });

  const description = completion.choices[0].message.content;
  return NextResponse.json({ body: description });
}
