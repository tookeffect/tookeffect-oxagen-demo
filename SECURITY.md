# Security

This repository is intentionally limited to a read-only partner demo.

## Boundaries

- Provider execution is outside the demo.
- Verification bindings and credentials are runtime-only.
- Public API responses do not return the configured target, repository, pull-request number, commit SHA, access token, or raw signed payload.
- TookEffect verification must report `OBSERVE_ONLY` and `actionAttempted: false` or the demo fails closed.
- The Worker verifies the Receipt signature against TookEffect's public Ed25519 key set before displaying a successful verification result.

## Reporting

Please report security concerns privately through the TookEffect support channel rather than opening a public issue with sensitive details.
