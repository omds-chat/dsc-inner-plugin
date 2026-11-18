# dsc-inner-plugin

The plugin collection for dsc plugins built in-house by omdsc-dev. Plugins are indexed, signed and distributed here under distribution specification v2, and the plugin market reads this collection manifests and public key to consume them.

[简体中文](README.md)

## Scope

This repository is a plugin collection, not an index service, and it serves no static site page: the distributed content is the collection itself, and the build output in `dist/` is deployed straight to GitHub Pages.

- It is a sibling repository of the community collection [awesome-dsc-plugin](https://github.com/omdsc-dev/awesome-dsc-plugin). Both share the same directory layout, verification scripts and signature model; they differ only in what they accept and in their preset tags.
- The community collection accepts public submissions; this collection lists only plugins built by omdsc-dev and accepts no external submissions.
- This collection signs plugins as `dsc-inner-plugin`. Different signer identifiers cannot stand in for each other, yet both collections are trusted through the same dsc trust signature model.
- Being listed is not a certification. The collection guarantees only that distributed content matches its signatures, and does not audit plugin behaviour.

## Current state

omdsc-dev has not published an installable in-house plugin yet, so this collection is empty and holds no plugin entry:

| File | Content |
|:---:|:---:|
| `datalog.json` | `[]` |
| `plugins/author_manifest.json` | `[]` |
| `plugin_set_sign.json` | `{ "sign": [] }` |
| `plugin_secret.pub` | placeholder key, rewritten by CI from `PLUGIN_PRIVATE_KEY` |

On an empty collection `pnpm verify` and `pnpm build` both pass, and the empty trust signature only produces a warning. This repository never invents plugin entries.

## Acceptance criteria

A plugin is listed only when every point below holds:

- It is built and maintained by omdsc-dev, with no third-party submissions.
- It commits to never collecting or leaking user credentials and data, never issues implicit network requests, and never reads conversation content unrelated to its own purpose.
- Its artifact is a single browser ESM script that exports `activate(context)` and depends on neither Node built-ins nor a backend API.
- It comes with a buildable source repository, so `pnpm build` can reproduce the artifact in CI.
- Its runtime metadata `meta.json` is complete and its plugin name matches `dsc-xxx` or `@scope/dsc-xxx`.
- Its maintainers answer user questions.

Plugins that need a backend, need native modules, or cannot be rebuilt in CI are not accepted.

## Directory layout

Distribution specification v2 is deliberately tightly coupled: manifests, keys, signatures and plugin payloads all live on one origin, which removes cross-origin injection paths.

```text
dsc-inner-plugin/
├── .github/
│   ├── plugins-sources.json            source manifest, the only input that decides what is listed
│   ├── plugins-sources.README.md       field reference for the manifest
│   ├── scripts/import-plugins.mjs      build and import plugins from the manifest
│   └── workflows/build-and-deploy.yml  verify, sign, commit distribution content, publish
├── .gitattributes                      enforce LF line endings
├── .gitignore
├── LICENSE
├── README.md
├── README.en-US.md
├── meta.json                           collection metadata, download counting switch
├── plugin_secret.pub                   collection public key, rewritten by CI from the private key
├── plugin_set_sign.json                dsc trust signature for this collection
├── datalog.json                        plugin catalogue, keyed by plugin name
├── tags.json                           preset tags
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── plugins/
│   ├── author_manifest.json            registered authors
│   └── <author>/
│       ├── plugin_secret.pub           that author public key
│       ├── plugin_manifest.json        that author plugin list
│       └── <plugin>/
│           ├── versions.json           version list
│           └── <x.y.z>/
│               ├── meta.json           plugin runtime metadata
│               ├── plugin.js           plugin runtime script
│               └── plugin_sign.json    collection signature and author self-signature
└── scripts/
    ├── sign.mjs                        Ed25519 hash-then-sign primitives
    ├── lib/collection-verify.mjs       shared verification logic
    ├── build-collection.mjs            verify, sign and produce dist/
    └── verify-collection.mjs           read-only consistency check
```

Naming rules and required files are in [plugins/README.md](plugins/README.md).

## Collection metadata

The root `meta.json` declares the download counting switch only:

| Field | Current value | Meaning |
|:---:|:---:|:---:|
| `DOWNLOAD_COUNT_ENABLE` | `false` | When `true`, the market fires one fire-and-forget POST per download and tells users this source counts downloads |
| `DOWNLOAD_COUNT_API` | absent | Counting endpoint, required only when counting is on |
| `API_NEED_IP` | `false` | Whether the counting request carries the caller public IP |

Counting is currently off for this collection.

## Trust chain

Three signing layers. Each layer signs only what the next one needs.

| Layer | Signer | Private key | Signed object | Artifact |
|:---:|:---:|:---:|:---:|:---:|
| dsc | `dsc` | dsc key, never in this repository | bytes of the root `plugin_secret.pub` | `plugin_set_sign.json` |
| Collection | `dsc-inner-plugin` | `PLUGIN_PRIVATE_KEY` | `meta.json` and `plugin.js` of every version | `plugin_sign.json` inside the version directory |
| Author | author name | `AUTHOR_SIGN_PRIVATE_KEY` | same files, optional | appended to the same `plugin_sign.json` |

- The market embeds the dsc public key. It validates `plugin_set_sign.json` first, trusts this collection `plugin_secret.pub` only after that, and then validates plugin signatures with it.
- Delegation is not supported. This collection cannot issue a trust signature for another collection.
- The algorithm is fixed to Ed25519 with hash-then-sign: SHA-512 over the file bytes, then sign the digest, base64 encoded.
- Collection signatures and author self-signatures coexist in one `plugin_sign.json` and are told apart by the `signer` field. Author signatures verify against `plugins/<author>/plugin_secret.pub`, collection signatures against the root `plugin_secret.pub`.
- A public key is always what the private key derives. CI derives it from `PLUGIN_PRIVATE_KEY` and overwrites `plugin_secret.pub`; the build fails when the derived key differs from the committed one.

## How to get a plugin listed

1. Open a pull request against `.github/plugins-sources.json`, one entry per plugin, with `repo`, an optional `ref`, `author` and `plugin`. Fields are documented in [plugins-sources.README.md](.github/plugins-sources.README.md).
2. After merge, CI clones or copies the source into `temp/`, runs `pnpm install --frozen-lockfile` and `pnpm build`, writes `dist/meta.json` and `dist/plugin.js` into `plugins/<author>/<plugin>/<version>/`, then updates that plugin `versions.json`, that author `plugin_manifest.json` and the root `datalog.json`. An author self-signature shipped in the artifact is preserved.
3. Add tags by hand. New catalogue entries start with an empty `tag` array and need tags picked from `tags.json`. Undeclared tags are rejected by verification.
4. Merge and distribute. CI signs `meta.json` and `plugin.js` of every version with `PLUGIN_PRIVATE_KEY`, keeps author self-signatures, commits the changes to `plugins/`, `plugin_secret.pub` and `datalog.json` back to the repository, and publishes `dist/` to Pages.

A failing step skips that one plugin and logs the reason; the rest still run.

## Preset tags

`tags.json` is the tag table of this collection, written from an in-house point of view and different from the preset tags of the community collection:

| Tag | Meaning |
|:---:|:---:|
| `core` | base capabilities that work together with dsc itself |
| `ui` | interface and interaction enhancements |
| `market` | plugin market and distribution topics |
| `tooling` | development, debugging and build tools |

Tags must come from `tags.json`; undeclared tags are rejected by verification.

## How the plugin market consumes this collection

The market reads collection metadata and the plugin catalogue first, then fetches version files by path. A single source usually gets several `base_url` entries: a mirrored CDN distribution service, `raw.githubusercontent.com`, and GitHub Pages, with the last two as fallbacks and a one second cap per request.

| Step | Path | Purpose |
|:---:|:---:|:---:|
| 1 | `<base_url>/meta.json` | Check whether this source counts downloads |
| 2 | `<base_url>/datalog.json` | List plugins, authors and tags |
| 3 | `<base_url>/plugins/<author>/<plugin>/versions.json` | Read the version list and the latest version |
| 4 | `<base_url>/plugins/<author>/<plugin>/<x.y.z>/meta.json` | Read plugin metadata |
| 5 | `<base_url>/plugins/<author>/<plugin>/<x.y.z>/plugin.js` | Read the runtime script |
| 6 | `<base_url>/plugins/<author>/<plugin>/<x.y.z>/plugin_sign.json` | Read signatures for that version |
| 7 | `<base_url>/plugin_set_sign.json` and `<base_url>/plugin_secret.pub` | Verify the source and obtain the collection public key |

The market stores the source type, script URL, public key and signature in IndexedDB. This collection is recorded as source type `inner`; `source_url` holds the plugin script URL; `pub` and `sign` hold the public key and signature obtained on download, and are re-verified before every plugin run to catch tampering.

## Cross-origin access

This collection is hosted on GitHub Pages. Pages serves static assets with `Access-Control-Allow-Origin: *` by default, so all three `base_url` entries above are readable cross-origin, and the host side cannot narrow the allowed origins to a whitelist. That is platform behaviour, not a setting of this repository.

The specification requires cross-origin access limited to trusted origins, including `https://omdsc-dev.github.io` at the very least. If distribution is moved to another host, configure a CORS whitelist there that allows that origin at minimum.

## Local checks

```bash
pnpm install
pnpm verify        # read-only consistency check, warns while the trust signature is empty
pnpm build         # writes dist/ once verification passes
pnpm run import    # import plugins from the source manifest
```

- `pnpm verify` and `pnpm build` fall back to skeleton mode with a warning while no dsc trust signature exists. With a dsc public key configured, `pnpm verify:strict` checks strictly; pass the key through `DSC_PUBLIC_KEY` or `--trust-public-key`.
- Use `pnpm run import`. `pnpm import` is a built-in pnpm command, not the import script of this repository.
- Run `pnpm sign` to sign plugins with `PLUGIN_PRIVATE_KEY` and produce `dist/`.

## Security notes

- When a signature fails, the market warns the user and suggests downloading again. It does not run the plugin silently.
- Being listed is not a certification. A signature proves the content matches its signer, not that the plugin behaviour was audited.
- Keep private keys in CI secrets and local environment variables, never in the repository. `.gitignore` already excludes `.env`.
- Replacing the collection key invalidates every trust signature dsc has issued, so a new one must be requested.
- Signatures cover file bytes. Any change to line endings, indentation or whitespace breaks verification, and the repository uses LF everywhere.
- Minify plugin artifacts. It reduces size and removes meaningless whitespace differences.

## License

Apache License 2.0, see [LICENSE](LICENSE).
