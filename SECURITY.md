# Security

This repository is intentionally limited to a read-only partner proof of concept.

## Boundaries

- Provider execution is outside the demo.
- Verification bindings and credentials are runtime-only.
- Public browser and MCP responses do not return the configured target, repository, pull-request number, commit SHA, TookEffect credential, raw signed JWS, or Receipt URL.
- TookEffect verification must report `OBSERVE_ONLY` and `actionAttempted: false` or the demo fails closed.
- The Worker verifies the Receipt signature against TookEffect's public Ed25519 key set before returning a successful proof result.
- The public MCP server exposes one fixed verification tool only. Caller arguments cannot select or replace its provider target.
- The MCP tool advertises read-only/idempotent annotations and no destructive capability.
- Browser and MCP verification calls pass through per-actor and aggregate Cloudflare Worker rate-limit bindings.
- Repeated verification requests share an hourly idempotency bucket at the TookEffect boundary.
- The MCP endpoint rejects a foreign browser `Origin` and accepts JSON-RPC only over POST.

The public MCP endpoint is intentionally unauthenticated for this design-partner demo because it exposes no provider mutation authority and no caller-selectable target. A production multi-tenant integration must add tenant authentication and explicit per-target authorization.

## Reporting

Please report security concerns privately through the TookEffect support channel rather than opening a public issue with sensitive details.
