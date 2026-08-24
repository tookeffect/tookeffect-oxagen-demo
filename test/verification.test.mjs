import assert from "node:assert/strict";
import test from "node:test";
import {
  demoIdempotencyKey,
  demoInfo,
  isPartnerGrant,
  loadBinding,
  validateCoreResult,
  validatePartnerSession,
} from "../src/verification.ts";

const env = {
  CORE_BASE_URL: "https://tookeffect.com",
  CORE_AGENT_VERIFY_TOKEN: "te_live_example_only",
  VERIFICATION_TARGET_ID: "11111111-1111-4111-8111-111111111111",
  VERIFICATION_OWNER: "example-org",
  VERIFICATION_REPO: "authorized-demo",
  VERIFICATION_PULL_NUMBER: "7",
  VERIFICATION_EXPECTED_HEAD_SHA: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  VERIFICATION_EXPECTED_BASE: "main",
};

const partner = {
  mode: "your-github",
  provider: "github",
  repository: "mac/demo",
  pullNumber: 12,
  expectedHeadSha: "c".repeat(40),
  expectedBase: "main",
  githubUrl: "https://github.com/mac/demo/pull/12",
  expiresAt: "2030-01-01T00:00:00.000Z",
  stellaAgent: "Stella · Oxagen demo",
};

const valid = {
  effectId: "22222222-2222-4222-8222-222222222222",
  status: "completed",
  verdict: "NOT_APPLIED",
  actionAttempted: false,
  controlMode: "OBSERVE_ONLY",
  evidence: {
    observation: {
      ok: true,
      merged: false,
      commitOnBase: false,
      headSha: "c".repeat(40),
      baseRef: "main",
      baseHeadSha: "d".repeat(40),
      mergeCommitSha: "",
      compareStatus: "behind",
      exactHead: true,
      exactBase: true,
      observedAt: "2026-08-24T16:00:00.000Z",
    },
  },
  receipt: {
    url: "https://tookeffect.com/api/v1/receipts/22222222-2222-4222-8222-222222222222",
    evidenceDigest: "b".repeat(64),
    signature: "e30.e30.e30",
    mode: "jws-ed25519",
    keyId: "receipt-key-1",
    jwksUrl: "https://tookeffect.com/api/v1/receipt-keys",
  },
};

test("public demo info never exposes runtime verification bindings", () => {
  const info = demoInfo(env);
  assert.equal(info.enabled, true);
  assert.equal(info.observeOnly, true);
  assert.equal(info.providerVerification, "live");
  const serialized = JSON.stringify(info);
  for (const secretValue of [
    env.CORE_AGENT_VERIFY_TOKEN,
    env.VERIFICATION_TARGET_ID,
    env.VERIFICATION_OWNER,
    env.VERIFICATION_REPO,
    env.VERIFICATION_PULL_NUMBER,
    env.VERIFICATION_EXPECTED_HEAD_SHA,
  ]) {
    assert.equal(serialized.includes(secretValue), false);
  }
});

test("binding parsing is exact and fail-closed", () => {
  assert.deepEqual(loadBinding(env), {
    targetId: env.VERIFICATION_TARGET_ID,
    owner: env.VERIFICATION_OWNER,
    repo: env.VERIFICATION_REPO,
    pullNumber: 7,
    expectedHeadSha: env.VERIFICATION_EXPECTED_HEAD_SHA,
    expectedBase: "main",
  });
  assert.throws(() => loadBinding({ ...env, VERIFICATION_EXPECTED_HEAD_SHA: "short" }));
  assert.throws(() => loadBinding({ ...env, VERIFICATION_PULL_NUMBER: "0" }));
});

test("durable public-example verification reuses an hourly idempotency bucket", () => {
  assert.equal(demoIdempotencyKey(0), "oxagen-partner-demo-0");
  assert.equal(demoIdempotencyKey(3_599_999), "oxagen-partner-demo-0");
  assert.equal(demoIdempotencyKey(3_600_000), "oxagen-partner-demo-1");
});

test("partner grant shape is narrow", () => {
  assert.equal(isPartnerGrant("oxg1.abc.def"), true);
  assert.equal(isPartnerGrant("plain-token"), false);
  assert.equal(isPartnerGrant("oxg1.abc.def.extra"), false);
});

test("partner session exposes user-verifiable GitHub state but no internal IDs", () => {
  const session = validatePartnerSession({ active: true, ...partner });
  assert.equal(session.repository, "mac/demo");
  assert.equal(session.githubUrl, "https://github.com/mac/demo/pull/12");
  const serialized = JSON.stringify(session);
  assert.equal(serialized.includes("targetId"), false);
  assert.equal(serialized.includes("workspaceId"), false);
  assert.throws(() => validatePartnerSession({ active: true, ...partner, githubUrl: "https://evil.example/mac/demo/pull/12" }));
  assert.throws(() => validatePartnerSession({ active: true, ...partner, pullNumber: 13 }));
});

test("Core result validation accepts only Observe-Only completed evidence", () => {
  assert.equal(validateCoreResult(valid).verdict, "NOT_APPLIED");
  assert.throws(() => validateCoreResult({ ...valid, actionAttempted: true }));
  assert.throws(() => validateCoreResult({ ...valid, controlMode: "EXECUTE" }));
  assert.throws(() => validateCoreResult({ ...valid, status: "pending" }));
});

test("partner verification requires a valid partner summary", () => {
  const result = validateCoreResult({ ...valid, partner }, true);
  assert.equal(result.partner.repository, "mac/demo");
  assert.equal(result.partner.expectedHeadSha, "c".repeat(40));
  assert.throws(() => validateCoreResult(valid, true), /partner_summary_missing/);
  assert.throws(() => validateCoreResult({ ...valid, partner: { ...partner, repository: "bad/value/extra" } }, true));
});
