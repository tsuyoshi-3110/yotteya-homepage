import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { authenticateAdminDomainRequest } from "@/lib/customer-config/admin-domain-settings";
import { createServerVercelDomainClient } from "@/lib/customer-config/vercel-domain-client.server";
import { getAdminVercelDomainStatus } from "@/lib/customer-config/vercel-domain-status";

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

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ siteKey: string }> },
) {
  try {
    const [{ siteKey }, uid] = await Promise.all([
      context.params,
      authenticate(req),
    ]);
    const vercel = createServerVercelDomainClient();
    const result = await getAdminVercelDomainStatus({
      siteKey,
      uid,
      dependencies: {
        readOwnerId: async (key) => {
          const snapshot = await adminDb.doc(`siteSettings/${key}`).get();
          return snapshot.exists ? snapshot.get("ownerId") : null;
        },
        readSite: async (key) => {
          const snapshot = await adminDb.doc(`sites/${key}`).get();
          return snapshot.exists ? snapshot.data() : null;
        },
        fetchHostStatus: (hostname) => vercel.getHostStatus(hostname),
      },
    });

    return NextResponse.json(result.body, {
      status: result.status,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    console.error(
      "admin Vercel domain status GET failed",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { error: "vercel-status-unavailable" },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}
