import test from "node:test";
import assert from "node:assert/strict";
import { frenchDate, searchTerm, xmlEscape } from "../lib/text.mjs";

test("le terme de recherche ne casse pas le filtre", function () {
  assert.equal(searchTerm("  brvm, (cote)* "), "brvm cote");
  assert.equal(searchTerm("a".repeat(120)).length, 80);
});

test("les caractères XML sont échappés", function () {
  assert.equal(xmlEscape('A & B < "c"'), "A &amp; B &lt; &quot;c&quot;");
});

test("une date d’article s’écrit en français", function () {
  const label = frenchDate("2026-10-17T08:00:00.000Z");
  assert.match(label, /17/);
  assert.match(label, /octobre/i);
  assert.match(label, /2026/);
  assert.equal(frenchDate("pas une date"), "");
});
