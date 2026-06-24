import { NextResponse } from "next/server";
import { resolveCurrentTenant } from "@/lib/customer-config/tenant-resolver-server";
import {
  readCachedSiteDocument,
  readCachedSiteSettings,
} from "@/lib/customer-config/site-document-server";
import { resolveCustomerConfigDocument } from "@/lib/customer-config/resolve";

export async function GET() {
  try {
    const tenant = await resolveCurrentTenant();
    const [siteDoc, settingsDoc] = await Promise.all([
      readCachedSiteDocument(tenant.siteKey),
      readCachedSiteSettings(tenant.siteKey),
    ]);
    const config = resolveCustomerConfigDocument(siteDoc);

    return NextResponse.json({
      tagline:
        typeof settingsDoc?.seoTagline === "string" && settingsDoc.seoTagline
          ? settingsDoc.seoTagline
          : config.brand.tagline,
      description:
        typeof settingsDoc?.seoDescription === "string" && settingsDoc.seoDescription
          ? settingsDoc.seoDescription
          : config.brand.description,
    });
  } catch {
    return NextResponse.json({ tagline: "", description: "" }, { status: 500 });
  }
}
