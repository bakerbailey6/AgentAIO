---
name: add-llm-provider
description: Use when adding or onboarding a new LLM vendor (Google Gemini, Groq, Mistral, DeepSeek, LM Studio, an OpenAI-compatible endpoint, …) to Agent Command Center so its models appear in the settings model picker. Covers the provider class, PROVIDER_REGISTRY registration, the two settings display-name maps, and the exhaustive provider registry test.
---

# Add an LLM provider

## Overview

LLM vendors are a pluggable registry: each implements `LLMProvider` (`src/lib/interfaces/llm-provider.ts`)
and is registered in `PROVIDER_REGISTRY` (`src/lib/llm/providers/index.ts`). The `LLMRouter`
(`src/lib/llm/router.ts`) resolves a stored model → its keychain key → the provider → a Vercel AI SDK
`LanguageModel` adapter. Adding a vendor is *additive* — but four non-obvious spots outside the provider
file must be touched or you ship a green-looking change that breaks an unrelated test or mis-persists
credentials.

## When to use

- Onboarding any new model vendor so users can pick its models.
- Symptoms you're in scope: "add Gemini/Groq/Mistral support", "wire up a new model provider",
  "support an OpenAI-compatible endpoint".

## Step 0 — decide the backing SDK (do this first)

- **OpenAI-compatible vendor** (Groq, Together, Mistral, DeepSeek, LM Studio, anything with an OpenAI
  `/v1` API): **no new dependency.** Two in-repo patterns:
  - *needs an API key* (Groq, Together, Mistral, DeepSeek): simplest is the existing `@ai-sdk/openai`
    adapter with a `baseUrl` — see `src/lib/llm/providers/openai.ts`, whose `createAdapter` forwards
    `apiKey: credentials.apiKey` and an optional `baseURL`. (If you instead use `createOpenAICompatible`,
    you must pass `apiKey` to it too — `ollama.ts` doesn't, because Ollama needs no key.)
  - *no API key, local server* (LM Studio, Ollama-style): `@ai-sdk/openai-compatible`
    (`createOpenAICompatible`) — see `src/lib/llm/providers/ollama.ts`.
- **Native-SDK vendor** (e.g. Google Gemini → `@ai-sdk/google`): add the package to `dependencies` in
  `package.json` and `npm install` it. The worktree has no `node_modules`, so this must actually be
  installed before tests/build resolve.

## Recipe

1. **Create `src/lib/llm/providers/<vendor>.ts`.** Export `interface <Vendor>Model extends BaseModel
   { provider: '<vendor>' }` and `export class <Vendor>Provider implements LLMProvider<<Vendor>Model>`.
   Set `readonly providerId = '<vendor>'` (lowercase — it's the registry key, the `models.provider`
   column, and the keychain ref stem) and `readonly displayName`. Add a top JSDoc block like
   `anthropic.ts`/`ollama.ts`.
   - `listModels(credentials)` — a curated static array (cloud vendors, like `anthropic.ts`) **or** a
     real `fetch` (local servers, like `ollama.ts`). If you fetch, **throw on failure — never return
     `[]`** (an unreachable server must differ from "zero models"; the Ollama tests assert the throw).
     For a static list, name the param `_credentials` to satisfy lint.
   - `createAdapter(model, credentials)` — call the SDK factory with `credentials.apiKey` (and
     `credentials.baseUrl` → `baseURL` if relevant), then `return factory(model.id) as LanguageModel`
     (the `as LanguageModel` cast is the established bridge).
   - `testConnection(credentials)` — `const start = Date.now()`, then `try` → `{ success: true,
     latencyMs: Date.now() - start }`, `catch (e)` → `{ success: false, error: String(e) }`. Cloud
     vendors probe by awaiting their own `listModels`; network vendors probe the real endpoint.
2. **Register it** in `src/lib/llm/providers/index.ts`: `import { <Vendor>Provider } from './<vendor>'`
   and add `['<vendor>', new <Vendor>Provider()]` to the `PROVIDER_REGISTRY` Map.
3. **Add the display name in BOTH settings maps** (they each carry their own copy):
   - `PROVIDER_DISPLAY_NAMES` in `src/components/settings/AddProviderForm.tsx`
   - `providerDisplayNames` in `src/components/settings/AddModelDialog.tsx`
   The dropdowns auto-populate from `PROVIDER_REGISTRY.keys()`, but without the map entry they show the
   raw id.
4. **If the vendor uses a `baseUrl` and no API key** (like Ollama): generalize the hardcoded
   `isOllama` / `selectedProvider === 'ollama'` branches in those two components (credential shape,
   and `apiKeyRef` vs `baseUrl` on `repo.create`). An apiKey vendor needs no UI branch change.
5. **Write `src/lib/llm/providers/__tests__/<vendor>.test.ts`** (see Testing).
6. **Update the exhaustive registry test** `src/lib/llm/providers/__tests__/index.test.ts`: it asserts
   `[...PROVIDER_REGISTRY.keys()].sort()).toEqual([...])` (currently `['anthropic','ollama','openai']`).
   Add your id (and ideally a `toBeInstanceOf` check). **Skipping this breaks that test file even
   though it's "unrelated" to your provider.**
7. **Verify:** `npm test` — your provider tests + the registry test pass.

## Conventions

- `providerId` is lowercase and is the single source of truth (registry key + `models.provider` +
  keychain ref stem `providerId + '-key'`).
- The provider-specific `<Vendor>Model` narrows `provider` to the literal.
- Import interface types from `@/lib/interfaces` (the barrel), not the individual file.
- `LLMRouter.getAdapter` hardcodes `contextWindow: 200000, supportsTools: true, supportsStreaming:
  true` when building the adapter — per-model capability flags only inform the UI, not the adapter.

## Common mistakes

| Mistake | Consequence |
|---|---|
| Forgot the `index.test.ts` key array | An "unrelated" test file fails red |
| Updated only one display-name map | Dropdown shows the raw id in the other dialog |
| `baseUrl` vendor left on the apiKey branch | Credential mis-persisted (`apiKeyRef` set, `baseUrl` null) |
| `listModels` returns `[]` on fetch error | Unreachable server looks like "zero models"; tests fail |
| Added a native SDK but didn't `npm install` | Imports unresolved at test/build time |

## Testing

Vitest, colocated. `vi.mock` the backing `@ai-sdk/*` package at module top, e.g.
`vi.mock('@ai-sdk/<pkg>', () => ({ create<X>: vi.fn(() => vi.fn((id) => ({ modelId: id }))) }))`, then
`beforeEach(() => vi.clearAllMocks())`. Cover: identity (`providerId`/`displayName`), `listModels`
shape + exact id list, `createAdapter` calls the factory with the right args, `testConnection` success
and failure. Templates: `src/lib/llm/providers/__tests__/anthropic.test.ts` (static list) and
`ollama.test.ts` (fetch + throw-on-unreachable).
