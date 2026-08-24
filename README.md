# TookEffect × Oxagen Demo

A design-partner proof of concept for the boundary between governed agent context and independently verified external effects.

**Oxagen context → Stella acts → Stella claims success → TookEffect independently checks provider state → verdict + verified signed Receipt**

Live demo: `https://oxagen.tookeffect.com`

## Two live modes

### Public example

The default page uses a fixed server-side TookEffect Verified Target. It demonstrates the full read-only verification path without asking the visitor to configure anything.

### Try with your GitHub

`Try with your GitHub` sends the visitor to TookEffect's normal GitHub App authorization flow. The visitor explicitly chooses an authorized repository and PR. TookEffect then issues a one-hour encrypted partner grant bound to:

- one TookEffect Workspace,
- one active GitHub Verified Target,
- one pull request,
- the PR's exact head SHA and base branch,
- one managed `Stella · Oxagen demo` Agent with `effects:verify` only.

The grant is returned in the URL fragment, moved into `sessionStorage`, and immediately removed from the visible URL. It becomes invalid when it expires or when the relevant GitHub target, Workspace membership, Workspace, or managed Agent is revoked.

The demo never receives a GitHub credential, installation token, internal TookEffect Target ID, Workspace ID, or account ID.

## What is real

- Browser verification reads live GitHub state through the TookEffect Core.
- The verification is `OBSERVE_ONLY`; it cannot perform the claimed merge.
- The result shows expected state versus authoritative observed GitHub state.
- In personal mode the visitor gets a direct link to the exact GitHub PR being verified.
- TookEffect validates the signed Receipt before showing a successful proof result.
- The Streamable HTTP MCP server is live at `https://oxagen.tookeffect.com/mcp`.
- Stella discovers the verifier as `mcp__tookeffect__verify_github_pull_request_merge`.

The Oxagen context handoff shown in the browser remains illustrative because this POC is not connected to an Oxagen workspace. Provider read-back, Receipt verification, and Stella MCP are live.

## Stella — public example

The repository contains `.stella/mcp.toml`:

```toml
[servers.tookeffect]
transport = "http"
url = "https://oxagen.tookeffect.com/mcp"
candidate_safe = true
```

After intentionally trusting the project:

```bash
export STELLA_TRUST_PROJECT=1
stella
```

## Stella — your GitHub

After `Try with your GitHub`, the page displays a temporary configuration with the scoped grant:

```toml
[servers.tookeffect]
transport = "http"
url = "https://oxagen.tookeffect.com/mcp"
headers = { Authorization = "Bearer <temporary-partner-grant>" }
candidate_safe = true
```

The bearer does not let Stella select a different repository or PR. Caller arguments contain only the claim and optional provenance reference; the provider binding comes from the signed/encrypted TookEffect grant.

## Safety boundary

- No GitHub token or provider credential is sent to Stella or the browser.
- No public caller can choose a TookEffect Target ID.
- Personal grants expire after one hour and are revocable through the existing TookEffect connection/Agent boundary.
- The canonical TookEffect Core verifier must return `OBSERVE_ONLY` and `actionAttempted: false`; otherwise the demo fails closed.
- The MCP tool advertises `readOnlyHint: true`, `idempotentHint: true`, and `destructiveHint: false`.
- Browser and MCP verification calls are rate-limited at the Worker boundary.
- The public example shares an hourly idempotency bucket. Personal re-checks use fresh idempotency keys so a visitor can merge their PR and immediately observe `NOT_APPLIED → APPLIED`.
- Raw signed JWS values, Core credentials, and internal target identifiers are not returned by the public demo API.

## Local development

```bash
npm install
npm run check
```

For live local public-example verification, copy `.dev.vars.example` to `.dev.vars` and fill the runtime values. Never commit `.dev.vars`.

```bash
npm run dev
```

## Deployment

The Worker expects its public-example TookEffect credential and fixed verification binding as runtime secrets. Personal GitHub grants are issued by TookEffect Core at runtime and are never stored in Git history.
