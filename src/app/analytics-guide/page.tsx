// app/analytics/guide/page.tsx
// 説明書ページ：アクセス解析の見方（ユーザー向け）
// - App Router 用のシンプルなサーバーコンポーネント
// - すべて静的に書いているので、そのままコピペで動きます
// - Tailwind ベース（shadcn/ui 不要）

export default function AnalyticsGuidePage() {
  const SECTIONS = [
    { id: "pv", title: "1. ページ別アクセス数（PV）" },
    { id: "stay", title: "2. 平均滞在時間" },
    { id: "hourly", title: "3. 時間帯別アクセス" },
    { id: "weekday", title: "4. 曜日別アクセス" },
    { id: "daily", title: "5. 日別アクセス（折れ線）" },
    { id: "referrer", title: "6. 流入元（SNS / 検索 / 直接）" },
    { id: "visitor", title: "7. 新規 vs. リピーター" },
    { id: "bounce", title: "8. 直帰率" },
    { id: "geo", title: "9. 地域別アクセス" },
    { id: "summary", title: "まとめ（母数の違い）" },
    { id: "faq", title: "よくある質問（FAQ）" },
  ];

  return (
    <main className="max-w-4xl mx-auto px-4 py-10 text-gray-900 bg-white/70">
      {/* ヘッダー */}
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">アクセス解析の見方（説明書）</h1>
        <p className="mt-2 text-sm text-gray-600">最終更新：{new Date().toLocaleDateString("ja-JP")}</p>
      </header>

      {/* イントロ */}
      <section className="mb-8">
        <p className="leading-relaxed">
          このページは、ホームページのアクセス解析に表示される各指標について、専門用語を避けて分かりやすく説明したものです。お客様やスタッフに共有する想定で書かれています。
        </p>
      </section>

      {/* 目次 */}
      <nav className="mb-10 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="font-semibold mb-3">目次</h2>
        <ol className="grid gap-2 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-blue-700 hover:underline">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* 指標の基本：PV vs セッション */}
      <section className="mb-10">
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <h3 className="font-semibold mb-2">まず大前提：PV と セッションは別物です</h3>
          <p className="text-sm leading-relaxed">
            <span className="font-medium">PV</span>（ページビュー）は「ページが開かれた回数」。
            <span className="font-medium">セッション</span>は「訪問（来訪1回）」のことです。
            1人が5ページ見れば <span className="font-medium">5PV</span> ですが、セッションは <span className="font-medium">1</span> です。
            そのため、指標ごとに母数が一致しない場合があります。
          </p>
        </div>
      </section>

      {/* 1. PV */}
      <section id="pv" className="mb-10 scroll-mt-24">
        <h2 className="text-xl font-bold mb-3">1. ページ別アクセス数（PV）</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li><span className="font-medium">何を数える？</span> ページが開かれた回数（ページビュー）。</li>
          <li><span className="font-medium">どう記録？</span> ページ入室時ごとに加算（ログイン/解析など一部は除外）。</li>
          <li><span className="font-medium">ポイント</span> 同じ人が複数ページを見ると、その回数分PVが増えます。</li>
        </ul>
      </section>

      {/* 2. 平均滞在時間 */}
      <section id="stay" className="mb-10 scroll-mt-24">
        <h2 className="text-xl font-bold mb-3">2. 平均滞在時間</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li><span className="font-medium">何を数える？</span> ページに滞在した秒数の平均。</li>
          <li><span className="font-medium">どう記録？</span> ページを離れる瞬間の滞在秒数を記録し、<code className="px-1 py-0.5 bg-gray-100 rounded text-sm">平均 = 合計秒数 ÷ 回数</code>で計算。</li>
          <li><span className="font-medium">ポイント</span> 長く見られているページは興味関心が高い可能性があります。</li>
        </ul>
      </section>

      {/* 3. 時間帯別アクセス */}
      <section id="hourly" className="mb-10 scroll-mt-24">
        <h2 className="text-xl font-bold mb-3">3. 時間帯別アクセス</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li><span className="font-medium">何を数える？</span> 1日のどの時間にアクセスされたか。</li>
          <li><span className="font-medium">どう記録？</span> ページが開かれるたびに、その時刻（0〜23時）を記録。</li>
          <li><span className="font-medium">ポイント</span> 「ランチ前が多い」などピーク時間の把握に役立ちます。</li>
        </ul>
      </section>

      {/* 4. 曜日別アクセス */}
      <section id="weekday" className="mb-10 scroll-mt-24">
        <h2 className="text-xl font-bold mb-3">4. 曜日別アクセス</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li><span className="font-medium">何を数える？</span> どの曜日にアクセスが多いか。</li>
          <li><span className="font-medium">どう記録？</span> ページが開かれるたびに、その日の曜日を記録。</li>
          <li><span className="font-medium">ポイント</span> 土日型・平日型など、来訪の傾向が分かります。</li>
        </ul>
      </section>

      {/* 5. 日別アクセス */}
      <section id="daily" className="mb-10 scroll-mt-24">
        <h2 className="text-xl font-bold mb-3">5. 日別アクセス（折れ線）</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li><span className="font-medium">何を数える？</span> 指定期間内、日ごとのアクセス数。</li>
          <li><span className="font-medium">どう記録？</span> 各日0:00に1回ずつカウントされる日別ログを集計。</li>
          <li><span className="font-medium">ポイント</span> キャンペーンやイベントの効果を日単位で確認できます。</li>
        </ul>
      </section>

      {/* 6. 流入元 */}
      <section id="referrer" className="mb-10 scroll-mt-24">
        <h2 className="text-xl font-bold mb-3">6. 流入元（SNS / 検索 / 直接）</h2>
        <div className="space-y-2">
          <p><span className="font-medium">何を数える？</span> どこから来たか（訪問のきっかけ）を<strong>セッション単位</strong>で数えます。</p>
          <p><span className="font-medium">どう記録？</span> 初回アクセス時だけ参照元を記録し、次のいずれかに分類します：</p>
          <ul className="list-disc pl-5">
            <li>Google / Bing / Yahoo → <span className="font-medium">検索</span></li>
            <li>URL直打ち・アプリ内ブラウザなどリファラー不明 → <span className="font-medium">直接</span></li>
            <li>上記以外の外部ドメイン → <span className="font-medium">SNSなどその他</span></li>
          </ul>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="font-medium">注意：</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>流入元は<strong>セッション数</strong>、PVは<strong>ページ閲覧回数</strong>です。母数が違うため一致しません。</li>
              <li>リファラーポリシーやアプリ内表示の影響で「直接」が多めに出ることがあります。</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 7. 新規 / リピーター */}
      <section id="visitor" className="mb-10 scroll-mt-24">
        <h2 className="text-xl font-bold mb-3">7. 新規 vs. リピーター</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li><span className="font-medium">何を数える？</span> ブラウザごとの初回/再訪の人数（期間合計）。</li>
          <li><span className="font-medium">どう記録？</span> ブラウザに匿名IDを保存して、日ごとに「新規/リピーター」を加算。</li>
          <li><span className="font-medium">ポイント</span> リピーター比率が上がる＝固定客化が進んでいる合図です。</li>
        </ul>
      </section>

      {/* 8. 直帰率 */}
      <section id="bounce" className="mb-10 scroll-mt-24">
        <h2 className="text-xl font-bold mb-3">8. 直帰率</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li><span className="font-medium">何を数える？</span> 最初のページだけ見て離脱した割合。</li>
          <li><span className="font-medium">どう計算？</span>
            <code className="px-1 py-0.5 bg-gray-100 rounded text-sm">直帰率(%) = 直帰数 ÷ ランディングPV × 100</code>
          </li>
          <li><span className="font-medium">ポイント</span> 「離脱=悪」ではありません。電話番号を見て即行動する業種では直帰率が高くても成果が出ていることがあります。</li>
        </ul>
      </section>

      {/* 9. 地域 */}
      <section id="geo" className="mb-10 scroll-mt-24">
        <h2 className="text-xl font-bold mb-3">9. 地域別アクセス</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li><span className="font-medium">何を数える？</span> アクセスしてきた地域（都道府県や国）の件数。</li>
          <li><span className="font-medium">どう記録？</span> 初回アクセス時にIPから地域を推定し、訪問ごとに加算。</li>
          <li><span className="font-medium">ポイント</span> 商圏の把握、広告の地域最適化に役立ちます。</li>
        </ul>
      </section>

      {/* まとめ：母数の違い */}
      <section id="summary" className="mb-10 scroll-mt-24">
        <h2 className="text-xl font-bold mb-3">まとめ：母数の違いに注意</h2>
        <div className="overflow-x-auto">
          <table className="min-w-[560px] w-full text-sm border">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 border w-1/3 text-left">指標</th>
                <th className="p-2 border w-1/3 text-left">数えているもの</th>
                <th className="p-2 border w-1/3 text-left">母数</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 border">PV系（ページ/時間帯/曜日/日別）</td>
                <td className="p-2 border">ページが開かれた回数</td>
                <td className="p-2 border">PV（ページビュー）</td>
              </tr>
              <tr>
                <td className="p-2 border">流入元（SNS/検索/直接）</td>
                <td className="p-2 border">訪問のきっかけ</td>
                <td className="p-2 border">セッション（訪問）</td>
              </tr>
              <tr>
                <td className="p-2 border">新規 / リピーター</td>
                <td className="p-2 border">ブラウザ単位の初回/再訪</td>
                <td className="p-2 border">人数（期間合計）</td>
              </tr>
              <tr>
                <td className="p-2 border">直帰率</td>
                <td className="p-2 border">最初のページだけで離脱</td>
                <td className="p-2 border">ランディングPVを母数に算出</td>
              </tr>
              <tr>
                <td className="p-2 border">地域</td>
                <td className="p-2 border">初回訪問時の地域</td>
                <td className="p-2 border">セッション（訪問）</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mb-20 scroll-mt-24">
        <h2 className="text-xl font-bold mb-3">よくある質問（FAQ）</h2>
        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <p className="font-medium">Q. 数字が合わないのは不具合？</p>
            <p className="text-sm text-gray-700 mt-1">A. 不具合ではありません。流入元はセッション、PVはページ閲覧回数で母数が違います。</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-medium">Q. 1日の平均人数を知りたい</p>
            <p className="text-sm text-gray-700 mt-1">A. 指定期間の日数で割ることで平均/日が求められます（例：新規合計 ÷ 日数）。</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-medium">Q. 直帰率は低い方が良い？</p>
            <p className="text-sm text-gray-700 mt-1">A. 業種によります。電話番号や地図を見てすぐ行動する業種は直帰率が高くても成果が出ている場合があります。</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-medium">Q. 「直接」が多すぎる</p>
            <p className="text-sm text-gray-700 mt-1">A. リファラーポリシーやアプリ内ブラウザの仕様で参照元が取得できず「直接」に分類されることがあります。</p>
          </div>
        </div>
      </section>

      {/* フッター：運用メモ */}
      <footer className="pt-6 border-t text-sm text-gray-600">
        <p>運用メモ：</p>
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li>日付はJST（日本時間）0:00区切りで集計しています。</li>
          <li>ログインや解析画面など一部のページは集計から除外しています。</li>
          <li>仕様は今後改善される可能性があります。表示の見方に迷ったらこのページを共有してください。</li>
        </ul>
      </footer>
    </main>
  );
}
