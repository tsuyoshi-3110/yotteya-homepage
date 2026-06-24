import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import {
  authenticateAdminDomainRequest,
  getAdminDomainSettings,
} from "@/lib/customer-config/admin-domain-settings";
import { updateAdminDomainSettings } from "@/lib/customer-config/admin-domain-update";
import { createAdminDomainUpdateDependencies } from "@/lib/customer-config/admin-domain-update-firestore";

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
  context: { params: Promise<{ siteKey: string }> }
) {
  try {
    const [{ siteKey }, uid] = await Promise.all([
      context.params,
      authenticate(req),
    ]);

    const result = await getAdminDomainSettings({
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
        readDomains: async (key) => {
          const snapshot = await adminDb
            .collection("domains")
            .where("siteKey", "==", key)
            .get();
          return snapshot.docs.map((document) => ({
            id: document.id,
            data: document.data(),
          }));
        },
      },
    });

    return NextResponse.json(result.body, {
      status: result.status,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    console.error("admin domain settings GET failed", error);
    return NextResponse.json(
      { error: "internal" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ siteKey: string }> }
) {
  try {
    const [{ siteKey }, uid] = await Promise.all([
      context.params,
      authenticate(req),
    ]);
    if (!uid) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
    }

    const ownerSnap = await adminDb.doc(`siteSettings/${siteKey}`).get();
    const ownerId = ownerSnap.exists ? ownerSnap.get("ownerId") : null;
    if (typeof ownerId !== "string" || ownerId !== uid) {
      return NextResponse.json({ error: "forbidden" }, { status: 403, headers: NO_STORE_HEADERS });
    }

    const hostname = req.nextUrl.searchParams.get("hostname");
    if (!hostname) {
      return NextResponse.json({ error: "missing-hostname" }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const domainSnap = await adminDb.doc(`domains/${hostname}`).get();
    if (!domainSnap.exists || domainSnap.get("siteKey") !== siteKey) {
      return NextResponse.json({ error: "not-found" }, { status: 404, headers: NO_STORE_HEADERS });
    }

    await adminDb.doc(`domains/${hostname}`).delete();
    return NextResponse.json({ deleted: hostname }, { status: 200, headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("admin domain DELETE failed", error);
    return NextResponse.json({ error: "internal" }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ siteKey: string }> }
) {
  try {
    const [{ siteKey }, uid, input] = await Promise.all([
      context.params,
      authenticate(req),
      req.json().catch(() => null),
    ]);

    const result = await updateAdminDomainSettings({
      siteKey,
      uid,
      input,
      dependencies: createAdminDomainUpdateDependencies(adminDb),
    });

    return NextResponse.json(result.body, {
      status: result.status,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    console.error("admin domain settings PUT failed", error);
    return NextResponse.json(
      { error: "internal" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
