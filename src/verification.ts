const CORE_VERIFY_PATH = "/api/v1/effects/github/verify-pull-request-merge";
const CORE_KEYS_PATH = "/api/v1/receipt-keys";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_SHA = /^[0-9a-f]{40,64}$/i;
const HEX_DIGEST = /^[0-9a-f]{64}$/i;
const COMPACT_JWS = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const SAFE_SLUG = /^[A-Za-z0-9_.-]{1,160}$/;

export type VerificationEnv = {
  CORE_BASE_URL: string;
  CORE_AGENT_VERIFY_TOKEN?: string;
  VERIFICATION_TARGET_ID?: string;
  VERIFICATION_OWNER?: string;
  VERIFICATION_REPO?: string;
  VERIFICATION_PULL_NUMBER?: string;
  VERIFICATION_EXPECTED_HEAD_SHA?: string;
  VERIFICATION_EXPECTED_BASE?: string;
};

export type DemoInfo = {
  enabled: boolean;
  observeOnly: true;
  handoff: "example";
  providerVerification: "live";
  effect: "github.pull_request_merge";
  resource: "authorized_demo_change";
  expectedOutcome: "merged";
  agentClaim: string;
};

export type DemoVerificationResult = {
  status: "completed";
  verdict: "APPLIED" | "NOT_APPLIED" | "AMBIGUOUS";
  controlMode: "OBSERVE_ONLY";
  actionAttempted: false;
  providerReadback: "live";
  receipt: {
    issued: true;
    signatureVerified: true;
    evidenceDigest: string;
    mode: string;
    keyId: string;
  };
};

type Binding = {
  targetId: string;
  owner: string;
  repo: string;
  pullNumber: number;
  expectedHeadSha: string;
  expectedBase: string;
};

type RawReceipt = {
  url: string;
  evidenceDigest: string;
  signature: string;
  mode: string;
  keyId: string;
  jwksUrl: string;
};

type RawCoreResult = {
  effectId: string;
  status: "completed";
  verdict: "APPLIED" | "NOT_APPLIED" | "AMBIGUOUS";
  actionAttempted: false;
  controlMode: "OBSERVE_ONLY";
  receipt: RawReceipt;
};

type JsonRecord = Record<string, unknown>;

export function demoInfo(env: VerificationEnv): DemoInfo {
  return {
    enabled: bindingConfigured(env),
    observeOnly: true,
    handoff: "example",
    providerVerification: "live",
    effect: "github.pull_request_merge",
    resource: "authorized_demo_change",
    expectedOutcome: "merged",
    agentClaim: "The requested change was merged.",
  };
}

export function bindingConfigured(env: VerificationEnv): boolean {
  try {
    loadBinding(env);
    return Boolean(env.CORE_AGENT_VERIFY_TOKEN);
  } catch {
    return false;
  }
}

export function loadBinding(env: VerificationEnv): Binding {
  const targetId = clean(env.VERIFICATION_TARGET_ID);
  const owner = clean(env.VERIFICATION_OWNER);
  const repo = clean(env.VERIFICATION_REPO);
  const pullNumber = Number(clean(env.VERIFICATION_PULL_NUMBER));
  const expectedHeadSha = clean(env.VERIFICATION_EXPECTED_HEAD_SHA).toLowerCase();
  const expectedBase = clean(env.VERIFICATION_EXPECTED_BASE) || "main";

  if (
    !UUID.test(targetId)
    || !SAFE_SLUG.test(owner)
    || !SAFE_SLUG.test(repo)
    || !Number.isSafeInteger(pullNumber)
    || pullNumber < 1
    || !HEX_SHA.test(expectedHeadSha)
    || !SAFE_SLUG.test(expectedBase)
  ) {
    throw new Error("verification_binding_invalid");
  }

  return { targetId, owner, repo, pullNumber, expectedHeadSha, expectedBase };
}

export function demoIdempotencyKey(now = Date.now()): string {
  return `oxagen-partner-demo-${Math.floor(now / 3_600_000)}`;
}

export async function verifyLiveOutcome(
  env: VerificationEnv,
  options: {
    fetchImpl?: typeof fetch;
    now?: number;
    requestId?: string;
  } = {},
): Promise<DemoVerificationResult> {
  if (!clean(env.CORE_AGENT_VERIFY_TOKEN)) throw new Error("verification_auth_unconfigured");
  const binding = loadBinding(env);
  const coreOrigin = strictHttpsOrigin(env.CORE_BASE_URL);
  const fetchImpl = options.fetchImpl ?? fetch;
  const requestId = options.requestId || crypto.randomUUID();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetchImpl(`${coreOrigin}${CORE_VERIFY_PATH}`, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${env.CORE_AGENT_VERIFY_TOKEN}`,
        "content-type": "application/json",
        "idempotency-key": demoIdempotencyKey(options.now),
        "x-tookeffect-request-id": requestId,
      },
      body: JSON.stringify(binding),
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`core_verification_failed:${response.status}`);
    if (!String(response.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
      throw new Error("core_verification_non_json");
    }

    const raw = validateCoreResult(await readBoundedJson(response, 512 * 1024));
    const signatureVerified = await verifyReceiptSignature(raw, coreOrigin, fetchImpl);
    if (!signatureVerified) throw new Error("receipt_signature_invalid");

    return {
      status: "completed",
      verdict: raw.verdict,
      controlMode: "OBSERVE_ONLY",
      actionAttempted: false,
      providerReadback: "live",
      receipt: {
        issued: true,
        signatureVerified: true,
        evidenceDigest: raw.receipt.evidenceDigest.toLowerCase(),
        mode: raw.receipt.mode,
        keyId: raw.receipt.keyId,
      },
    };
  } catch (error) {
    if (controller.signal.aborted) throw new Error("core_verification_timeout");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function validateCoreResult(value: unknown): RawCoreResult {
  const record = asRecord(value);
  const receipt = asRecord(record.receipt);
  const verdict = record.verdict;
  if (
    !UUID.test(clean(record.effectId))
    || record.status !== "completed"
    || (verdict !== "APPLIED" && verdict !== "NOT_APPLIED" && verdict !== "AMBIGUOUS")
    || record.actionAttempted !== false
    || record.controlMode !== "OBSERVE_ONLY"
    || !isHttpsUrl(receipt.url)
    || !HEX_DIGEST.test(clean(receipt.evidenceDigest))
    || !COMPACT_JWS.test(clean(receipt.signature))
    || !clean(receipt.mode)
    || !clean(receipt.keyId)
    || !isHttpsUrl(receipt.jwksUrl)
  ) {
    throw new Error("core_verification_contract_mismatch");
  }

  return {
    effectId: clean(record.effectId),
    status: "completed",
    verdict,
    actionAttempted: false,
    controlMode: "OBSERVE_ONLY",
    receipt: {
      url: clean(receipt.url),
      evidenceDigest: clean(receipt.evidenceDigest),
      signature: clean(receipt.signature),
      mode: clean(receipt.mode),
      keyId: clean(receipt.keyId),
      jwksUrl: clean(receipt.jwksUrl),
    },
  };
}

export async function verifyReceiptSignature(
  raw: RawCoreResult,
  coreOrigin: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const expectedJwksUrl = `${coreOrigin}${CORE_KEYS_PATH}`;
  if (raw.receipt.jwksUrl !== expectedJwksUrl) throw new Error("receipt_key_origin_mismatch");

  const [protectedPart, payloadPart, signaturePart] = raw.receipt.signature.split(".");
  const header = asRecord(JSON.parse(base64UrlUtf8(protectedPart)));
  const payload = asRecord(JSON.parse(base64UrlUtf8(payloadPart)));

  if (
    header.alg !== "EdDSA"
    || header.kid !== raw.receipt.keyId
    || payload.effectId !== raw.effectId
    || payload.provider !== "github"
    || payload.effectType !== "github.verify_pull_request_merge"
    || payload.controlMode !== "OBSERVE_ONLY"
  ) {
    throw new Error("receipt_payload_mismatch");
  }

  const action = asRecord(payload.action);
  if (action.attempted !== false) throw new Error("receipt_action_mismatch");

  const keyResponse = await fetchImpl(expectedJwksUrl, {
    headers: { accept: "application/jwk-set+json, application/json" },
    cache: "no-store",
    redirect: "manual",
  });
  if (!keyResponse.ok) throw new Error(`receipt_keys_failed:${keyResponse.status}`);
  const jwks = asRecord(await keyResponse.json());
  const keys = Array.isArray(jwks.keys) ? jwks.keys : [];
  const key = keys
    .map((candidate) => asRecord(candidate))
    .find((candidate) => candidate.kid === raw.receipt.keyId);

  if (!key || key.kty !== "OKP" || key.crv !== "Ed25519" || key.d !== undefined) {
    throw new Error("receipt_key_invalid");
  }

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    key as unknown as JsonWebKey,
    { name: "Ed25519" },
    false,
    ["verify"],
  );

  return crypto.subtle.verify(
    "Ed25519",
    cryptoKey,
    ownedArrayBuffer(base64UrlBytes(signaturePart)),
    ownedArrayBuffer(new TextEncoder().encode(`${protectedPart}.${payloadPart}`)),
  );
}

async function readBoundedJson(response: Response, limit: number): Promise<unknown> {
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > limit) throw new Error("core_response_too_large");
  if (!response.body) throw new Error("core_response_empty");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > limit) {
      await reader.cancel();
      throw new Error("core_response_too_large");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("core_response_invalid_json");
  }
}

function strictHttpsOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("core_origin_invalid");
  }
  if (
    url.protocol !== "https:"
    || !url.hostname
    || url.username
    || url.password
    || (url.pathname !== "/" && url.pathname !== "")
    || url.search
    || url.hash
  ) {
    throw new Error("core_origin_invalid");
  }
  return url.origin;
}

function isHttpsUrl(value: unknown): boolean {
  try {
    const url = new URL(clean(value));
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function base64UrlUtf8(value: string): string {
  return new TextDecoder().decode(base64UrlBytes(value));
}

function base64UrlBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function ownedArrayBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}
