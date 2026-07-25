import { createHash } from "node:crypto";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  readdirSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SOURCE = resolve(PROJECT_ROOT, "vendor/saturngod");

const parseArgs = (argv) => {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
    args[arg.slice(2)] = value;
    i += 1;
  }
  return args;
};

const normalizeFamily = (value) =>
  value
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const cssEscape = (value) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const urlPath = (value) => value.split(sep).map(encodeURIComponent).join("/");
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const AUNG_REPOSITORY = "https://github.com/AungMyoKyaw/Myanmar-Unicode-Fonts";
const AUNG_VENDOR_ROOT = join(PROJECT_ROOT, "vendor", "aungmyokyaw");
const KHZAW_REPOSITORY = "https://github.com/khzaw/awesome-myanmar-unicode";
const PRAHITA_UNISANS_URL = "https://sourceforge.net/projects/prahita/files/Myanmar%20Unicode%20Fonts/MasterpieceUniSans/";
const PRAHITA_UNISANS_LICENSE = "https://sourceforge.net/p/prahita/news/2010/11/masterpiece-uni-sans-07-is-now-available/";
const KHZAW_VENDOR_ROOT = join(PROJECT_ROOT, "vendor", "khzaw-awesome");

const walkFontFiles = (directory) => {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const fullPath = join(directory, entry.name);
      return entry.isDirectory()
        ? walkFontFiles(fullPath)
        : /\.(ttf|otf)$/i.test(entry.name) ? [fullPath] : [];
    });
};

const decodeName = (buffer, platformId, offset, length) => {
  const bytes = buffer.subarray(offset, offset + length);
  if (platformId === 0 || platformId === 3) {
    const swapped = Buffer.alloc(bytes.length);
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      swapped[i] = bytes[i + 1];
      swapped[i + 1] = bytes[i];
    }
    return swapped.toString("utf16le").replace(/\0/g, "").trim();
  }
  return bytes.toString("latin1").replace(/\0/g, "").trim();
};

const readFontIdentity = (filePath) => {
  const buffer = readFileSync(filePath);
  const numTables = buffer.readUInt16BE(4);
  for (let i = 0; i < numTables; i += 1) {
    const record = 12 + i * 16;
    if (buffer.toString("ascii", record, record + 4) !== "name") continue;
    const tableOffset = buffer.readUInt32BE(record + 8);
    const count = buffer.readUInt16BE(tableOffset + 2);
    const stringsOffset = tableOffset + buffer.readUInt16BE(tableOffset + 4);
    const names = new Map();
    for (let j = 0; j < count; j += 1) {
      const nameRecord = tableOffset + 6 + j * 12;
      const platformId = buffer.readUInt16BE(nameRecord);
      const languageId = buffer.readUInt16BE(nameRecord + 4);
      const nameId = buffer.readUInt16BE(nameRecord + 6);
      const length = buffer.readUInt16BE(nameRecord + 8);
      const stringOffset = buffer.readUInt16BE(nameRecord + 10);
      if (![1, 2, 16, 17].includes(nameId)) continue;
      const value = decodeName(buffer, platformId, stringsOffset + stringOffset, length);
      if (!value) continue;
      const priority = platformId === 3 && (languageId === 0x409 || languageId === 0) ? 3 : platformId === 3 ? 2 : 1;
      if (!names.has(nameId) || names.get(nameId).priority < priority) names.set(nameId, { value, priority });
    }
    return {
      family: names.get(16)?.value ?? names.get(1)?.value ?? filePath.split(sep).at(-1).replace(/\.(ttf|otf)$/i, ""),
      style: names.get(17)?.value ?? names.get(2)?.value ?? "Regular",
    };
  }
  throw new Error(`No OpenType name table found in ${filePath}`);
};

const safeOutputDirectory = (outputRoot, version) => {
  const target = resolve(outputRoot, version);
  const rel = relative(resolve(outputRoot), target);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`Refusing unsafe output path: ${target}`);
  }
  return target;
};

export const build = (options = {}) => {
  const packageMeta = JSON.parse(readFileSync(join(PROJECT_ROOT, "package.json"), "utf8"));
  const version = options.version ?? packageMeta.version;
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Version must be semantic, received: ${version}`);
  }

  const major = `v${version.split(".")[0]}`;
  const sourceRoot = resolve(options.source ?? DEFAULT_SOURCE);
  const publicRoot = join(sourceRoot, "public");
  const sourceCatalogPath = join(sourceRoot, "fonts.json");
  const outputRoot = resolve(options.output ?? join(PROJECT_ROOT, "dist"));
  const versionDir = safeOutputDirectory(outputRoot, version);
  const aliasDir = safeOutputDirectory(outputRoot, major);
  const baseUrl = (options.baseUrl ?? "").replace(/\/+$/, "");

  if (!existsSync(sourceCatalogPath)) {
    throw new Error(`Source catalog not found: ${sourceCatalogPath}`);
  }

  const source = JSON.parse(readFileSync(sourceCatalogPath, "utf8"));
  if (!Array.isArray(source.authors) || !Array.isArray(source.styles) || !Array.isArray(source.fonts)) {
    throw new Error("fonts.json must contain authors, styles, and fonts arrays");
  }

  const authorByKey = new Map(source.authors.map((author) => [author.key, author]));
  const nameCounts = new Map();
  for (const font of source.fonts) {
    nameCounts.set(font.name, (nameCounts.get(font.name) ?? 0) + 1);
  }

  const seenIds = new Set();
  const enrichedFonts = source.fonts.map((font) => {
    const author = authorByKey.get(font.author);
    if (!author) throw new Error(`Unknown author "${font.author}" for ${font.name}`);
    if (!source.styles.includes(font.style)) throw new Error(`Unknown style "${font.style}" for ${font.name}`);

    const id = `${font.author}:${font.name}`;
    if (seenIds.has(id)) throw new Error(`Duplicate font id: ${id}`);
    seenIds.add(id);

    const sourceFile = resolve(publicRoot, author.folder, font.file);
    const sourceRel = relative(publicRoot, sourceFile);
    if (sourceRel.startsWith("..") || isAbsolute(sourceRel)) throw new Error(`Unsafe font path: ${font.file}`);
    if (!existsSync(sourceFile)) throw new Error(`Font file not found: ${sourceFile}`);

    const fileBuffer = readFileSync(sourceFile);
    const cssFamily = (nameCounts.get(font.name) ?? 0) > 1
      ? `${font.name}-${author.cssSuffix}`
      : font.name;
    const fontPath = join("fonts", author.folder, font.file);
    const publicPath = urlPath(fontPath);
    const cdnUrl = baseUrl ? `${baseUrl}/${version}/${publicPath}` : publicPath;
    const format = /\.otf$/i.test(font.file) ? "opentype" : "truetype";

    return {
      id,
      name: font.name,
      cssFamily,
      localName: font.localName ?? font.name,
      author: {
        key: author.key,
        name: author.title,
        sourceUrl: author.link || null,
      },
      style: font.style,
      file: {
        name: font.file,
        path: publicPath,
        url: cdnUrl,
        format,
        bytes: fileBuffer.byteLength,
        sha256: sha256(fileBuffer),
      },
      license: {
        status: "unverified",
        id: null,
        url: null,
        note: "No verified per-font license is present in the upstream catalog.",
      },
      attribution: {
        collection: "Myanmar Unicode Fonts",
        curator: "SaturnGod (Htain Lin Shwe)",
        upstream: "https://github.com/saturngod/myanmar-unicode-fonts",
      },
      fontStyle: "Regular",
      encoding: "unicode",
      riskFlags: [],
      _sourceFile: sourceFile,
    };
  });

  const faceKey = (family, style) => `${normalizeFamily(family).toLowerCase()}|${normalizeFamily(style).toLowerCase()}`;
  const knownFaces = new Set(enrichedFonts.map((font) => faceKey(font.localName, font.fontStyle)));
  const importedFonts = [];
  for (const sourceFile of walkFontFiles(AUNG_VENDOR_ROOT)) {
    const identity = readFontIdentity(sourceFile);
    const key = faceKey(identity.family, identity.style);
    if (knownFaces.has(key)) throw new Error(`Vendored font overlaps an existing face: ${identity.family} ${identity.style}`);
    knownFaces.add(key);

    const vendorRelative = relative(AUNG_VENDOR_ROOT, sourceFile);
    const fileName = vendorRelative.split(sep).at(-1);
    const fontPath = join("fonts", "AungMyoKyaw", vendorRelative);
    const publicPath = urlPath(fontPath);
    const cdnUrl = baseUrl ? `${baseUrl}/${version}/${publicPath}` : publicPath;
    const fileBuffer = readFileSync(sourceFile);
    const normalizedId = normalizeFamily(`${identity.family}-${identity.style}`).toLowerCase();
    const isZawgyi = /zawgyi/i.test(`${fileName} ${identity.style}`);
    const riskFlags = [];
    if (isZawgyi) riskFlags.push("legacy-zawgyi-encoding");
    if (/microsoft|myanmar text/i.test(`${identity.family} ${vendorRelative}`)) riskFlags.push("vendor-font-review-required");
    if (/samsung|miui/i.test(`${identity.family} ${vendorRelative}`)) riskFlags.push("vendor-font-review-required");

    importedFonts.push({
      id: `aungmyokyaw:${normalizedId}`,
      name: identity.family,
      cssFamily: identity.family,
      localName: identity.family,
      author: {
        key: "aungmyokyaw-imports",
        name: "Various authors (via Aung Myo Kyaw)",
        sourceUrl: AUNG_REPOSITORY,
      },
      style: "Uncategorized / Imported",
      fontStyle: identity.style,
      encoding: isZawgyi ? "zawgyi" : "unicode-or-unverified",
      riskFlags,
      file: {
        name: fileName,
        path: publicPath,
        url: cdnUrl,
        format: /\.otf$/i.test(fileName) ? "opentype" : "truetype",
        bytes: fileBuffer.byteLength,
        sha256: sha256(fileBuffer),
      },
      license: {
        status: "unverified",
        id: null,
        url: AUNG_REPOSITORY,
        note: "License information must be confirmed from the source repository or original copyright holder.",
      },
      attribution: {
        collection: "Myanmar Unicode Fonts",
        curator: "Aung Myo Kyaw",
        upstream: AUNG_REPOSITORY,
        foundationalCollection: "SaturnGod (Htain Lin Shwe)",
      },
      _sourceFile: sourceFile,
    });
  }
  enrichedFonts.push(...importedFonts);

  for (const sourceFile of walkFontFiles(KHZAW_VENDOR_ROOT)) {
    const identity = readFontIdentity(sourceFile);
    const key = faceKey(identity.family, identity.style);
    if (knownFaces.has(key)) throw new Error(`khzaw-discovered font overlaps an existing face: ${identity.family} ${identity.style}`);
    knownFaces.add(key);
    const vendorRelative = relative(KHZAW_VENDOR_ROOT, sourceFile);
    const fileName = vendorRelative.split(sep).at(-1);
    const fontPath = join("fonts", "KhzawAwesome", vendorRelative);
    const publicPath = urlPath(fontPath);
    const fileBuffer = readFileSync(sourceFile);
    enrichedFonts.push({
      id: `khzaw-awesome:${normalizeFamily(`${identity.family}-${identity.style}`).toLowerCase()}`,
      name: identity.family,
      cssFamily: identity.family,
      localName: identity.family,
      author: { key: "prahita-via-khzaw", name: "Prahita (discovered via khzaw)", sourceUrl: PRAHITA_UNISANS_URL },
      style: "Sans-Serif / Clean UI",
      fontStyle: identity.style,
      encoding: "unicode",
      riskFlags: [],
      file: {
        name: fileName,
        path: publicPath,
        url: baseUrl ? `${baseUrl}/${version}/${publicPath}` : publicPath,
        format: /\.otf$/i.test(fileName) ? "opentype" : "truetype",
        bytes: fileBuffer.byteLength,
        sha256: sha256(fileBuffer),
      },
      license: {
        status: "verified-from-canonical-release",
        id: "OFL",
        url: PRAHITA_UNISANS_LICENSE,
        note: "Prahita's canonical release announcement records a license change to OFL.",
      },
      attribution: {
        collection: "awesome-myanmar-unicode",
        curator: "Ko Htet Zaw (khzaw) and contributors",
        upstream: KHZAW_REPOSITORY,
        canonicalSource: PRAHITA_UNISANS_URL,
        foundationalCollection: "SaturnGod (Htain Lin Shwe)",
      },
      _sourceFile: sourceFile,
    });
  }

  rmSync(versionDir, { recursive: true, force: true });
  rmSync(aliasDir, { recursive: true, force: true });
  mkdirSync(versionDir, { recursive: true });

  for (const font of enrichedFonts) {
    const destination = join(versionDir, decodeURIComponent(font.file.path));
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(font._sourceFile, destination);
  }

  const catalogFonts = enrichedFonts.map(({ _sourceFile, ...font }) => font);
  const catalog = {
    schemaVersion: 1,
    version,
    name: "Myanmar Fonts CDN",
    description: "Versioned CDN metadata for SaturnGod's Myanmar Unicode font collection.",
    upstream: "https://github.com/saturngod/myanmar-unicode-fonts",
    credits: {
      curator: "SaturnGod (Htain Lin Shwe)",
      contributors: [
        "Htain Lin Shwe / SaturnGod",
        "dependabot[bot]",
        "Aung Myo Kyaw",
        "Ko Htet Zaw (khzaw) and awesome-myanmar-unicode contributors",
      ],
      details: "CREDITS.md",
    },
    licensePolicy: {
      status: "mixed-or-unverified",
      notice: "Font licenses must be verified individually before public redistribution.",
      details: "NOTICE.md",
    },
    authors: [
      ...source.authors.map(({ cssSuffix, folder, ...author }) => ({ ...author, fontFolder: folder })),
      {
        key: "aungmyokyaw-imports",
        title: "Various authors (via Aung Myo Kyaw)",
        description: "Non-overlapping faces imported from Aung Myo Kyaw's Myanmar Unicode Fonts collection.",
        link: AUNG_REPOSITORY,
        fontFolder: "AungMyoKyaw",
      },
      {
        key: "prahita-via-khzaw",
        title: "Prahita (discovered via khzaw)",
        description: "Canonical Prahita font discovered through awesome-myanmar-unicode.",
        link: PRAHITA_UNISANS_URL,
        fontFolder: "KhzawAwesome",
      },
    ],
    styles: [...source.styles, "Uncategorized / Imported"],
    fonts: catalogFonts,
  };

  const cssLines = [
    "/*",
    " * Myanmar Fonts CDN",
    " * Collection curated by SaturnGod (Htain Lin Shwe)",
    " * Upstream: https://github.com/saturngod/myanmar-unicode-fonts",
    " * Font licenses are individual and currently unverified; see catalog.json and NOTICE.md.",
    ` * Version: ${version}`,
    " */",
    "",
  ];
  for (const font of catalogFonts) {
    cssLines.push(
      `/* ${font.name} — ${font.author.name}; license: ${font.license.status} */`,
      "@font-face {",
      `  font-family: "${cssEscape(font.cssFamily)}";`,
      `  src: local("${cssEscape(font.localName)}"), url("${cssEscape(font.file.url)}") format("${font.file.format}");`,
      `  font-style: ${/italic/i.test(font.fontStyle) ? "italic" : "normal"};`,
      `  font-weight: ${/bold/i.test(font.fontStyle) ? "700" : /light/i.test(font.fontStyle) ? "300" : "400"};`,
      "  font-display: swap;",
      "}",
      "",
    );
  }

  writeFileSync(join(versionDir, "catalog.json"), json(catalog));
  writeFileSync(join(versionDir, "mmfonts.css"), `${cssLines.join("\n")}\n`);
  copyFileSync(join(PROJECT_ROOT, "CREDITS.md"), join(versionDir, "CREDITS.md"));
  copyFileSync(join(PROJECT_ROOT, "NOTICE.md"), join(versionDir, "NOTICE.md"));

  const checksumFiles = ["catalog.json", "mmfonts.css", "CREDITS.md", "NOTICE.md"];
  const checksums = Object.fromEntries(
    checksumFiles.map((name) => [name, sha256(readFileSync(join(versionDir, name)))]),
  );
  for (const font of catalogFonts) checksums[font.file.path] = font.file.sha256;
  writeFileSync(join(versionDir, "checksums.json"), json({ algorithm: "sha256", files: checksums }));

  cpSync(versionDir, aliasDir, { recursive: true });
  mkdirSync(outputRoot, { recursive: true });
  writeFileSync(join(outputRoot, "index.json"), json({
    name: "Myanmar Fonts CDN",
    latest: version,
    aliases: { [major]: version },
    catalog: `${major}/catalog.json`,
    stylesheet: `${major}/mmfonts.css`,
    attribution: "Based on the collection curated by SaturnGod (Htain Lin Shwe).",
  }));

  const headerPolicy = {
    cors: { "Access-Control-Allow-Origin": "*" },
    routes: {
      [`/${version}/*`]: { "Cache-Control": "public, max-age=31536000, immutable" },
      [`/${major}/*`]: { "Cache-Control": "public, max-age=300, must-revalidate" },
      "/index.json": { "Cache-Control": "public, max-age=300, must-revalidate" },
    },
  };
  writeFileSync(join(outputRoot, "headers.json"), json(headerPolicy));
  writeFileSync(join(outputRoot, "_headers"), [
    "/*",
    "  Access-Control-Allow-Origin: *",
    "  X-Content-Type-Options: nosniff",
    "",
    `/${version}/*`,
    "  Cache-Control: public, max-age=31536000, immutable",
    "",
    `/${major}/*`,
    "  Cache-Control: public, max-age=300, must-revalidate",
    "",
    "/index.json",
    "  Cache-Control: public, max-age=300, must-revalidate",
    "",
  ].join("\n"));

  return { version, major, fonts: catalogFonts.length, outputRoot };
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const result = build({
    version: args.version,
    baseUrl: args["base-url"],
    source: args.source,
    output: args.output,
  });
  console.log(`Built ${result.fonts} fonts into ${result.outputRoot}/${result.version} and ${result.major}`);
}
