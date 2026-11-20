# dsc-inner-plugin

The internal plugin index endorsed by dsc: it lists optional in-house plugins decoupled from the DeepSeek-Chat-Enhanced codebase, and dsc signs the whole site at publish time.

[简体中文](README.md) | [Documentation index](docs/README.md)

## Scope

This repository is an internal plugin index, not a community collection and not a separate index service: the distributed content is the index itself, and the build output in `dist/` is deployed straight to GitHub Pages.

- It lists optional in-house plugins decoupled from the DeepSeek-Chat-Enhanced codebase, built and maintained by dsc. Third-party submissions are not accepted.
- dsc signs and publishes it directly. When the market verifies this source, it first verifies the signature data of this repository's Pages site (the site-wide CMS signatures plus `dist/eec.pem`), then verifies the author signatures dsc provides as the plugin author.
- It is functionally similar to [awesome-dsc-plugin](https://github.com/omds-chat/awesome-dsc-plugin) but structurally different: that repository is a community collection where an EEC signs plugin files; here dsc signs the whole site and then signs plugins as their author.
- In-house plugins are trusted by origin, but they still go through the ordinary dsc-market install channel (a soft security gate), so their artifacts must remain independently verifiable.
- Being listed is not a certification. This repository guarantees only that distributed content matches its signatures, and does not audit plugin behaviour.

## How it differs from awesome-dsc-plugin

| Dimension | This repository | awesome-dsc-plugin |
|:---:|:---:|:---:|
| Role | internal plugin index endorsed by dsc | community plugin collection |
| What it lists | optional in-house plugins decoupled from DeepSeek-Chat-Enhanced, built by dsc | third-party plugins from community submissions |
| Trust anchor | the dsc web EEC signs the whole site | a collection EEC signs plugin files |
| Plugin file signatures | dsc signs `plugin.js.author.sig` as the author | authors sign `*.author.sig`, the collection adds CMS signatures |
| Version directory | `meta.json`, `plugin.js`, `plugin.js.author.sig` (optional) | `meta.json`, `plugin.js`, `plugin.js.sig`, `plugin.js.author.sig` (optional) |
| Certificate in the repository root | none, certificates appear only in `dist/` | none, the collection certificate lives in `certs/<source id>/` |
| Market verification order | verify the Pages site signatures first, then author signatures | verify the collection EEC chain first, then plugin signatures |
| Install channel | ordinary dsc-market channel with a soft security gate | the same |

On the awesome side the version directory now carries a single collection CMS signature, `plugin.js.sig`; the signature over `meta.json` (`meta.json.sig`) has been retired, and `plugin.js.author.sig` is kept but optional. There is no `eec.pem` in the repository root either: the collection certificate lives under `certs/<source id>/`, one folder per source. The difference between the two layouts is who signs the plugin files, not how many signature files exist.

## Index files

Index content comes only from the data files and the `plugins/` directory; no plugin entry is written by hand:

| File | Content |
|:---:|:---:|
| `plugins.json` | plugin directory index, unique `plugin_name` per entry |
| `tags.json` | plugin tag vocabulary; every entry's `tag` must come from it |
| `plugins/author_manifest.json` | registered authors |
| `.github/plugins-sources.json` | source manifest, an empty array means no plugin is listed |
| root `eec.pem` | absent; the web EEC certificate enters `dist/` only at signing time |

On an empty index `pnpm verify` and `pnpm build` pass without any certificate. Signing needs the web EEC key and certificate: when they are missing locally the script only warns and keeps an unsigned `dist/`, while CI treats the same condition as an error. This repository never invents plugin entries.

## Acceptance criteria

A plugin is listed only when every point below holds:

- It is built and maintained by omds-chat, with no third-party submissions.
- It is decoupled from the DeepSeek-Chat-Enhanced codebase: it can be installed and disabled on its own, without coordinated changes in that product itself.
- It commits to never collecting or leaking user credentials and data, never issues implicit network requests, and never reads conversation content unrelated to its own purpose.
- Its artifact is a single browser ESM script that exports `activate(context)` and depends on neither Node built-ins nor a backend API.
- It comes with a buildable source repository, so `pnpm build` can reproduce the artifact in CI.
- Its runtime metadata `meta.json` is complete and its plugin name matches `dsc-xxx` or `@scope/dsc-xxx`.
- Its maintainers answer user questions.

Plugins that need a backend, need native modules, or cannot be rebuilt in CI are not accepted.

## Signing and trust

### Two signing layers

Trust here is built from two layers. Both are signed by dsc, but they cover different objects and answer different questions.

| Layer | Signer | Key | Covers | Artifacts |
|:---:|:---:|:---:|:---:|:---:|
| Site-wide signature | the dsc web signer (EEC) | ECDSA P-256 | every `.html`, `.js`, `.css` and `.json` file in `dist/` | `<file>.sig`, `web_files.json`, `web_files.json.sig`, `eec.pem` |
| Author signature | dsc, as the plugin author | Ed25519 | `plugin.js` of every version | `plugin.js.author.sig`, with `.2`, `.3` for co-signers |

Both layers are needed because they answer two different questions:

- The site-wide signature answers "was this Pages site published by dsc". `plugins.json`, `versions.json` and every `meta.json` decide what the market displays, so they are signed too, and tampering with the index fails verification immediately.
- The author signature answers "was this plugin file written by dsc". Even if the file is copied elsewhere and distributed off this site, the author public key still verifies it independently.

### Certificate chain

Trust starts at the root certificate and ends at the bytes of a web file.

```text
Root CA (O=omds-chat, CN=DeepSeek-Chat-Enhanced ROOT CA; offline, root_ca.crt is distributed from the online-data branch)
  root_ca.crt
      │  issues
      ▼
dsc web EEC (O=omds-chat, CN=dsc-inner-plugin; CI secrets: WEB_EEC_KEY / WEB_EEC_CERT)
      │  openssl cms -sign -binary -md sha512 -outform DER
      ▼
dist/<file>.sig
dist/web_files.json.sig
```

| Item | Convention |
|:---:|:---:|
| Root CA key | ECDSA P-256, native OpenSSL PEM; browser WebCrypto supports P-256 most widely, the chain is verified in the browser, and Ed25519 is unavailable on the target browser floor |
| Root certificate | X.509 self-signed, subject `O=omds-chat, CN=DeepSeek-Chat-Enhanced ROOT CA`, `keyUsage=critical,keyCertSign,cRLSign`, `basicConstraints=critical,CA:TRUE,pathlen:0`, valid 3650 days |
| Web EEC key | ECDSA P-256 |
| Web EEC certificate | issued by the root CA, subject `O=omds-chat, CN=dsc-inner-plugin`, `keyUsage=critical,digitalSignature`, `basicConstraints=critical,CA:FALSE`, valid 365 days |
| Site-wide signature | CMS detached signature, `openssl cms -sign -binary -md sha512 -outform DER -nocerts -noattr`, one `<file>.sig` per file |
| Author signature | bare-public-key detached signature, `openssl pkeyutl -sign -rawin`, Ed25519 author keys |

The web EEC must be ECDSA P-256, not Ed25519: OpenSSL's CMS implementation reports `provider signature failure` when signing with an Ed25519 key, so it is unusable in practice.

Both signing and verification pass `-md sha512` explicitly and never rely on the OpenSSL default digest. The default varies with the version and with how the distribution was built (OpenSSL 3.x defaults to `sha256`), so a drift in that default makes the same artifact fail verification on another machine, with no visible cause. Stating the digest also keeps both sides byte-for-byte aligned, so a verifier never has to guess which digest the signer used.

The site-wide signature covers only `.html`, `.js`, `.css` and `.json`. `eec.pem` is the certificate itself and is read directly by the market; author signatures `plugin.js.author.sig` (and `.author.sig.<n>` for co-signers) are not covered by the site-wide signature, because they have their own verification path.

### Author signatures

dsc is also the plugin author, and signs `plugin.js` of every version with an Ed25519 bare public key. Under the organisation convention the author signature covers `plugin.js` only: author signatures over `meta.json` are retired, because the site-wide signature and the index data already cover `meta.json`. A leftover `meta.json.author.sig` in an old artifact is ignored and is not an error.

- The author public key ships with the artifact and is stored as `plugins/<author>/author_pub.pem` (Ed25519, OpenSSL PEM).
- The author signature has the same file name in the artifact and in the collection, `plugin.js.author.sig`; import only copies it and never renames it.
- One author can have several signers, paired by index as described in "Multi-signature naming" below.
- Author signatures are optional, but they are the default for in-house plugins. The plugin repository's build produces one only when `AUTHOR_SIGN_ENABLE=true` and `AUTHOR_SIGN_PRIVATE_KEY` are set; a missing author signature during import only produces a warning, and that version is still covered by the site-wide signature.
- The signature file and the author public key are paired by index, and both are required. A signature file without its public key makes that signer unverifiable (failed); a public key without a signature file makes the author signature of that version missing (unverified). Neither case counts as a pass, and both are warnings only, never blocking a release.
- Each signer is verified in turn, and any failure is reported as a warning only, never blocking a release (the organisation-wide rule: signature failures only warn). The verification result keeps the full signer list so the market can display multiple signers.

### Multi-signature naming

One author may have several signers, for example the author and a co-maintainer holding separate Ed25519 keys. File names pair by index, and index 1 keeps the historical name, so already published single-signer artifacts need no change:

| Signer index | Signature in the version directory | Public key in the author directory |
|:---:|:---:|:---:|
| 1 | `plugin.js.author.sig` | `author_pub.pem` |
| 2 | `plugin.js.author.sig.2` | `author_pub.2.pem` |
| n | `plugin.js.author.sig.<n>` | `author_pub.<n>.pem` |

- From index 2 on the suffix must be decimal without leading zeros, up to 16. Names such as `plugin.js.author.sig.1` or `plugin.js.author.sig.02` break the convention: verification only warns and ignores them.
- Indices do not have to be contiguous: a signer withdrawing deletes its own signature and public key, the other indices stay unchanged, and already published signature files are untouched.
- The index is used instead of a signer name in the file name because signer names have no organisation-wide registry: putting them into file names needs an extra mapping table and drags in case and escaping conflicts with author directory names and plugin names. An index depends only on two adjacent files in the same directory, so verifiers need no registry and adding a signer appends exactly one pair of files.
- Compatibility: single-signer artifacts, `author_pub.pem`, the historical directory layout and the documented paths stay byte-for-byte unchanged. The `.author.sig` prefix is kept, so every tool that recognises author signatures by that suffix, such as the orphan-signature sweep in `sign-site.mjs`, keeps working, and the new `.author.sig.<index>` files are recognised by the same rule.

### How the market verifies this source

The market reads the index, fetches files and verifies signatures in this order. Any failed step produces a warning only; it neither blocks nor silently passes.

| Step | Path | Purpose |
|:---:|:---:|:---:|
| 1 | `<base_url>/eec.pem` | read the dsc web signing certificate |
| 2 | `<base_url>/web_files.json` and `web_files.json.sig` | read the signed manifest and verify the manifest signature first |
| 3 | `<base_url>/<file>.sig` | verify the CMS signature of every file listed in the manifest |
| 4 | `<base_url>/plugins.json`, `plugins/<author>/<plugin>/versions.json`, every `meta.json` | index data, already verified in the previous step, drives what the market displays |
| 5 | `<base_url>/plugins/<author>/author_pub.pem`, `author_pub.<n>.pem`, `plugin.js.author.sig` and `.author.sig.<n>` | verify every author signer; failures only warn |
| 6 | `<base_url>/plugins/<author>/<plugin>/<x.y.z>/plugin.js` | read the runtime script, verified in the previous step |

The trust anchor for the chain is not in this repository but on the `online-data` branch: the market reads `rootCa` from `index.json`, fetches `root_ca.crt`, and uses it to verify `dist/eec.pem`. This repository only publishes the signed data to Pages.

The market caches the source type, script URL, certificate and signatures; this index is recorded as source type `inner`; the certificate and signatures are re-verified before every plugin run to catch tampering.

### The soft security gate

In-house plugins are trusted by origin: they are built by dsc and decoupled from DeepSeek-Chat-Enhanced, with no third party in between. But "trusted" does not mean "unchecked":

- They still go through the ordinary dsc-market install channel and must pass signature verification like any third-party plugin, with no shortcut.
- When a site-wide signature, an author signature or the certificate chain fails, the market warns the user and suggests downloading again. It never runs the plugin silently.
- The gate is soft: a failure only warns. It does not block, and it does not fall back to trusting anything. The user decides whether to continue, and the market does not decide for them.

The cost of this design is explicit: a tampered plugin may still be installed after the user accepts the warning. The benefit is equally explicit: verification does not depend on the market hard-coding trust in one source, so mirrors, alternative hosts and offline installs all use the same verification logic.

## Directory layout

The source repository holds index data and author material only; it holds no certificate.

```text
dsc-inner-plugin/
├── .github/
│   ├── plugins-sources.json            source manifest, the only input that decides what is listed
│   ├── plugins-sources.README.md       manifest fields and import rules
│   └── workflows/build-and-deploy.yml  import, verify, build, sign the site and publish
├── .gitattributes                      enforce LF line endings
├── .gitignore
├── LICENSE
├── README.md
├── README.en-US.md
├── meta.json                           index metadata, download counting switch
├── plugins.json                        plugin directory index, unique plugin_name per entry
├── tags.json                           preset tags
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── plugins/
│   ├── author_manifest.json            registered authors
│   └── <author>/
│       ├── author_pub.pem              signer 1's Ed25519 public key
│       ├── author_pub.<n>.pem          signer n's public key (optional)
│       ├── plugin_manifest.json        that author's plugin list
│       └── <plugin>/
│           ├── versions.json           version list
│           └── <x.y.z>/
│               ├── meta.json           plugin runtime metadata
│               ├── plugin.js           plugin runtime script
│               └── plugin.js.author.sig  author bare-key signature (optional, .2/.3 for co-signers)
└── scripts/
    ├── pki.mjs                         OpenSSL PKI wrapper, shell calls only, no cryptography
    ├── lib/collection-verify.mjs       shared verification logic
    ├── build-collection.mjs            verify and produce dist/
    ├── verify-collection.mjs           read-only consistency check
    ├── sign-site.mjs                   site-wide CMS signing over dist/
    ├── verify-site.mjs                 verify the site-wide signatures in dist/
    └── import-plugins.mjs              build and import plugins from the manifest
```

The build output `dist/` copies `meta.json`, `plugins.json`, `tags.json` and `plugins/` from the repository root and writes `build-info.json` as the distribution index; the signing stage then adds `eec.pem`, one `.sig` per signed file, `web_files.json` and `web_files.json.sig`.

Naming rules and required files are in [plugins/README.md](plugins/README.md).

## Index metadata

The root `meta.json` declares the download counting switch only:

| Field | Value | Meaning |
|:---:|:---:|:---:|
| `DOWNLOAD_COUNT_ENABLE` | `false` | When `true`, the market fires one fire-and-forget POST per download and tells users this source counts downloads |
| `DOWNLOAD_COUNT_API` | absent | Counting endpoint, required only when counting is on |
| `API_NEED_IP` | `false` | Whether the counting request carries the caller's public IP |

Counting is off for this index.

## How to get a plugin listed

1. An organisation maintainer opens a pull request against `.github/plugins-sources.json`, one entry per plugin, with `repo`, an optional `ref`, `author` and `plugin`. Field and import rules are in [.github/plugins-sources.README.md](.github/plugins-sources.README.md).
2. After merge, CI clones or copies the source into `temp/import/`, runs `pnpm install --frozen-lockfile` and `pnpm build`, writes `dist/meta.json` and `dist/plugin.js` into `plugins/<author>/<plugin>/<version>/`, copies `dist/plugin.js.author.sig` (and `.author.sig.<index>` for co-signers) into the version directory unchanged, copies `dist/author_pub.pem` and `author_pub.<index>.pem` into `plugins/<author>/` under the same names, then updates that plugin's `versions.json`, that author's `plugin_manifest.json` and the root `plugins.json`.
3. Add tags by hand. New index entries start with an empty `tag` array and need tags picked from `tags.json`. Undeclared tags are rejected by verification; a missing `tags.json` is an error as well and stops publication.
4. Build and publish. CI runs `pnpm verify` (consistency check, no certificate chain involved), `pnpm build` (produce `dist/`), `scripts/sign-site.mjs` (site-wide signing with `secrets.WEB_EEC_KEY`) and `scripts/verify-site.mjs` (signature self-check), then publishes `dist/` to Pages.

A failing import step skips that one plugin and logs the reason; the rest still run. A failing verification, build or signing step aborts the whole build.

## Adding an in-house plugin

Listing a plugin runs through four stages - directory, manifests, signing and verification - and each stage has a different owner. The only manual changes in this repository are the source manifest, the tags and the documentation; the import script, the plugin repository's build and CI do the rest.

| Stage | Owner | Where it is written | How it is triggered |
|:---:|:---:|:---:|:---:|
| Directory | CI import script | `plugins/<author>/<plugin>/<x.y.z>/` and `versions.json` | `node scripts/import-plugins.mjs --manifest .github/plugins-sources.json` |
| Manifests | an organisation maintainer declares the source, CI writes the manifests | `.github/plugins-sources.json`, `plugins/author_manifest.json`, `plugins/<author>/plugin_manifest.json`, `plugins.json` | a maintainer pull request, then the same import run; tags are added by hand |
| Signing | the author signature comes from the plugin repository's build, the site-wide signature from CI | `plugin.js.author.sig` (and `.author.sig.<index>`) plus `plugins/<author>/author_pub.pem` and `author_pub.<index>.pem`; `dist/<file>.sig`, `web_files.json`, `eec.pem` | artifact signatures are copied during import; the signing step runs `scripts/sign-site.mjs` with `secrets.WEB_EEC_KEY` and `secrets.WEB_EEC_CERT` |
| Verification | CI and the plugin market | read-only | CI runs `pnpm verify`, `pnpm build` and `pnpm verify:site` in order; the market replays "How the market verifies this source" |

Step by step, for one pull request:

1. An organisation maintainer adds one entry to `.github/plugins-sources.json` with `repo`, an optional `ref`, `author` and `plugin`, plus an optional `profile` to register the author page. Field rules are in [.github/plugins-sources.README.md](.github/plugins-sources.README.md).
2. After merge, CI imports: it creates the version directory, copies `dist/meta.json` and `dist/plugin.js`, copies `dist/plugin.js.author.sig` (and `.author.sig.<index>` for co-signers) into it unchanged, copies `dist/author_pub.pem` and `author_pub.<index>.pem` into `plugins/<author>/` under the same names, and updates `versions.json`, `plugin_manifest.json`, `author_manifest.json` and `plugins.json`.
3. The maintainer adds tags picked from `tags.json` to `plugins.json`; tags not declared there are rejected by verification, and a missing `tags.json` also stops verification and the build.
4. CI verifies and signs: `pnpm verify` must pass, `pnpm build` produces `dist/`, `scripts/sign-site.mjs` signs the whole site, and `scripts/verify-site.mjs` checks the result before Pages is published.

Directories and manifests are never written by hand. Adding an entry to `plugins.json` before the artifact exists makes verification fail, because every entry requires a complete version directory; the author public key and author signatures exist only when the artifact provides them, and the index never generates them. `dsc-humanize` is currently built only up to the author directory and the author manifest, `plugins.json` is still empty, and neither artifacts nor signatures have entered this repository. Rules and placeholder notes are in [plugins/README.md](plugins/README.md).

## Preset tags

`tags.json` is the tag table of this index, written from an in-house point of view and different from the preset tags of the community collection:

| Tag | Meaning |
|:---:|:---:|
| `core` | base capabilities that work together with DeepSeek-Chat-Enhanced itself |
| `ui` | interface and interaction enhancements |
| `market` | plugin market and distribution topics |
| `tooling` | development, debugging and build tools |

Tags must come from `tags.json`; undeclared tags are rejected by verification.

`tags.json` is a required root file, on par with `meta.json` and `plugins.json`. Without the vocabulary the whole rule "tags must come from the preset list" silently stops running, so a missing file is a `TAGS_MISSING` error: `pnpm verify` fails and `pnpm build` aborts before writing `dist/`; it is never downgraded to a warning. An empty vocabulary differs from a missing one: an empty array still runs the check, and every non-empty tag is rejected with `TAG_NOT_DECLARED`.

| Code | Level | When it fires | Action |
|:---:|:---:|:---:|:---:|
| `TAGS_MISSING` | error | the root has no `tags.json` | restore the vocabulary; verification and the build both stop |
| `TAGS_INVALID` | error | the top level is not an array of strings, or contains an empty string | fix `tags.json` to the vocabulary format |
| `TAGS_DUPLICATE` | warning | the vocabulary repeats a tag | remove the duplicate; publication is not blocked |
| `TAG_NOT_DECLARED` | error | a `plugins.json` entry uses a tag outside the vocabulary | change the tag, or extend the vocabulary first |

All four come from `scripts/lib/collection-verify.mjs`; `problems[].code` in `pnpm verify --json` uses the same names. A vocabulary that is not valid JSON is reported as `JSON_INVALID`, and an existing file that cannot be read is reported as `FILE_UNREADABLE`; both are errors as well.

## Cross-origin access

This index is hosted on GitHub Pages. Pages serves static assets with `Access-Control-Allow-Origin: *` by default, so the `base_url` used in the verification steps above is readable cross-origin, and the host side cannot narrow the allowed origins to a whitelist. That is platform behaviour, not a setting of this repository.

The specification requires cross-origin access limited to trusted origins, including `https://omds-chat.github.io` at the very least. If distribution is moved to another host, configure a CORS whitelist there that allows that origin at minimum.

## Local checks

```bash
pnpm install
pnpm verify                  # read-only consistency check, no certificate needed
pnpm build                   # writes dist/ once verification passes
pnpm sign -- --eec web-eec.pem   # needs WEB_EEC_KEY, signs dist/ as a whole site
pnpm verify:site -- --root-ca root_ca.crt   # verifies the site-wide signatures in dist/
pnpm run import              # import plugins from the source manifest
```

- `pnpm verify` and `pnpm build` involve no certificate and pass on an empty index.
- The required root files are `meta.json`, `plugins.json` and `tags.json`; a missing one ends with an error, and the code for a missing `tags.json` is `TAGS_MISSING`.
- Site-wide signing needs the web EEC private key. The key comes from `--key` or the `WEB_EEC_KEY` environment variable; the certificate comes from `--eec` or `WEB_EEC_CERT`. Both accept PEM text or a file path.
- When the key or the certificate is missing, `sign-site.mjs` only warns and keeps an unsigned `dist/`, which suits local debugging. CI passes `--require-key` and treats the same condition as an error.
- `verify-site.mjs` verifies the full certificate chain when `--root-ca` is given, and only checks signature integrity otherwise.
- Use `pnpm run import`. `pnpm import` is a built-in pnpm command, not this repository's import script.
- To produce author signatures, the import environment needs `AUTHOR_SIGN_ENABLE=true` and `AUTHOR_SIGN_PRIVATE_KEY`. The import script only forwards both to the plugin build and never reads the key content; when signing is enabled without a key it degrades to unsigned with a warning and import continues.
- An author signature failure only produces a warning and never fails `pnpm verify` or `pnpm build`; only index structure and public key material errors block.
- OpenSSL 3.0 or newer is required locally. The scripts only call the `openssl` command line and implement no cryptography themselves.

## Security notes

- When a signature fails, the market warns the user and suggests downloading again. It does not run the plugin silently.
- Being listed is not a certification. A signature proves the content matches its signer, not that the plugin behaviour was audited.
- Keep private keys in CI secrets and local environment variables, never in the repository. The web EEC key lives in `WEB_EEC_KEY`; the author key lives in `AUTHOR_SIGN_PRIVATE_KEY` on the plugin repository side and this repository only forwards it to the plugin build, never using it for import, verification or site-wide signing; the root private key never enters this repository and never enters CI. `.gitignore` already excludes `.env`.
- Rotating the web EEC key pair means updating both `WEB_EEC_KEY` and `WEB_EEC_CERT` and syncing `eec.pem` on the `online-data` branch; CMS signatures made with the old certificate can no longer be verified.
- Signatures cover file bytes. Any change to line endings, indentation or whitespace breaks verification, and the repository uses LF everywhere. Author artifacts must be LF too.
- Minify plugin artifacts. It reduces size and removes meaningless whitespace differences.

## License

Apache License 2.0, see [LICENSE](LICENSE).
