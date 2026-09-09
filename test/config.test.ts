import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, resolveSafetyLevel, resolveSite, ConfigError, type ConfluenceConfig } from "../src/config.ts";

test("loadConfig returns stub when config file does not exist", () => {
  const cfg = loadConfig(join(tmpdir(), `missing-${Date.now()}.json`));
  assert.equal(cfg.configExists, false);
  assert.equal(cfg.sites.length, 0);
  assert.equal(cfg.safetyLevel, "confirm");
});

test("loadConfig parses config and defaults defaultSite to first entry", () => {
  const dir = mkdtempSync(join(tmpdir(), "cfg-"));
  const path = join(dir, "conf.json");
  writeFileSync(
    path,
    JSON.stringify({
      sites: [{ name: "acme", url: "https://acme.atlassian.net", email: "u@acme.com", apiToken: "t" }],
    }),
  );

  const cfg = loadConfig(path);
  assert.equal(cfg.configExists, true);
  assert.equal(cfg.defaultSite, "acme");
  assert.equal(cfg.sites[0].name, "acme");
});

test("loadConfig allows missing apiToken in mock mode", () => {
  const dir = mkdtempSync(join(tmpdir(), "cfg-"));
  const path = join(dir, "conf.json");
  writeFileSync(
    path,
    JSON.stringify({
      mock: true,
      sites: [{ name: "acme", url: "https://acme.atlassian.net", email: "u@acme.com" }],
    }),
  );

  const cfg = loadConfig(path);
  assert.equal(cfg.mock, true);
  assert.equal(cfg.sites[0].apiToken, undefined);
});

test("loadConfig throws on invalid entries", () => {
  const dir = mkdtempSync(join(tmpdir(), "cfg-"));
  const path = join(dir, "conf.json");
  writeFileSync(path, JSON.stringify({ sites: [{ name: "acme", url: "https://acme.atlassian.net" }] }));
  assert.throws(() => loadConfig(path), ConfigError);
});

test("resolveSite resolves default and throws on unknown", () => {
  const cfg: ConfluenceConfig = {
    sites: [{ name: "acme", url: "https://acme.atlassian.net", email: "u@acme.com", apiToken: "t" }],
    defaultSite: "acme",
    safetyLevel: "confirm",
    mock: false,
    configPath: "x",
    configExists: true,
  };

  assert.equal(resolveSite(cfg).name, "acme");
  assert.throws(() => resolveSite(cfg, "other"), ConfigError);
});

test("resolveSafetyLevel prefers site override", () => {
  assert.equal(resolveSafetyLevel({ safetyLevel: "confirm" }, { safetyLevel: "open" }), "open");
  assert.equal(resolveSafetyLevel({ safetyLevel: "readonly" }), "readonly");
});
