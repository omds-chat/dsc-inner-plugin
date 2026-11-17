# dsc In-House Plugins

[中文](README.md)

Index and distribution entry for plugins built by the omdsc-dev organization, a companion repository to the community collection [awesome-dsc-plugin](https://github.com/omdsc-dev/awesome-dsc-plugin).

## Scope

This repository does three things:

- Maintain the in-house plugin index `index.json`, recording the id, name, version, description, author, homepage and download address of every listed plugin.
- Serve a static site that shows the entries, the install steps and the download address.
- Commit to listing only plugins that do not collect or leak user credentials and data.

Division of work: `awesome-dsc-plugin` accepts community submissions, while this repository lists plugins built by omdsc-dev only. The index format is identical, so the DeepSeek-Chat-Enhanced plugin market can consume either one.

## Current index

The plugins bundled with DeepSeek-Chat-Enhanced (dsc-core, dsc-plugin-engine, dsc-market) ship with the product and never appear in this index. omdsc-dev has not published any installable in-house plugin yet, so `plugins/` only holds its README and the generated index is empty:

```json
{
  "schemaVersion": 1,
  "plugins": []
}
```

The site renders a dedicated empty state for that index and never shows invented entries.

## Index format

```json
{
  "schemaVersion": 1,
  "plugins": [
    {
      "id": "dsc-example",
      "name": "Example",
      "version": "0.1.0",
      "description": "One line summary",
      "author": "omdsc-dev",
      "homepage": "https://github.com/omdsc-dev/dsc-inner-plugin",
      "download": "https://omdsc-dev.github.io/dsc-inner-plugin/plugins/dsc-example.js",
      "manifest": {}
    }
  ]
}
```

The snippet above only documents the shape and is not a listed entry.

| Field | Type | Required | Notes |
|:---:|:---:|:---:|:---:|
| `schemaVersion` | number | yes | Always 1 |
| `plugins` | array | yes | Entries sorted by `id` |
| `plugins[].id` | string | yes | Matches `^[a-z][a-z0-9-]{2,63}$` |
| `plugins[].name` | string | yes | Non-empty display name |
| `plugins[].version` | string | yes | Three numeric parts, such as `0.1.0` |
| `plugins[].description` | string | yes | Non-empty one line summary |
| `plugins[].author` | string | yes | Non-empty author or organization |
| `plugins[].homepage` | string | yes | http or https URL |
| `plugins[].download` | string | yes | https URL or a repository relative path |
| `plugins[].manifest` | object | no | Falls back to the manifest exported by the artifact |

## Directory layout

```text
dsc-inner-plugin/
├── .github/workflows/deploy.yml
├── .gitignore
├── LICENSE
├── README.md
├── README.en-US.md
├── build.mjs
├── package.json
├── pnpm-workspace.yaml
├── plugins/README.md
├── scripts/build-index.mjs
├── tsconfig.json
└── src/
    ├── index.html
    ├── main.ts
    ├── styles.css
    └── i18n.ts
```

## Build

```bash
pnpm install
pnpm run type
pnpm run build
```

`pnpm run build` chains two scripts, and their order must not be swapped:

1. `node build.mjs`: clears `dist/`, bundles `src/main.ts` into `dist/assets/main.js` with esbuild, copies the stylesheet and the page, and writes `dist/.nojekyll`.
2. `node scripts/build-index.mjs`: validates `plugins/*.json` and writes `dist/index.json` plus `dist/plugins/*.json`.

The site build runs first because it clears the whole `dist/` directory. Index generation only removes the files it owns, so it runs afterwards and its output survives.

Individual scripts:

```bash
pnpm run build:site   # site only
pnpm run build:index  # index only
pnpm run type         # type check
```

## Local preview

```bash
pnpm run build
npx serve dist
```

The site fetches `./index.json` from its own directory, so the index file must sit next to it.

## Listing requirements

- Built and maintained by omdsc-dev.
- Does not collect or leak user credentials and data, and does not make hidden network requests.
- Artifact follows the dsc plugin product spec: a single browser ESM js file exporting `activate(context)`, with no Node built-ins and no backend calls.
- Ships an https download address, or a repository that can be built.
- Passes every check in `node scripts/build-index.mjs`.

See [plugins/README.md](plugins/README.md) for details.

## Install

1. Open the plugin panel from the DeepSeek-Chat-Enhanced sidebar.
2. Paste the plugin download URL into the "Install from URL" box at the bottom of the panel.
3. Click Install, and the plugin activates right away.

The site repeats these three steps for every entry and offers a one click copy of the download address.

## Site behavior

- Fetches this repository's own `./index.json` and nothing external.
- Renders an empty state when the index has no entries.
- Chinese and English switch, light and dark follow the system setting.
- Inline messages only, never native browser dialogs.
- Single column on narrow screens, with no framework and no runtime dependency.

## Deployment

`.github/workflows/deploy.yml` runs on pushes to `main` that touch `plugins/`, `scripts/`, `src/` or `build.mjs`, and on manual dispatch. It runs `pnpm install --frozen-lockfile` and `pnpm build`, then publishes `dist/` to Pages.

Permissions are limited to `contents: read`, `pages: write` and `id-token: write`.

Commit `pnpm-lock.yaml` together with the rest, otherwise the frozen install fails.

## License

Apache-2.0, see [LICENSE](LICENSE).
