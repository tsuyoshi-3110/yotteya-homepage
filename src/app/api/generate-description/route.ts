import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: NextRequest) {
  const { title, price } = await req.json();

  if (!title) {
    return NextResponse.json({ error: "タイトルが必要です" }, { status: 400 });
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "あなたは商品説明を日本語で親しみやすく簡潔に書くプロのコピーライターです。",
    },
    {
      role: "user",
      content: `商品タイトル: ${title}\n価格: ${price}円\n→ 商品の紹介文を短めに生成してください。`,
    },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4", // または "gpt-3.5-turbo"
    messages,
    temperature: 0.8,
    max_tokens: 200,
  });

  const description = completion.choices[0].message.content;
  return NextResponse.json({ body: description });
}
