import test from "node:test";
import assert from "node:assert/strict";
import { buildBasicAuthHeader } from "../src/auth.ts";

test("buildBasicAuthHeader encodes email and token", () => {
  const header = buildBasicAuthHeader("user@example.com", "token123");
  assert.equal(header, `Basic ${Buffer.from("user@example.com:token123").toString("base64")}`);
});
