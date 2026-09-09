import test from "node:test";
import assert from "node:assert/strict";
import { createConfluenceClient, ConfluenceApiError } from "../src/client.ts";

function response(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText: `S${status}`,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  };
}

test("client uses v2 and query encoding", async () => {
  let calledUrl = "";
  const client = createConfluenceClient(
    { name: "acme", url: "https://acme.atlassian.net", email: "u@x", apiToken: "t" },
    {
      fetchImpl: async (url: string) => {
        calledUrl = url;
        return response(200, { ok: true });
      },
      dispatcher: undefined,
    },
  );

  await client.get("/spaces", { query: { limit: 2, keys: ["ENG", "OPS"] } });
  assert.equal(calledUrl, "https://acme.atlassian.net/wiki/api/v2/spaces?limit=2&keys=ENG&keys=OPS");
});

test("client supports v1 endpoints", async () => {
  let calledUrl = "";
  const client = createConfluenceClient(
    { name: "acme", url: "https://acme.atlassian.net", email: "u@x", apiToken: "t" },
    {
      fetchImpl: async (url: string) => {
        calledUrl = url;
        return response(200, { id: "123" });
      },
      dispatcher: undefined,
    },
  );

  await client.getV1("/content/123");
  assert.equal(calledUrl, "https://acme.atlassian.net/wiki/rest/api/content/123");
});

test("client retries on 429", async () => {
  let calls = 0;
  const client = createConfluenceClient(
    { name: "acme", url: "https://acme.atlassian.net", email: "u@x", apiToken: "t" },
    {
      fetchImpl: async () => {
        calls += 1;
        if (calls < 3) return response(429, { message: "Rate limited" }, { "retry-after": "0" });
        return response(200, { ok: true });
      },
      dispatcher: undefined,
    },
  );

  const out = await client.get("/spaces");
  assert.deepEqual(out, { ok: true });
  assert.equal(calls, 3);
});

test("client throws typed error on failure", async () => {
  const client = createConfluenceClient(
    { name: "acme", url: "https://acme.atlassian.net", email: "u@x", apiToken: "bad" },
    {
      fetchImpl: async () => response(401, { message: "Unauthorized" }),
      dispatcher: undefined,
    },
  );

  await assert.rejects(() => client.get("/spaces"), (err: unknown) => {
    assert.ok(err instanceof ConfluenceApiError);
    assert.equal((err as ConfluenceApiError).status, 401);
    assert.match((err as Error).message, /authentication failed/i);
    return true;
  });
});
