import test from "node:test";
import assert from "node:assert/strict";
import { guardMutation, SafetyBlockedError } from "../src/safety.ts";

test("readonly blocks all mutations", async () => {
  await assert.rejects(
    () =>
      guardMutation(
        { safetyLevel: "readonly" },
        { name: "acme" },
        { hasUI: true, ui: { confirm: async () => true } },
        { title: "Write", message: "go" },
      ),
    SafetyBlockedError,
  );
});

test("open allows mutations", async () => {
  await guardMutation({ safetyLevel: "open" }, { name: "acme" }, undefined, { title: "Write", message: "go" });
});

test("confirm requires ui approval", async () => {
  await assert.rejects(
    () => guardMutation({ safetyLevel: "confirm" }, { name: "acme" }, undefined, { title: "Write", message: "go" }),
    SafetyBlockedError,
  );

  await assert.rejects(
    () =>
      guardMutation(
        { safetyLevel: "confirm" },
        { name: "acme" },
        { hasUI: true, ui: { confirm: async () => false } },
        { title: "Write", message: "go" },
      ),
    SafetyBlockedError,
  );

  await guardMutation(
    { safetyLevel: "confirm" },
    { name: "acme" },
    { hasUI: true, ui: { confirm: async () => true } },
    { title: "Write", message: "go" },
  );
});

test("confirm headless allows approved actions", async () => {
  await guardMutation(
    { safetyLevel: "confirm" },
    {
      name: "acme",
      headlessApprovals: [{ action: "confluence_update_page", pageIds: ["123"] }],
    },
    undefined,
    {
      title: "Update",
      message: "go",
      action: "confluence_update_page",
      pageIds: ["123"],
    },
  );
});
