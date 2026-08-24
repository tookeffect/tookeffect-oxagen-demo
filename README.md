# TookEffect × Oxagen Demo

A focused design-partner demo for the boundary between governed agent context and independently verified external effects.

The demo shows one simple flow:

**Oxagen / Stella context → agent action claim → TookEffect independent provider read-back → verdict + verified signed Receipt**

## What this repository contains

- A standalone Cloudflare Worker.
- One partner-facing demo page.
- A read-only verification proxy to TookEffect Core.
- Server-side verification of the Receipt signature before a result is shown to the browser.

## What this repository does not contain

- Provider credentials.
- TookEffect credentials.
- Verification target identifiers.
- Verification resource names, pull-request numbers, or commit SHAs.
- Provider mutation or execution authority.

All verification bindings are supplied at runtime and remain server-side.

## Safety boundary

The demo calls only TookEffect's Observe-Only GitHub verification capability. It cannot merge, close, approve, or otherwise mutate a pull request. If authoritative evidence is insufficient, the verification remains `AMBIGUOUS` rather than inferring success.

## Local development

Install dependencies:

```bash
npm install
```

Run the verification, type, and build checks:

```bash
npm run check
```

For a live local verification, copy `.dev.vars.example` to `.dev.vars` and fill the runtime values. Never commit `.dev.vars`.

Run locally:

```bash
npm run dev
```

## Deployment

The Worker expects its TookEffect credential and exact verification binding as runtime secrets. No binding value is required in Git history.
