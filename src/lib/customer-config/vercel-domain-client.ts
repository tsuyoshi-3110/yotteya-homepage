export type VercelDomainClientConfig = {
  token: string;
  teamId: string;
  projectId: string;
  timeoutMs: number;
};

export class VercelClientError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super("Vercel domain status is unavailable");
    this.name = "VercelClientError";
    this.reason = reason;
  }
}

function upstreamReason(status: number): string {
  return `upstream-${status}`;
}

export function createVercelDomainClient({
  config,
  fetchImpl = fetch,
}: {
  config: VercelDomainClientConfig;
  fetchImpl?: typeof fetch;
}) {
  return {
    async getHostStatus(hostname: string) {
      if (!config.token || !config.teamId || !config.projectId) {
        throw new VercelClientError("missing-configuration");
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.timeoutMs);
      const request = async (url: URL) => {
        let response: Response;
        try {
          response = await fetchImpl(url, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${config.token}`,
              Accept: "application/json",
            },
            signal: controller.signal,
            cache: "no-store",
          });
        } catch (error) {
          if (
            controller.signal.aborted ||
            (error instanceof DOMException && error.name === "AbortError")
          ) {
            throw new VercelClientError("timeout");
          }
          throw new VercelClientError("network");
        }

        if (!response.ok) {
          throw new VercelClientError(upstreamReason(response.status));
        }
        try {
          return (await response.json()) as unknown;
        } catch {
          throw new VercelClientError("invalid-response");
        }
      };

      try {
        const projectUrl = new URL(
          `https://api.vercel.com/v9/projects/${encodeURIComponent(
            config.projectId,
          )}/domains/${encodeURIComponent(hostname)}`,
        );
        projectUrl.searchParams.set("teamId", config.teamId);

        const configUrl = new URL(
          `https://api.vercel.com/v6/domains/${encodeURIComponent(
            hostname,
          )}/config`,
        );
        configUrl.searchParams.set("projectIdOrName", config.projectId);
        configUrl.searchParams.set("teamId", config.teamId);

        const [projectDomain, domainConfig] = await Promise.all([
          request(projectUrl),
          request(configUrl),
        ]);
        return { projectDomain, config: domainConfig };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
