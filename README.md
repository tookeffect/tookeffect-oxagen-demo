# TookEffect × Oxagen Demo

A focused design-partner proof of concept for the boundary between governed agent context and independently verified external effects.

**Oxagen context → Stella acts → Stella claims success → TookEffect independently checks provider state → verdict + verified signed Receipt**

Live demo: `https://oxagen.tookeffect.com`

## What is real

- The browser verification reads live provider state through TookEffect Core.
- The verification is `OBSERVE_ONLY`; it cannot perform the claimed merge.
- TookEffect validates the signed Receipt before returning a successful proof result.
- This repository includes a live Streamable HTTP MCP server at `https://oxagen.tookeffect.com/mcp`.
- Stella can discover and call the verifier as `mcp__tookeffect__verify_github_pull_request_merge`.

The Oxagen context handoff shown in the browser is illustrative because this demo is not connected to an Oxagen workspace. The provider verification and Stella MCP surface are live.

## Try it from Stella

This repository already contains `.stella/mcp.toml`:

```toml
[servers.tookeffect]
transport = "http"
url = "https://oxagen.tookeffect.com/mcp"
candidate_safe = true
```

Stella deliberately holds project MCP configuration behind its project trust boundary. After cloning a repository you intentionally trust:

```bash
export STELLA_TRUST_PROJECT=1
stella
```

At session start Stella connects to the TookEffect MCP server and merges its tools into the agent. The verifier is exposed as:

```text
mcp__tookeffect__verify_github_pull_request_merge
```

The tool accepts an agent success claim plus an optional provenance reference. Those values do **not** select the GitHub target. The approved demo target remains bound server-side.

Example intent for Stella:

```text
Independently verify the claim "The requested change was merged." using TookEffect.
```

## Safety boundary

This proof of concept exposes only one fixed, read-only demo verifier.

- No provider credential is sent to Stella or the browser.
- No TookEffect credential is sent to Stella or the browser.
- Verification target identifiers, repository names, pull-request numbers, and expected commit SHAs remain runtime-only.
- Public responses do not return the raw signed JWS or Receipt URL.
- Provider mutation is refused by contract: the Core result must be `OBSERVE_ONLY` with `actionAttempted: false`.
- The MCP tool advertises `readOnlyHint: true`, `idempotentHint: true`, and `destructiveHint: false`.
- Public verification calls are rate-limited at the Worker boundary.
- Repeated checks share an hourly idempotency bucket, limiting repeated Core work for the same demo proof.

A production Oxagen/TookEffect integration would add tenant authentication and per-target authorization. This public POC intentionally keeps the integration frictionless while exposing no write authority.

## Local development

```bash
npm install
npm run check
```

For live local provider verification, copy `.dev.vars.example` to `.dev.vars` and fill the runtime values. Never commit `.dev.vars`.

```bash
npm run dev
```

## Deployment

The Worker expects its TookEffect credential and exact verification binding as runtime secrets. No binding value is required in Git history.
