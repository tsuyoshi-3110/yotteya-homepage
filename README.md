This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 新しい顧客サイトを作る

顧客固有の公開情報は `src/config/customer.ts` に集約しています。

新しい顧客へ複製するときは、まず次を変更してください。

- `siteKey`
- `productionUrl` / `vercelUrl`
- 店名・業種・説明・SEOキーワード
- SNS URL
- 店舗住所・緯度経度
- トップページ・店舗一覧・地域ページの文章
- 構造化データの業種、対応地域、営業時間
- FAQ
- AI用の業種・地域情報

`localizedContentMode` は、新規顧客では `"customer-default"` を推奨します。
これにより、旧顧客向けの翻訳文が残らず、未翻訳言語では顧客用の日本語コピーを表示します。

ロゴ類は別途差し替えます。

- `public/images/ogpLogo.png`
- `src/app/icon.png`
- `src/app/favicon.ico`

秘密情報は `customer.ts` に書かず、`.env.local` とVercelのEnvironment Variablesで管理します。

- Firebase
- Stripe
- Google API / OAuth
- OpenAI API

`npm run build`の前に、`customer.ts`のドメインから`cors.json`が自動同期されます。

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-yotteya&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
