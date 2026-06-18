# Task 1: Project Scaffold

**From plan:** docs/superpowers/plans/2026-06-18-acc-phase1a-foundation.md

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`

**Interfaces:**
- Produces: running `npm run tauri dev` opens a Tauri window with Next.js app

## Global Constraints
- Node.js ≥ 20, Rust stable ≥ 1.77
- `"strict": true` in tsconfig — no implicit `any`
- Secrets go to OS Keychain exclusively — never written to SQLite, env files, or localStorage
- SQLite encrypted at rest via SQLCipher through `@tauri-apps/plugin-sql`
- Every interface uses generics so concrete implementations never require modifying the interface
- Vitest for all TypeScript unit tests; `cargo test` for Rust
- Commit after every task

## Steps

- [ ] **Step 1: Create the Tauri + Next.js project**

```bash
npm create tauri-app@latest agent-command-center -- --template next --manager npm
cd agent-command-center
npm install
```

NOTE: The scaffolded project will be created in a subdirectory `agent-command-center/`. Move all contents up to C:\Projects (the project root) after scaffolding:
```bash
# After scaffold completes:
mv agent-command-center/* C:/Projects/
mv agent-command-center/.* C:/Projects/ 2>/dev/null || true
rmdir agent-command-center
```

- [ ] **Step 2: Configure TypeScript strict mode**

Edit `tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Add Tauri SQL plugin and keyring crate**

```bash
npm install @tauri-apps/plugin-sql
cargo add keyring --manifest-path src-tauri/Cargo.toml
cargo add serde --features derive --manifest-path src-tauri/Cargo.toml
cargo add serde_json --manifest-path src-tauri/Cargo.toml
```

In `src-tauri/Cargo.toml`, ensure:
```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
keyring = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[build-dependencies]
tauri-build = { version = "2", features = [] }
```

- [ ] **Step 4: Register SQL plugin in lib.rs**

```rust
// src-tauri/src/lib.rs
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 5: Configure Tauri capabilities for SQL**

In `src-tauri/tauri.conf.json`, add to `plugins`:
```json
{
  "plugins": {
    "sql": {}
  }
}
```

- [ ] **Step 6: Install frontend dev dependencies**

```bash
npm install vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom --save-dev
npm install reactflow --save
npm install @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/openai-compatible ai --save
npm install @modelcontextprotocol/sdk --save
```

Note: install `reactflow` (not `react-flow-renderer` which is deprecated).

- [ ] **Step 7: Configure Vitest**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

Create `src/test-setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 8: Install shadcn/ui**

```bash
npx shadcn@latest init
```
Choose: TypeScript, Default style, CSS variables, `src/` directory.

- [ ] **Step 9: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: zero errors (or only Next.js generated type warnings — no user-code errors).

- [ ] **Step 10: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Tauri 2.0 + Next.js 15 project"
```

After committing, write the progress ledger:
```bash
mkdir -p "$(git rev-parse --git-path sdd 2>/dev/null || echo '.git/sdd')"
echo "Task 1: complete" > "$(git rev-parse --git-path sdd 2>/dev/null || echo '.git/sdd')/progress.md"
```
