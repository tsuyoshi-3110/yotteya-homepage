import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { authenticateAdminDomainRequest } from "@/lib/customer-config/admin-domain-settings";
import { syncAdminDomainStatus } from "@/lib/customer-config/admin-domain-status-sync";
import { createAdminDomainStatusSyncDependencies } from "@/lib/customer-config/admin-domain-status-sync-firestore";
import { createServerVercelDomainClient } from "@/lib/customer-config/vercel-domain-client.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

async function authenticate(req: NextRequest): Promise<string | null> {
  return authenticateAdminDomainRequest({
    authorization: req.headers.get("authorization"),
    session: req.cookies.get("__session")?.value ?? null,
    dependencies: {
      verifyIdToken: (token) => adminAuth.verifyIdToken(token, true),
      verifySessionCookie: (session) =>
        adminAuth.verifySessionCookie(session, true),
    },
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ siteKey: string }> },
) {
  try {
    const [{ siteKey }, uid] = await Promise.all([
      context.params,
      authenticate(req),
    ]);
    const vercel = createServerVercelDomainClient();
    const result = await syncAdminDomainStatus({
      siteKey,
      uid,
      dependencies: createAdminDomainStatusSyncDependencies({
        firestore: adminDb,
        fetchHostStatus: (hostname) => vercel.getHostStatus(hostname),
      }),
    });

    return NextResponse.json(result.body, {
      status: result.status,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    console.error(
      "admin domain status sync POST failed",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { error: "internal" },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
