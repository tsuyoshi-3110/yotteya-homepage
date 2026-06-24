import "server-only";

import { createVercelDomainClient } from "./vercel-domain-client";

const DEFAULT_TIMEOUT_MS = 8_000;

export function createServerVercelDomainClient() {
  return createVercelDomainClient({
    config: {
      token: process.env.VERCEL_TOKEN ?? "",
      teamId: process.env.VERCEL_TEAM_ID ?? "",
      projectId: process.env.VERCEL_PROJECT_ID ?? "",
      timeoutMs: DEFAULT_TIMEOUT_MS,
    },
  });
}
