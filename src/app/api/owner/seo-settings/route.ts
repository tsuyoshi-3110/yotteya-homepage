import { NextRequest, NextResponse } from "next/server";
import { readCachedSiteSettings } from "@/lib/customer-config/site-document-server";
import { isValidAdminSiteKey } from "@/lib/customer-config/admin-domain-settings";

export async function GET(request: NextRequest) {
  const siteKey = request.nextUrl.searchParams.get("siteKey");
  if (!isValidAdminSiteKey(siteKey)) {
    return NextResponse.json({ tagline: "", description: "" }, { status: 400 });
  }

  try {
    const settingsDoc = await readCachedSiteSettings(siteKey);
    return NextResponse.json({
      tagline: typeof settingsDoc?.seoTagline === "string" ? settingsDoc.seoTagline : "",
      description: typeof settingsDoc?.seoDescription === "string" ? settingsDoc.seoDescription : "",
    });
  } catch {
    return NextResponse.json({ tagline: "", description: "" }, { status: 500 });
  }
}
