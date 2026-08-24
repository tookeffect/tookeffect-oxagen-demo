import assert from "node:assert/strict";
import test from "node:test";
import {
  demoIdempotencyKey,
  demoInfo,
  loadBinding,
  validateCoreResult,
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

test("durable verification requests reuse an hourly idempotency bucket", () => {
  assert.equal(demoIdempotencyKey(0), "oxagen-partner-demo-0");
  assert.equal(demoIdempotencyKey(3_599_999), "oxagen-partner-demo-0");
  assert.equal(demoIdempotencyKey(3_600_000), "oxagen-partner-demo-1");
});

test("Core result validation accepts only Observe-Only completed evidence", () => {
  const valid = {
    effectId: "22222222-2222-4222-8222-222222222222",
    status: "completed",
    verdict: "NOT_APPLIED",
    actionAttempted: false,
    controlMode: "OBSERVE_ONLY",
    receipt: {
      url: "https://tookeffect.com/api/v1/receipts/22222222-2222-4222-8222-222222222222",
      evidenceDigest: "b".repeat(64),
      signature: "e30.e30.e30",
      mode: "jws-ed25519",
      keyId: "receipt-key-1",
      jwksUrl: "https://tookeffect.com/api/v1/receipt-keys",
    },
  };
  assert.equal(validateCoreResult(valid).verdict, "NOT_APPLIED");
  assert.throws(() => validateCoreResult({ ...valid, actionAttempted: true }));
  assert.throws(() => validateCoreResult({ ...valid, controlMode: "EXECUTE" }));
  assert.throws(() => validateCoreResult({ ...valid, status: "pending" }));
});
