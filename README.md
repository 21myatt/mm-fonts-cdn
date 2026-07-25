# Myanmar Fonts CDN

A static, versioned CDN build based on the
[Myanmar Unicode Fonts](https://github.com/saturngod/myanmar-unicode-fonts)
collection curated and maintained by **SaturnGod (Htain Lin Shwe)**.

This package does not modify the upstream repository. It validates upstream
`fonts.json`, copies the catalogued font files, and generates CSS, JSON
manifests, SHA-256 checksums, and stable version aliases.

## Build

From this directory:

```sh
npm run build
```

Optional configuration:

```sh
node scripts/build.mjs --version 1.0.0 --base-url https://cdn.example.com
```

The default SaturnGod source snapshot is vendored under `vendor/saturngod`, so
this repository builds independently. Override it with
`--source /absolute/path/to/reactjs` when auditing a newer upstream checkout.

## Generated endpoints

The build emits both an immutable semantic version and a stable major alias:

```text
dist/1.0.0/catalog.json
dist/1.0.0/mmfonts.css
dist/1.0.0/checksums.json
dist/1.0.0/fonts/<author-folder>/<font-file>
dist/v1/...
dist/index.json
dist/_headers
dist/headers.json
```

With `--base-url https://cdn.example.com`, CSS font URLs are absolute. Without
it, CSS uses relative `fonts/...` URLs and can be hosted at any origin or path.

```html
<link rel="stylesheet" href="https://cdn.example.com/v1/mmfonts.css">
```

```css
body { font-family: "Pyidaungsu", sans-serif; }
```

`_headers` is directly usable by Cloudflare Pages and Netlify. For another
provider, translate `headers.json` into its configuration. Font responses allow
cross-origin use; immutable version paths cache for one year, while `v1` and
the root index use short revalidation caches.

`catalog.json` is intended for machines. It includes author/source attribution,
file size, SHA-256 integrity, style, CSS family, and license status for every
font.

## Attribution and font licensing

See [CREDITS.md](./CREDITS.md) and [NOTICE.md](./NOTICE.md). The upstream
repository does not provide a repository-wide license or verified per-font
licenses. Consequently, every generated font entry is marked
`license.status: "unverified"` unless the source catalog is later enriched with
documented license data.

The build also includes face-level, non-overlapping imports from
[AungMyoKyaw/Myanmar-Unicode-Fonts](https://github.com/AungMyoKyaw/Myanmar-Unicode-Fonts).
Duplicates are excluded using embedded family/style identities. Imported fonts
retain that repository as their immediate `sourceUrl` and `license.url`; the
license status remains `unverified`.

The curated
[khzaw/awesome-myanmar-unicode](https://github.com/khzaw/awesome-myanmar-unicode)
list is also audited as a discovery source. It contributed one non-overlapping
face, Masterpiece Uni Sans, downloaded from the canonical Prahita release.

Credit is not a substitute for permission. Anyone operating a public CDN should
verify the redistribution and webfont rights of each font first.

## GitHub and jsDelivr

Versioned release artifacts are intentionally committed under `dist/` so they
can be served through jsDelivr from the GitHub repository:

```text
https://cdn.jsdelivr.net/gh/21myatt/mm-fonts-cdn@v1.0.0/dist/1.0.0/mmfonts.css
https://cdn.jsdelivr.net/gh/21myatt/mm-fonts-cdn@v1.0.0/dist/1.0.0/catalog.json
```

Create a new immutable Git tag for every published CDN version. Do not move or
replace an existing version tag after publication.
