# dsc-inner-plugin

The plugin collection for dsc plugins built in-house by omdsc-dev. Plugins are indexed, signed and distributed here under distribution specification v2, and the plugin market reads this collection's manifests, end-entity certificate and signatures to consume them.

[简体中文](README.md)

## Scope

This repository is a plugin collection, not an index service, and it serves no static site page: the distributed content is the collection itself, and the build output in `dist/` is deployed straight to GitHub Pages.

- It is a sibling repository of the community collection [awesome-dsc-plugin](https://github.com/omdsc-dev/awesome-dsc-plugin). Both share the same directory layout, verification scripts and signature model; they differ only in what they accept and in their preset tags.
- The community collection accepts public submissions; this collection lists only plugins built by omdsc-dev and accepts no external submissions.
- Both collections are trusted through the same certificate chain: each holds an end-entity certificate issued by the dsce root CA. The certificate subjects differ and the private keys are held separately, so their signatures cannot stand in for each other.
- Being listed is not a certification. The collection guarantees only that distributed content matches its signatures, and does not audit plugin behaviour.

## Current state

omdsc-dev has not published an installable in-house plugin yet, so this collection is empty and holds no plugin entry:

| File | Content |
|:---:|:---:|
| `datalog.json` | `[]` |
| `plugins/author_manifest.json` | `[]` |
| `.github/plugins-sources.json` | `[]` |
| `eec.pem` | placeholder certificate, not yet issued by the dsce root CA |

On an empty collection `pnpm verify` and `pnpm build` pass in skeleton mode, and the missing root certificate and chain only produce warnings. This repository never invents plugin entries.

This collection does not hold an EEC yet: the organisation has so far issued an end-entity certificate to awesome-dsc-plugin only. CI therefore fails at the "Verify EEC against root CA" step until a real certificate is requested from the dsce root CA and replaces `eec.pem`. That is the expected state; do not skip verification to make the pipeline green.

## Acceptance criteria

A plugin is listed only when every point below holds:

- It is built and maintained by omdsc-dev, with no third-party submissions.
- It commits to never collecting or leaking user credentials and data, never issues implicit network requests, and never reads conversation content unrelated to its own purpose.
- Its artifact is a single browser ESM script that exports `activate(context)` and depends on neither Node built-ins nor a backend API.
- It comes with a buildable source repository, so `pnpm build` can reproduce the artifact in CI.
- Its runtime metadata `meta.json` is complete and its plugin name matches `dsc-xxx` or `@scope/dsc-xxx`.
- Its maintainers answer user questions.

Plugins that need a backend, need native modules, or cannot be rebuilt in CI are not accepted.

## Signing and trust

### Three roles

The signing system is built on OpenSSL PKI. Three roles each hold one key, so it is always clear who signs what.

| Role | Held by | Holds | Signs |
|:---:|:---:|:---:|:---:|
| Certificate authority | the `dsce` repository | root private key (offline, never committed), root certificate | the end-entity certificate `eec.pem` |
| End-entity signer (EEC) | this repository | EEC private key (CI secret `EEC_SECRET_KEY`), `eec.pem` | CMS detached signatures over plugin files |
| Independent signer | plugin authors, omdsc-dev included | author key pair | bare-public-key detached signatures over plugin files |

### Certificate chain

Trust starts at the root certificate and ends at the bytes of a plugin file.

```text
dsce repository (root CA, offline)
  root_ca.crt
      │  issues
      ▼
  this repository's eec.pem (end-entity certificate)
      │  openssl cms -sign -binary -outform DER
      ▼
  plugins/<author>/<plugin>/<x.y.z>/meta.json.sig
  plugins/<author>/<plugin>/<x.y.z>/plugin.js.sig
```

| Item | Convention |
|:---:|:---:|
| Root CA key | ECDSA P-256, native OpenSSL PEM; browser WebCrypto supports P-256 most widely, the chain is verified in the browser, and Ed25519 is unavailable on the target browser floor |
| Root certificate | X.509 self-signed, `keyUsage=critical,keyCertSign,cRLSign`, `basicConstraints=critical,CA:TRUE,pathlen:0`, valid 3650 days |
| EEC key | ECDSA P-256 |
| EEC certificate | issued by the root CA, `keyUsage=critical,digitalSignature`, `basicConstraints=critical,CA:FALSE`, valid 365 days |
| Collection signature | CMS detached signature, `openssl cms -sign -binary -outform DER -nocerts -noattr` |
| Author signature | bare-public-key detached signature, `openssl pkeyutl -sign -rawin`, Ed25519 author keys |

The EEC must be ECDSA P-256, not Ed25519: OpenSSL's CMS implementation reports `provider signature failure` when signing with an Ed25519 key, so it is unusable in practice.

### Author self-signatures

Plugin authors are independent signers. They do not go through this repository and do not depend on the certificate chain. Authors sign plugin files with a bare-public-key detached signature, and this repository only files the artifacts and the public key as they arrive:

- The author public key ships with the artifact and is stored as `plugins/<author>/author_pub.pem` (Ed25519, OpenSSL PEM).
- The author's `plugin.js.sig` and `meta.json.sig` are stored as `plugin.js.author.sig` and `meta.json.author.sig`, so they coexist with the collection CMS signatures and the file name tells the signer apart.

Author signatures are optional. When an author does not sign, that version carries only this repository's EEC signature.

### Verification semantics

- Verification before publishing is strict: `pnpm verify`, `pnpm build` and every CI step stop with a non-zero exit code on an error, so non-conforming content is never distributed.
- Verification after distribution is lenient: when a web-file signature, a plugin signature or a certificate chain check fails, the plugin market only warns. It does not block, and it does not fall back to trusting anything. The user decides whether to continue.
- Signatures cover raw file bytes. Any change to line endings, indentation or whitespace breaks verification, and the repository uses LF everywhere.

### How to request an EEC

The EEC of this collection must be requested from the dsce root CA. The certificate is issued by the root CA in the dsce repository; this repository cannot self-sign it, and cannot issue certificates for other collections.

1. Generate the EEC private key and a certificate signing request (CSR) locally, with the collection name as `CN`:

   ```bash
   openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out eec_secret.pem
   openssl req -new -key eec_secret.pem -out eec.csr -subj '/O=omdsc-dev/CN=dsc-inner-plugin'
   ```

2. Submit `eec.csr` to the dsce repository (the root CA maintainers), stating the purpose, the requested validity and a contact.
3. Put the returned certificate in the repository root as `eec.pem`, replacing the placeholder.
4. Put the contents of `eec_secret.pem` into the GitHub Actions secret `EEC_SECRET_KEY`. Never commit it.
5. After merge, CI verifies the `eec.pem` chain against the root certificate. A broken chain, an expired certificate, or the wrong `keyUsage` or `basicConstraints` aborts the build.

The root private key belongs to the offline environment of the dsce repository. Neither this repository nor its CI can or needs to reach it. The `eec.pem` currently in the repository is a placeholder: it was not issued by the root CA and must not be used for real signatures. Replace it before going live.

## Directory layout

Distribution specification v2 is deliberately tightly coupled: manifests, certificates, signatures and plugin payloads all live on one origin, which removes cross-origin injection paths.

```text
dsc-inner-plugin/
├── .github/
│   ├── plugins-sources.json            source manifest, the only input that decides what is listed
│   ├── plugins-sources.README.md       field reference for the manifest
│   └── workflows/build-and-deploy.yml  import, verify the chain, sign, commit, publish
├── .gitattributes                      enforce LF line endings
├── .gitignore
├── LICENSE
├── README.md
├── README.en-US.md
├── eec.pem                             end-entity certificate, replaced once the root CA issues it
├── meta.json                           collection metadata, download counting switch
├── datalog.json                        plugin catalogue, keyed by plugin name
├── tags.json                           preset tags
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── plugins/
│   ├── author_manifest.json            registered authors
│   └── <author>/
│       ├── author_pub.pem              that author's Ed25519 public key
│       ├── plugin_manifest.json        that author's plugin list
│       └── <plugin>/
│           ├── versions.json           version list
│           └── <x.y.z>/
│               ├── meta.json           plugin runtime metadata
│               ├── meta.json.sig       collection CMS signature
│               ├── plugin.js           plugin runtime script
│               ├── plugin.js.sig       collection CMS signature
│               └── plugin.js.author.sig  author bare-key signature (optional)
└── scripts/
    ├── pki.mjs                         OpenSSL PKI wrapper, shell calls only, no cryptography
    ├── lib/collection-verify.mjs       shared verification logic
    ├── build-collection.mjs            verify, sign and produce dist/
    ├── verify-collection.mjs           read-only consistency check
    └── import-plugins.mjs              build and import plugins from the manifest
```

Naming rules and required files are in [plugins/README.md](plugins/README.md).

## Collection metadata

The root `meta.json` declares the download counting switch only:

| Field | Current value | Meaning |
|:---:|:---:|:---:|
| `DOWNLOAD_COUNT_ENABLE` | `false` | When `true`, the market fires one fire-and-forget POST per download and tells users this source counts downloads |
| `DOWNLOAD_COUNT_API` | absent | Counting endpoint, required only when counting is on |
| `API_NEED_IP` | `false` | Whether the counting request carries the caller's public IP |

Counting is currently off for this collection.

## How to get a plugin listed

1. Open a pull request against `.github/plugins-sources.json`, one entry per plugin, with `repo`, an optional `ref`, `author` and `plugin`. Fields are documented in [plugins-sources.README.md](.github/plugins-sources.README.md).
2. After merge, CI clones or copies the source into `temp/`, runs `pnpm install --frozen-lockfile` and `pnpm build`, writes `dist/meta.json` and `dist/plugin.js` into `plugins/<author>/<plugin>/<version>/`, stores author-side detached signatures as `*.author.sig`, stores `dist/author_pub.pem` as `plugins/<author>/author_pub.pem`, then updates that plugin's `versions.json`, that author's `plugin_manifest.json` and the root `datalog.json`.
3. Add tags by hand. New catalogue entries start with an empty `tag` array and need tags picked from `tags.json`. Undeclared tags are rejected by verification.
4. Merge and distribute. CI resolves the root certificate, verifies the `eec.pem` chain with `openssl verify`, signs `meta.json` and `plugin.js` of every version with `EEC_SECRET_KEY`, re-verifies `dist/`, commits the changes to `plugins/` and `datalog.json` back to the repository, and publishes `dist/` to Pages.

A failing import step skips that one plugin and logs the reason; the rest still run. A failing signing or verification step aborts the whole build.

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

The market reads collection metadata and the plugin catalogue first, then fetches version files and signatures by path, and finally anchors `eec.pem` in the root certificate. A single source usually gets several `base_url` entries: a mirrored CDN distribution service, `raw.githubusercontent.com`, and GitHub Pages, with the last two as fallbacks and a one second cap per request.

| Step | Path | Purpose |
|:---:|:---:|:---:|
| 1 | `<base_url>/meta.json` | Check whether this source counts downloads |
| 2 | `<base_url>/datalog.json` | List plugins, authors and tags |
| 3 | `<base_url>/plugins/<author>/<plugin>/versions.json` | Read the version list and the latest version |
| 4 | `<base_url>/plugins/<author>/<plugin>/<x.y.z>/meta.json` | Read plugin metadata |
| 5 | `<base_url>/plugins/<author>/<plugin>/<x.y.z>/plugin.js` | Read the runtime script |
| 6 | `<base_url>/plugins/<author>/<plugin>/<x.y.z>/plugin.js.sig` and `meta.json.sig` | Read the collection CMS signatures |
| 7 | `<base_url>/eec.pem` | Read the end-entity certificate and verify its chain against the root certificate |
| 8 | `<base_url>/plugins/<author>/author_pub.pem` and `*.author.sig` | Read the author key and signatures when the version carries them |

The market stores the source type, script URL, certificate and signatures in IndexedDB. This collection is recorded as source type `inner`; `source_url` holds the plugin script URL; the certificate and signatures are re-verified before every plugin run to catch tampering. Any failed check produces a warning only and does not block loading.

## Cross-origin access

This collection is hosted on GitHub Pages. Pages serves static assets with `Access-Control-Allow-Origin: *` by default, so all three `base_url` entries above are readable cross-origin, and the host side cannot narrow the allowed origins to a whitelist. That is platform behaviour, not a setting of this repository.

The specification requires cross-origin access limited to trusted origins, including `https://omdsc-dev.github.io` at the very least. If distribution is moved to another host, configure a CORS whitelist there that allows that origin at minimum.

## Local checks

```bash
pnpm install
pnpm verify        # read-only consistency check, chain and signatures degrade to warnings without a root certificate
pnpm build         # writes dist/ once verification passes
pnpm run import    # import plugins from the source manifest
```

- `pnpm verify` and `pnpm build` run in skeleton mode with warnings while no usable certificate chain exists, which suits an empty collection and local development. With a root certificate at hand, verify strictly:

  ```bash
  pnpm verify:strict --root-ca root_ca.crt
  ROOT_CA_PATH=root_ca.crt pnpm verify:strict
  ```

- Use `pnpm run import`. `pnpm import` is a built-in pnpm command, not this repository's import script.
- Run `pnpm sign --root-ca root_ca.crt` to produce CMS signatures with `EEC_SECRET_KEY` and emit `dist/`. It fails outright when the key does not match `eec.pem` or when no root certificate is supplied.
- OpenSSL 3.0 or newer is required locally. The scripts only call the `openssl` command line and implement no cryptography themselves.

## Security notes

- When a signature fails, the market warns the user and suggests downloading again. It does not run the plugin silently.
- Being listed is not a certification. A signature proves the content matches its signer, not that the plugin behaviour was audited.
- Keep private keys in CI secrets and local environment variables, never in the repository. The EEC key lives in `EEC_SECRET_KEY`; the root private key never enters this repository. `.gitignore` already excludes `.env`.
- Rotating the EEC key pair means replacing `eec.pem` and requesting a new certificate from dsce; CMS signatures made with the old certificate can no longer be verified.
- Signatures cover file bytes. Any change to line endings, indentation or whitespace breaks verification, and the repository uses LF everywhere. Author artifacts must be LF too.
- Minify plugin artifacts. It reduces size and removes meaningless whitespace differences.

## License

Apache License 2.0, see [LICENSE](LICENSE).
