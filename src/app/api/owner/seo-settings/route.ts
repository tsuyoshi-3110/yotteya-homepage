import { NextRequest, NextResponse } from "next/server";
import {
  readCachedSiteDocument,
  readCachedSiteSettings,
} from "@/lib/customer-config/site-document-server";
import { resolveCustomerConfigDocument } from "@/lib/customer-config/resolve";
import { isValidAdminSiteKey } from "@/lib/customer-config/admin-domain-settings";

export async function GET(request: NextRequest) {
  const siteKey = request.nextUrl.searchParams.get("siteKey");
  if (!isValidAdminSiteKey(siteKey)) {
    return NextResponse.json({ tagline: "", description: "" }, { status: 400 });
  }

  try {
    const [siteDoc, settingsDoc] = await Promise.all([
      readCachedSiteDocument(siteKey),
      readCachedSiteSettings(siteKey),
    ]);
    const config = siteDoc ? resolveCustomerConfigDocument(siteDoc) : null;

    return NextResponse.json({
      tagline:
        typeof settingsDoc?.seoTagline === "string" && settingsDoc.seoTagline
          ? settingsDoc.seoTagline
          : config?.brand.tagline ?? "",
      description:
        typeof settingsDoc?.seoDescription === "string" && settingsDoc.seoDescription
          ? settingsDoc.seoDescription
          : config?.brand.description ?? "",
    });
  } catch {
    return NextResponse.json({ tagline: "", description: "" }, { status: 500 });
  }
}
