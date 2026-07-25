# Myanmar Fonts CDN

A static, versioned CDN for Myanmar Unicode fonts, based on the
[Myanmar Unicode Fonts](https://github.com/saturngod/myanmar-unicode-fonts)
collection curated and maintained by **SaturnGod (Htain Lin Shwe)**, with
additional non-overlapping fonts from credited community sources.

The current release contains **132 font faces** with CSS definitions, a
machine-readable catalog, source attribution, license metadata, and SHA-256
checksums.

## Quick start

Add the pinned stylesheet to your page:

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/gh/21myatt/mm-fonts-cdn@v1.0.1/dist/1.0.1/mmfonts.css"
>
```

Then choose a family from [`catalog.json`](https://cdn.jsdelivr.net/gh/21myatt/mm-fonts-cdn@v1.0.1/dist/1.0.1/catalog.json):

```css
body {
  font-family: "Pyidaungsu", sans-serif;
}
```

The release URL is pinned to `v1.0.1`, so an existing website will not change
when a future version is published.

### Load one font only

If you do not want the complete stylesheet, define only the font you need:

```css
@font-face {
  font-family: "Pyidaungsu";
  src: url("https://cdn.jsdelivr.net/gh/21myatt/mm-fonts-cdn@v1.0.1/dist/1.0.1/fonts/other/Pyidaungsu.ttf") format("truetype");
  font-display: swap;
}

body {
  font-family: "Pyidaungsu", sans-serif;
}
```

Font paths are case-sensitive. Use the `file.url` and `cssFamily` values in the
catalog instead of guessing a path or family name.

## CDN endpoints

| Resource | Production URL |
| --- | --- |
| Complete stylesheet | [`mmfonts.css`](https://cdn.jsdelivr.net/gh/21myatt/mm-fonts-cdn@v1.0.1/dist/1.0.1/mmfonts.css) |
| Font catalog | [`catalog.json`](https://cdn.jsdelivr.net/gh/21myatt/mm-fonts-cdn@v1.0.1/dist/1.0.1/catalog.json) |
| SHA-256 checksums | [`checksums.json`](https://cdn.jsdelivr.net/gh/21myatt/mm-fonts-cdn@v1.0.1/dist/1.0.1/checksums.json) |
| Credits | [`CREDITS.md`](https://cdn.jsdelivr.net/gh/21myatt/mm-fonts-cdn@v1.0.1/dist/1.0.1/CREDITS.md) |
| Usage and license notice | [`NOTICE.md`](https://cdn.jsdelivr.net/gh/21myatt/mm-fonts-cdn@v1.0.1/dist/1.0.1/NOTICE.md) |

`catalog.json` includes the CSS family, author or source, style, file URL, file
size, SHA-256 hash, encoding, risk flags, and known license status for every
font.

## Attribution and font licensing

See [CREDITS.md](./CREDITS.md) and [NOTICE.md](./NOTICE.md) before using or
redistributing a font. Credit is not a substitute for permission.

The original collection does not provide a repository-wide license or verified
licenses for every font. Entries remain marked `unverified` unless a reliable
font-specific license source has been documented. Users are responsible for
confirming web embedding, redistribution, modification, and commercial-use
rights with the respective font copyright holders.

Sources include:

- [SaturnGod/myanmar-unicode-fonts](https://github.com/saturngod/myanmar-unicode-fonts) — original project and primary collection
- [AungMyoKyaw/Myanmar-Unicode-Fonts](https://github.com/AungMyoKyaw/Myanmar-Unicode-Fonts) — additional non-overlapping faces
- [khzaw/awesome-myanmar-unicode](https://github.com/khzaw/awesome-myanmar-unicode) — discovery source for Masterpiece Uni Sans

Known creators, studios, curators, and contributors are listed in
[CREDITS.md](./CREDITS.md) and preserved per font where the source data allows.

## Build locally

This package does not modify the upstream repositories. It validates the
vendored source data and generates static release artifacts.

```sh
npm test
npm run build
```

Optional configuration:

```sh
node scripts/build.mjs --version 1.0.1 --base-url https://cdn.example.com
```

The default SaturnGod source snapshot is vendored under `vendor/saturngod`, so
this repository builds independently. Override it with
`--source /absolute/path/to/reactjs` when auditing a newer upstream checkout.

## Generated files

The build emits both an immutable semantic version and a stable major alias:

```text
dist/1.0.1/catalog.json
dist/1.0.1/mmfonts.css
dist/1.0.1/checksums.json
dist/1.0.1/fonts/<author-folder>/<font-file>
dist/v1/...
dist/index.json
dist/_headers
dist/headers.json
```

With `--base-url https://cdn.example.com`, CSS font URLs are absolute. Without
it, CSS uses relative `fonts/...` URLs and can be hosted at any origin or path.

`_headers` is directly usable by Cloudflare Pages and Netlify. For another
provider, translate `headers.json` into its configuration. Font responses allow
cross-origin use; immutable version paths cache for one year, while `v1` and
the root index use short revalidation caches.

## Publishing

Versioned release artifacts are intentionally committed under `dist/` so they
can be served through jsDelivr from the GitHub repository:

```text
https://cdn.jsdelivr.net/gh/21myatt/mm-fonts-cdn@v1.0.1/dist/1.0.1/mmfonts.css
https://cdn.jsdelivr.net/gh/21myatt/mm-fonts-cdn@v1.0.1/dist/1.0.1/catalog.json
```

Create a new immutable Git tag for every published CDN version. Never move or
replace an existing version tag after publication. Update both the package
version and versioned documentation URLs when releasing a new version.
