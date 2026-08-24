import assert from "node:assert/strict";
import test from "node:test";
import {
  MCP_TOOL,
  handleMcpRequest,
  mcpPublicInfo,
  takeVerificationBudget,
} from "../src/mcp.ts";

function limiter(success = true) {
  return { limit: async () => ({ success }) };
}

const env = {
  CORE_BASE_URL: "https://tookeffect.com",
  CORE_AGENT_VERIFY_TOKEN: "example-token",
  VERIFICATION_TARGET_ID: "11111111-1111-4111-8111-111111111111",
  VERIFICATION_OWNER: "example-org",
  VERIFICATION_REPO: "authorized-demo",
  VERIFICATION_PULL_NUMBER: "7",
  VERIFICATION_EXPECTED_HEAD_SHA: "a".repeat(40),
  VERIFICATION_EXPECTED_BASE: "main",
  VERIFY_ACTOR_RATE_LIMITER: limiter(),
  VERIFY_GLOBAL_RATE_LIMITER: limiter(),
};

const observed = {
  status: "completed",
  verdict: "NOT_APPLIED",
  controlMode: "OBSERVE_ONLY",
  actionAttempted: false,
  providerReadback: "live",
  receipt: {
    issued: true,
    signatureVerified: true,
    evidenceDigest: "b".repeat(64),
    mode: "jws-ed25519",
    keyId: "receipt-key-1",
  },
};

const grantedObserved = {
  ...observed,
  partner: {
    mode: "your-github",
    provider: "github",
    repository: "mac/demo",
    pullNumber: 12,
    expectedHeadSha: "c".repeat(40),
    expectedBase: "main",
    githubUrl: "https://github.com/mac/demo/pull/12",
    expiresAt: "2030-01-01T00:00:00.000Z",
    stellaAgent: "Stella · Oxagen demo",
  },
  observation: {
    ok: true,
    merged: false,
    commitOnBase: false,
    headSha: "c".repeat(40),
    baseRef: "main",
    exactHead: true,
    exactBase: true,
    observedAt: "2026-08-24T16:00:00.000Z",
  },
};

const partnerGrant = "oxg1.abcdefghijklmnopqrstuv.abcdefghijklmnopqrstuvwxyz0123456789_-";

function mcpRequest(method, params = {}, id = 1, headers = {}) {
  return new Request("https://oxagen.tookeffect.com/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
}

test("public MCP metadata exposes the Stella wire name but no target binding", () => {
  const info = mcpPublicInfo();
  assert.equal(info.enabled, true);
  assert.equal(info.readOnly, true);
  assert.equal(info.transport, "streamable-http");
  assert.equal(info.authentication, "optional-scoped-bearer");
  assert.equal(info.stellaToolName, "mcp__tookeffect__verify_github_pull_request_merge");
  const serialized = JSON.stringify(info);
  for (const hidden of [env.VERIFICATION_TARGET_ID, env.VERIFICATION_REPO, env.VERIFICATION_EXPECTED_HEAD_SHA]) {
    assert.equal(serialized.includes(hidden), false);
  }
});

test("tool advertises a narrow read-only and idempotent contract", () => {
  assert.equal(MCP_TOOL.name, "verify_github_pull_request_merge");
  assert.equal(MCP_TOOL.annotations.readOnlyHint, true);
  assert.equal(MCP_TOOL.annotations.idempotentHint, true);
  assert.equal(MCP_TOOL.annotations.destructiveHint, false);
  assert.deepEqual(MCP_TOOL.inputSchema.required, ["claim"]);
});

test("Stella-compatible initialize and tools/list handshake succeeds", async () => {
  const init = await handleMcpRequest(mcpRequest("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "stella", version: "test" },
  }), env, async () => observed);
  assert.equal(init.status, 200);
  const initBody = await init.json();
  assert.equal(initBody.result.protocolVersion, "2025-06-18");
  assert.equal(initBody.result.serverInfo.name, "tookeffect-oxagen-verifier");

  const list = await handleMcpRequest(mcpRequest("tools/list"), env, async () => observed);
  const listBody = await list.json();
  assert.equal(listBody.result.tools.length, 1);
  assert.equal(listBody.result.tools[0].name, MCP_TOOL.name);
});

test("public tools/call returns provider-backed Observe-Only proof", async () => {
  let publicCalls = 0;
  let grantedCalls = 0;
  const response = await handleMcpRequest(mcpRequest("tools/call", {
    name: MCP_TOOL.name,
    arguments: {
      claim: "The requested change was merged.",
      provenance_ref: "oxagen://workspace/context/example",
    },
  }), env, async () => {
    publicCalls += 1;
    return observed;
  }, async () => {
    grantedCalls += 1;
    return grantedObserved;
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(publicCalls, 1);
  assert.equal(grantedCalls, 0);
  assert.equal(body.result.isError, false);
  assert.equal(body.result.structuredContent.verdict, "NOT_APPLIED");
  assert.equal(body.result.structuredContent.controlMode, "OBSERVE_ONLY");
  assert.equal(body.result.structuredContent.actionAttempted, false);
  assert.match(body.result.content[0].text, /Signed Receipt: verified/);
});

test("bearer grant routes Stella to the authorized user GitHub verifier", async () => {
  let publicCalls = 0;
  let grantedCalls = 0;
  let receivedGrant = "";
  const response = await handleMcpRequest(mcpRequest("tools/call", {
    name: MCP_TOOL.name,
    arguments: { claim: "The requested change was merged." },
  }, 9, { authorization: `Bearer ${partnerGrant}` }), env, async () => {
    publicCalls += 1;
    return observed;
  }, async (_env, grant) => {
    grantedCalls += 1;
    receivedGrant = grant;
    return grantedObserved;
  });
  const body = await response.json();
  assert.equal(publicCalls, 0);
  assert.equal(grantedCalls, 1);
  assert.equal(receivedGrant, partnerGrant);
  assert.equal(body.result.structuredContent.partner.repository, "mac/demo");
  assert.equal(body.result.structuredContent.observation.merged, false);
  assert.match(body.result.content[0].text, /Authoritative state: https:\/\/github.com\/mac\/demo\/pull\/12/);
  assert.equal(JSON.stringify(body).includes(partnerGrant), false);
});

test("invalid bearer never falls back to the public fixture", async () => {
  let publicCalls = 0;
  let grantedCalls = 0;
  const response = await handleMcpRequest(mcpRequest("tools/call", {
    name: MCP_TOOL.name,
    arguments: { claim: "Done." },
  }, 1, { authorization: "Bearer definitely-not-a-grant" }), env, async () => {
    publicCalls += 1;
    return observed;
  }, async () => {
    grantedCalls += 1;
    return grantedObserved;
  });
  const body = await response.json();
  assert.equal(publicCalls, 0);
  assert.equal(grantedCalls, 0);
  assert.equal(body.error.message, "partner_grant_invalid");
});

test("rate limit rejects before either verifier is called", async () => {
  let calls = 0;
  const limitedEnv = { ...env, VERIFY_GLOBAL_RATE_LIMITER: limiter(false) };
  const response = await handleMcpRequest(mcpRequest("tools/call", {
    name: MCP_TOOL.name,
    arguments: { claim: "Done." },
  }), limitedEnv, async () => {
    calls += 1;
    return observed;
  }, async () => {
    calls += 1;
    return grantedObserved;
  });
  const body = await response.json();
  assert.equal(calls, 0);
  assert.equal(body.error.code, -32029);
});

test("rate limit bindings fail closed when missing", async () => {
  await assert.rejects(() => takeVerificationBudget(new Request("https://example.com"), {}, "web"), /rate_limiter_unconfigured/);
});

test("MCP rejects a foreign browser Origin", async () => {
  const response = await handleMcpRequest(
    mcpRequest("tools/list", {}, 1, { origin: "https://evil.example" }),
    env,
    async () => observed,
  );
  assert.equal(response.status, 403);
});
