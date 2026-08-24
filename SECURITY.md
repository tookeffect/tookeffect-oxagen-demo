# Security

This repository is intentionally limited to a read-only partner proof of concept.

## Boundaries

- Provider execution is outside the demo.
- The public-example verification binding and TookEffect credential remain runtime-only.
- Personal GitHub mode uses a one-hour TookEffect partner grant. The grant is bound by Core to one Workspace, one active Verified Target, one PR, one exact head SHA/base, and one managed `Stella · Oxagen demo` Agent with `effects:verify` only.
- The browser never receives a GitHub access token, GitHub App installation token, TookEffect Core credential, internal Target ID, Workspace ID, or account ID.
- A personal grant is delivered in the URL fragment, stored only in browser `sessionStorage`, and removed from the visible URL immediately. It is forwarded only as an Authorization bearer to this Worker/Core or to the user's local Stella MCP client.
- Grants expire automatically and fail closed when the corresponding GitHub target, Workspace, membership, or managed Agent is revoked/disabled.
- TookEffect verification must report `OBSERVE_ONLY` and `actionAttempted: false` or the demo fails closed.
- The Worker verifies the Receipt signature against TookEffect's public Ed25519 key set before returning a successful proof result.
- Personal-mode public responses may intentionally return the user-authorized repository name, PR number, expected head/base, direct GitHub PR URL, and sanitized authoritative observation so the user can independently audit the result. They do not return internal TookEffect identifiers or raw signed JWS values.
- Caller arguments cannot select or replace the provider target in either public-example or personal mode.
- The MCP tool advertises read-only/idempotent annotations and no destructive capability.
- Browser and MCP verification calls pass through per-actor and aggregate Cloudflare Worker rate-limit bindings.
- Public-example checks share an hourly idempotency bucket. Personal-mode checks use fresh idempotency keys so a user can change the real provider state and immediately re-check it.
- The MCP endpoint rejects a foreign browser `Origin` and accepts JSON-RPC only over POST.

The public example remains unauthenticated because it is fixed and read-only. Personal mode requires the short-lived TookEffect grant. A production multi-tenant integration should replace the POC grant flow with durable tenant authentication while preserving explicit per-target authorization.

## Reporting

Please report security concerns privately through the TookEffect support channel rather than opening a public issue with sensitive details.
