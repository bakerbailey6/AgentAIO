# SQLCipher encryption-at-rest — design & spike outcome

**Status:** implemented · **Branch:** `hardening/sqlcipher-vault` · **Spec ref:** design §9.2

Encrypt the app's SQLite database at rest with SQLCipher, unlocked on launch by a
passphrase held only in the OS keychain. Previously the DB opened as plaintext
`sqlite:acc.db` via `@tauri-apps/plugin-sql`.

## Spike: Path A vs Path B

The plan offered two approaches. A time-boxed spike settled it:

### Path A — keep the plugin, `PRAGMA key` after `Database.load()` — REJECTED

`tauri-plugin-sql` 2.4.0 opens the DB with a bare `Pool::connect(url)`
(`wrapper.rs:91`) — there is **no hook to run `PRAGMA key` before sqlx touches
the file**. sqlx's `create_database` + connect run first, so:

- on first run the file is created **unencrypted** (the later front-end
  `PRAGMA key` does not retro-encrypt it);
- on later runs an encrypted file **fails at connect** ("file is not a
  database").

Making this work would require forking the plugin to expose
`SqliteConnectOptions` with a connect-time key pragma. Architecturally dead.

### Path B — custom rusqlite + SQLCipher layer — CHOSEN

A small native layer owns one SQLCipher-keyed `rusqlite` connection and exposes
`vault_open` / `vault_execute` / `vault_select`. The TS handle returned by
`initDb()` presents the same `select`/`execute` surface the repositories already
use, so **no repository changed**.

### Crypto backend (Windows host constraint)

The spike found the host had no perl/nasm/OpenSSL-dev. Key results:

- **nasm is NOT required** — `openssl-src` auto-falls-back to `no-asm VC-WIN64A`.
- **A complete Perl IS required** — Git's bundled perl is too stripped-down
  (missing `Params::Check`/`IPC::Cmd`); that was the *only* build blocker.

Decision (user-approved): use `rusqlite` with `bundled-sqlcipher-vendored-openssl`
(real, battle-tested SQLCipher; minimal new Rust) and install **Strawberry Perl**
system-wide. `tauri-plugin-sql` stays installed (so existing test mocks resolve)
but the app DB no longer flows through it; `libsqlite3-sys` unifies sqlx's
`bundled` with rusqlite's `bundled-sqlcipher` (a strict superset), one SQLCipher
build links once.

## Components

| Piece | File |
|---|---|
| Native vault commands + AppHandle-free helpers | `src-tauri/src/commands/vault.rs` |
| Registration (state + handler) | `src-tauri/src/lib.rs`, `commands/mod.rs`, `Cargo.toml` |
| Keyed bootstrap (passphrase → key → migrate) | `src/lib/storage/db.ts` |
| First-run / unlock gate | `src/components/vault/VaultGate.tsx`, wired in `src/app/page.tsx` |

## Data flow (desktop)

1. `VaultGate` mounts → (Tauri only) calls `initDb()`.
2. `initDb` reads `vault-passphrase` from the keychain; on first run it generates
   a 256-bit base64url passphrase and stores it (keychain only — never the DB).
3. `invoke('vault_open', { filename, passphrase })` opens the file and runs
   `PRAGMA key` **as the first statement**, then verifies via a `sqlite_master`
   read (wrong key → error, not silent corruption).
4. Migrations run through `vault_execute`; the cached handle is returned.
5. `VaultGate` renders the app once ready; on failure it hard-blocks with a retry.

In **web mode** (no Tauri) the gate renders the shell directly — matching the
app's existing "swallow native errors" behavior and keeping web-mode E2E working.

## Security properties (covered by tests)

- A fresh DB is unreadable by an unkeyed/wrong-key client (`open_keyed` verifies).
- The on-disk file lacks the plaintext `SQLite format 3\0` header and does not
  contain inserted plaintext verbatim.
- The passphrase lives only in the OS keychain; the DB stores no secret.

## Testing

- **Rust** (`cargo test`, AppHandle-free): keyed round-trip, NULL handling,
  unkeyed-cannot-read, raw-bytes-not-plaintext. (`MockRuntime` stays unused — it
  breaks `cargo test` on this host.)
- **TS** (`vitest`): `db.test.ts` (passphrase create/reuse, key-before-migrate
  ordering, caching, retry-on-failure, forwarding); `VaultGate.test.tsx`
  (web-mode passthrough, desktop unlock, first-run copy, error+retry);
  `storage.test.ts` / `ModelList.test.tsx` updated to the new boundary.

## Build requirement (Windows)

`cargo build` now compiles OpenSSL + SQLCipher from source and needs a complete
**Perl on PATH** (Strawberry — installed). nasm is not needed. Clean builds are a
few minutes slower as a result. CI Linux has perl natively.
