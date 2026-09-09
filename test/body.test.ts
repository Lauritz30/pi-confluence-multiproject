import test from "node:test";
import assert from "node:assert/strict";
import { textToStorageValue, toStorageBody } from "../src/body.ts";

test("textToStorageValue renders paragraphs and line breaks", () => {
  const out = textToStorageValue("Hello\nWorld\n\nNext");
  assert.equal(out, "<p>Hello<br />World</p><p>Next</p>");
});

test("textToStorageValue escapes html", () => {
  const out = textToStorageValue("<b>&\"'</b>");
  assert.equal(out, "<p>&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;</p>");
});

test("toStorageBody accepts plain text and storage object", () => {
  assert.deepEqual(toStorageBody("hi"), { representation: "storage", value: "<p>hi</p>" });
  assert.deepEqual(toStorageBody({ representation: "storage", value: "<p>x</p>" }), {
    representation: "storage",
    value: "<p>x</p>",
  });
});

test("toStorageBody rejects invalid input", () => {
  assert.throws(() => toStorageBody({ representation: "wiki", value: "x" }));
});
