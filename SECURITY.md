# Security Policy

Agent Command Center runs AI agents that can read and write files, execute commands, and reach the
network. Security is a first-class design concern, not an afterthought. This document describes the
security model and how to report a vulnerability.

## Security model

- **Secrets never touch the database.** API keys and tokens are stored only in the OS keychain
  (Windows Credential Manager · macOS Keychain · libsecret), accessed through the Rust
  `set_secret` / `get_secret` / `delete_secret` commands wrapped by `src/lib/keychain.ts`. The
  database persists only a *reference* to the keychain entry (by convention `providerId + '-key'`),
  never the secret value.
- **Encrypted at rest.** The local database is a [SQLCipher](https://www.zetetic.net/sqlcipher/)
  file. A 256-bit passphrase is generated on first run and stored in the keychain under
  `vault-passphrase`. The native `vault_open` command runs `PRAGMA key` *before any migration touches
  the file*, so the database is never written unencrypted.
- **Vault unlock on launch.** `VaultGate` (`src/components/vault/VaultGate.tsx`) gates the desktop app
  on a successful unlock before rendering anything that reads data.
- **Zero-trust agents.** Every agent run carries an explicit permission scope — allowed paths,
  allowed domains, and a shell on/off flag. Coding agents (Claude Code, Codex) are additionally
  sandboxed to an assigned project directory.
- **Approval gates.** Destructive or out-of-scope actions pause and require an explicit Approve /
  Deny decision before they execute.
- **Append-only audit log.** Tool calls and approval decisions are recorded in an append-only
  `audit_log` table for after-the-fact review.

For the broader architecture, see [README.md](README.md#security-model) and
[`docs/superpowers/specs/2026-06-18-sqlcipher-vault-design.md`](docs/superpowers/specs/2026-06-18-sqlcipher-vault-design.md).

## Supported versions

The project is pre-1.0 and under active development (Phase 1). Security fixes are applied to the
latest `main`; there are no maintained back-branches yet.

| Version | Supported |
|---------|:---------:|
| `0.1.x` (latest `main`) | ✅ |
| older | ❌ |

## Reporting a vulnerability

Please report security vulnerabilities **privately** — do not open a public GitHub issue.

- Preferred: open a private report via **GitHub Security Advisories** on this repository
  (*Security → Report a vulnerability*).
- <!-- maintainer: add a security contact email here if you want a direct channel -->

Please include enough detail to reproduce the issue (affected component, steps, and impact). We aim
to acknowledge reports promptly and will coordinate a fix and disclosure timeline with you. Thank you
for helping keep users safe.
