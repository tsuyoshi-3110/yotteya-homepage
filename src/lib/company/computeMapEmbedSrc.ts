 function buildSimpleEmbedSrc(input?: string | null) {
  const s = (input ?? "").trim();
  if (!s) return undefined;

  // すでに「embed」形式のURLならそのまま使う
  if (/^https?:\/\/www\.google\.[^/]+\/maps\/embed\/?/i.test(s)) {
    return s;
  }

  // それ以外（通常のURLや住所文字列）は q= に詰めて埋め込み用URLに変換
  return `https://www.google.com/maps?q=${encodeURIComponent(
    s
  )}&output=embed`;
}

 export function computeMapEmbedSrc(data: {
  address?: string | null;
  useAddressForMap?: boolean;
}) {
  if (!data.useAddressForMap) return undefined;

  const addr = (data.address ?? "").trim();
  if (!addr) return undefined;

  return buildSimpleEmbedSrc(addr);
}


