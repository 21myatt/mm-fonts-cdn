import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { build } from "../scripts/build.mjs";

test("builds versioned and major-alias CDN artifacts", () => {
  const output = mkdtempSync(join(tmpdir(), "myanmar-fonts-cdn-"));
  const result = build({ output, version: "1.2.3", baseUrl: "https://cdn.example.test" });

  assert.equal(result.fonts, 132);
  const catalog = JSON.parse(readFileSync(join(output, "1.2.3/catalog.json"), "utf8"));
  const alias = JSON.parse(readFileSync(join(output, "v1/catalog.json"), "utf8"));
  const css = readFileSync(join(output, "1.2.3/mmfonts.css"), "utf8");
  const checksums = JSON.parse(readFileSync(join(output, "1.2.3/checksums.json"), "utf8"));
  const headers = readFileSync(join(output, "_headers"), "utf8");

  assert.equal(catalog.fonts.length, 132);
  assert.equal(alias.version, "1.2.3");
  assert.equal(catalog.credits.curator, "SaturnGod (Htain Lin Shwe)");
  assert.equal(catalog.fonts.filter((font) => font.license.status === "verified-from-canonical-release").length, 1);
  assert.match(css, /Collection curated by SaturnGod/);
  assert.match(css, /https:\/\/cdn\.example\.test\/1\.2\.3\/fonts\//);
  assert.equal(Object.keys(checksums.files).length, 136);
  assert.equal(catalog.fonts.filter((font) => font.author.key === "aungmyokyaw-imports").length, 41);
  assert.ok(catalog.fonts.filter((font) => font.author.key === "aungmyokyaw-imports").every((font) => font.license.url === "https://github.com/AungMyoKyaw/Myanmar-Unicode-Fonts"));
  const importedFaces = catalog.fonts
    .filter((font) => font.author.key === "aungmyokyaw-imports")
    .map((font) => `${font.localName.toLowerCase()}|${font.fontStyle.toLowerCase()}`);
  assert.equal(new Set(importedFaces).size, importedFaces.length);
  assert.equal(new Set(catalog.fonts.map((font) => font.id)).size, catalog.fonts.length);
  const unisans = catalog.fonts.find((font) => font.id.startsWith("khzaw-awesome:"));
  assert.equal(unisans.name, "Masterpiece Uni Sans");
  assert.equal(unisans.license.id, "OFL");
  assert.match(headers, /Access-Control-Allow-Origin: \*/);
  assert.match(headers, /max-age=31536000, immutable/);
  assert.deepEqual(catalog, alias);
});

test("rejects a non-semantic version", () => {
  assert.throws(() => build({ version: "latest" }), /Version must be semantic/);
});
