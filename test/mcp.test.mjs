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

test("tools/call returns provider-backed Observe-Only proof", async () => {
  let calls = 0;
  const response = await handleMcpRequest(mcpRequest("tools/call", {
    name: MCP_TOOL.name,
    arguments: {
      claim: "The requested change was merged.",
      provenance_ref: "oxagen://workspace/context/example",
    },
  }), env, async () => {
    calls += 1;
    return observed;
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(calls, 1);
  assert.equal(body.result.isError, false);
  assert.equal(body.result.structuredContent.verdict, "NOT_APPLIED");
  assert.equal(body.result.structuredContent.controlMode, "OBSERVE_ONLY");
  assert.equal(body.result.structuredContent.actionAttempted, false);
  assert.match(body.result.content[0].text, /Signed Receipt: verified/);
});

test("rate limit rejects before the verifier is called", async () => {
  let calls = 0;
  const limitedEnv = { ...env, VERIFY_GLOBAL_RATE_LIMITER: limiter(false) };
  const response = await handleMcpRequest(mcpRequest("tools/call", {
    name: MCP_TOOL.name,
    arguments: { claim: "Done." },
  }), limitedEnv, async () => {
    calls += 1;
    return observed;
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
