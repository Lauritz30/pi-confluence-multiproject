import test from "node:test";
import assert from "node:assert/strict";

test("getProxyDispatcher returns undefined without proxy env", async () => {
  const oldHttps = process.env.HTTPS_PROXY;
  const oldHttp = process.env.HTTP_PROXY;
  delete process.env.HTTPS_PROXY;
  delete process.env.HTTP_PROXY;

  const module = await import(`../src/proxy.ts?x=${Date.now()}`);
  assert.equal(module.getProxyDispatcher(), undefined);

  if (oldHttps) process.env.HTTPS_PROXY = oldHttps;
  if (oldHttp) process.env.HTTP_PROXY = oldHttp;
});

test("getProxyDispatcher creates dispatcher with proxy env", async () => {
  const oldHttps = process.env.HTTPS_PROXY;
  process.env.HTTPS_PROXY = "http://proxy.internal:8080";

  const module = await import(`../src/proxy.ts?x=${Date.now()}a`);
  assert.ok(module.getProxyDispatcher());

  if (oldHttps) process.env.HTTPS_PROXY = oldHttps;
  else delete process.env.HTTPS_PROXY;
});
