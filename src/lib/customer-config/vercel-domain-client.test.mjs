import test from "node:test";
import assert from "node:assert/strict";
import {
  createVercelDomainClient,
  VercelClientError,
} from "./vercel-domain-client.ts";

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

const config = {
  token: "secret-token",
  teamId: "team_test",
  projectId: "prj_test",
  timeoutMs: 100,
};

test("client uses only the two official GET endpoints for the supplied hostname", async () => {
  const calls = [];
  const client = createVercelDomainClient({
    config,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return calls.length === 1
        ? response(200, {
            name: "example.com",
            apexName: "example.com",
            verified: true,
            redirect: null,
            redirectStatusCode: null,
            verification: [],
          })
        : response(200, {
            configuredBy: "A",
            acceptedChallenges: ["dns-01"],
            recommendedIPv4: [{ rank: 1, value: ["76.76.21.21"] }],
            recommendedCNAME: [],
            misconfigured: false,
          });
    },
  });

  await client.getHostStatus("example.com");

  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/v9\/projects\/prj_test\/domains\/example\.com/);
  assert.match(calls[1].url, /\/v6\/domains\/example\.com\/config/);
  assert.match(calls[0].url, /teamId=team_test/);
  assert.match(calls[1].url, /projectIdOrName=prj_test/);
  assert.equal(calls.every(({ init }) => init.method === "GET"), true);
  assert.equal(
    calls.every(
      ({ init }) => init.headers.Authorization === "Bearer secret-token",
    ),
    true,
  );
});

test("missing environment configuration fails before fetch", async () => {
  let calls = 0;
  const client = createVercelDomainClient({
    config: { token: "", teamId: "", projectId: "", timeoutMs: 100 },
    fetchImpl: async () => {
      calls += 1;
      return response(200, {});
    },
  });

  await assert.rejects(
    client.getHostStatus("example.com"),
    (error) =>
      error instanceof VercelClientError &&
      error.reason === "missing-configuration",
  );
  assert.equal(calls, 0);
});

test("timeout aborts safely without exposing token", async () => {
  const client = createVercelDomainClient({
    config: { ...config, timeoutMs: 5 },
    fetchImpl: async (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          reject(new DOMException("secret-token", "AbortError"));
        });
      }),
  });

  await assert.rejects(
    client.getHostStatus("example.com"),
    (error) => {
      assert.equal(error instanceof VercelClientError, true);
      assert.equal(error.reason, "timeout");
      assert.equal(String(error).includes("secret-token"), false);
      return true;
    },
  );
});

test("all required upstream errors are converted without raw response leakage", async () => {
  for (const status of [401, 403, 404, 429, 500]) {
    const client = createVercelDomainClient({
      config,
      fetchImpl: async () =>
        response(status, {
          error: {
            message: "secret-token raw upstream body",
          },
        }),
    });

    await assert.rejects(
      client.getHostStatus("example.com"),
      (error) => {
        assert.equal(error instanceof VercelClientError, true);
        assert.equal(error.reason, `upstream-${status}`);
        assert.equal(JSON.stringify(error).includes("secret-token"), false);
        return true;
      },
    );
  }
});
