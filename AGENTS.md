# Agents Instructions

## Cursor Cloud specific instructions

### Codebase Overview

This is **Google Gemini CLI** (`@google/gemini-cli`) — an npm workspaces monorepo with these key packages:

| Package | Path | Description |
|---|---|---|
| `@google/gemini-cli` | `packages/cli` | CLI frontend (React/Ink terminal UI) |
| `@google/gemini-cli-core` | `packages/core` | Core backend (Gemini API, tools, MCP) |
| `@google/gemini-cli-a2a-server` | `packages/a2a-server` | Experimental A2A server |
| `gemini-cli-vscode-ide-companion` | `packages/vscode-ide-companion` | VS Code extension |
| `@google/gemini-cli-test-utils` | `packages/test-utils` | Shared test utilities |

### Dependencies & Setup

- **Runtime**: Node.js >= 20 (dev recommends ~20.19.0 per CONTRIBUTING.md; >=22 also works)
- **Package manager**: npm (uses npm workspaces; lockfile is `package-lock.json`)
- **Install**: `npm ci` (or `npm install`)
- **`.npmrc`**: configures `@google` scoped packages to use `https://wombat-dressing-room.appspot.com`

### Build / Lint / Test / Run

See `CONTRIBUTING.md` and root `package.json` for the full list. Key commands:

| Task | Command |
|---|---|
| Install deps | `npm ci` |
| Build all | `npm run build` |
| Start CLI | `npm start` |
| Unit tests | `npm run test` |
| E2E tests | `npm run test:e2e` (requires `GEMINI_API_KEY`) |
| Lint | `npm run lint` |
| Format | `npm run format` |
| Type check | `npm run typecheck` |
| Full preflight | `npm run preflight` |

### Network Restrictions (Known Issue)

Cloud Agent VMs may have egress restrictions that block TLS connections to `registry.npmjs.org`. Symptoms:
- `npm ci` / `npm install` fails with `ECONNRESET` during tarball download
- Error message: `Exit handler never called!`
- Only the last 1–15 packages in the download queue fail; most downloads succeed but npm rolls back everything

**Workaround**: If `npm ci` fails, retry with `--maxsockets=1` which reduces failures to ~1 package. Multiple retries may eventually succeed if the network stabilizes. If persistent, check Network Access settings in cloud agent configuration and ensure `registry.npmjs.org` is allowed.

### Pre-commit Hooks

The repo uses **Husky** with a pre-commit hook (`.husky/pre-commit`) that runs `npm run pre-commit`. This invokes `lint-staged` which runs Prettier and ESLint on staged files.

### Environment Variables

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | API key for e2e tests and runtime |
| `GEMINI_SANDBOX` | Sandbox mode: `false` / `true` / `docker` / `podman` |
| `GOOGLE_CLOUD_PROJECT` | GCP project for Code Assist license |

### Testing Notes

- **Vitest** is the test framework. Config files: `vitest.config.ts` in each package.
- Test files are co-located with source (`*.test.ts`, `*.test.tsx`).
- Unit tests run without any API key. E2E tests require `GEMINI_API_KEY`.
- Docker/Podman is NOT required for basic dev setup (only for sandboxed execution testing).
