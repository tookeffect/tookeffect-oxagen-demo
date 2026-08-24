import {
  verifyLiveOutcome,
  type DemoVerificationResult,
  type VerificationEnv,
} from "./verification.ts";

const MCP_TOOL_NAME = "verify_github_pull_request_merge";
const PREFERRED_PROTOCOL_VERSION = "2025-06-18";
const SUPPORTED_PROTOCOL_VERSIONS = new Set([
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
]);
const MAX_MCP_BODY_BYTES = 64 * 1024;

type JsonRecord = Record<string, unknown>;

export type RateLimiter = {
  limit(input: { key: string }): Promise<{ success: boolean }>;
};

export type DemoRuntimeEnv = VerificationEnv & {
  VERIFY_ACTOR_RATE_LIMITER?: RateLimiter;
  VERIFY_GLOBAL_RATE_LIMITER?: RateLimiter;
};

export const MCP_TOOL = {
  name: MCP_TOOL_NAME,
  description:
    "Independently verify the demo-scoped GitHub pull-request merge claim from authoritative provider state. The target is bound server-side. This tool is read-only and returns APPLIED, NOT_APPLIED, or AMBIGUOUS plus verified receipt evidence.",
  inputSchema: {
    type: "object",
    properties: {
      claim: {
        type: "string",
        minLength: 1,
        maxLength: 240,
        description: "The agent success claim that should be independently checked.",
      },
      provenance_ref: {
        type: "string",
        minLength: 1,
        maxLength: 240,
        description:
          "Optional Oxagen/Stella context or provenance reference. It is carried only as handoff context and never selects the provider target.",
      },
    },
    required: ["claim"],
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
    destructiveHint: false,
  },
} as const;

export function mcpPublicInfo() {
  return {
    enabled: true,
    endpoint: "/mcp",
    transport: "streamable-http",
    protocolVersion: PREFERRED_PROTOCOL_VERSION,
    authentication: "demo-scoped-public",
    targetBinding: "server-side",
    readOnly: true,
    tool: MCP_TOOL_NAME,
    stellaToolName: `mcp__tookeffect__${MCP_TOOL_NAME}`,
  } as const;
}

export async function takeVerificationBudget(
  request: Request,
  env: DemoRuntimeEnv,
  channel: "web" | "mcp",
): Promise<boolean> {
  if (!env.VERIFY_ACTOR_RATE_LIMITER || !env.VERIFY_GLOBAL_RATE_LIMITER) {
    throw new Error("rate_limiter_unconfigured");
  }

  const actor = request.headers.get("cf-connecting-ip")?.trim() || "unknown";
  const global = await env.VERIFY_GLOBAL_RATE_LIMITER.limit({ key: "oxagen-demo" });
  if (!global.success) return false;

  const perActor = await env.VERIFY_ACTOR_RATE_LIMITER.limit({
    key: `${channel}:${actor}`,
  });
  return perActor.success;
}

export async function handleMcpRequest(
  request: Request,
  env: DemoRuntimeEnv,
  verify: typeof verifyLiveOutcome = verifyLiveOutcome,
): Promise<Response> {
  if (request.method !== "POST") {
    return mcpJson(
      rpcError(null, -32600, "MCP uses POST on this endpoint."),
      405,
      { allow: "POST" },
    );
  }

  if (!originAllowed(request)) {
    return mcpJson(rpcError(null, -32003, "invalid_origin"), 403);
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.includes("application/json")) {
    return mcpJson(rpcError(null, -32600, "content_type_must_be_application_json"), 415);
  }

  let message: JsonRecord;
  try {
    const body = await readBoundedText(request, MAX_MCP_BODY_BYTES);
    const parsed = JSON.parse(body) as unknown;
    if (!isRecord(parsed) || Array.isArray(parsed)) throw new Error("invalid_request");
    message = parsed;
  } catch (error) {
    const reason = error instanceof Error && error.message === "body_too_large"
      ? "request_too_large"
      : "invalid_json_rpc";
    return mcpJson(rpcError(null, -32700, reason), reason === "request_too_large" ? 413 : 400);
  }

  if (message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return mcpJson(rpcError(message.id ?? null, -32600, "invalid_request"), 400);
  }

  const id = message.id ?? null;
  const params = isRecord(message.params) ? message.params : {};

  if (message.method === "notifications/initialized") {
    return new Response(null, {
      status: 202,
      headers: mcpHeaders(),
    });
  }

  if (message.method === "initialize") {
    const offered = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
    const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.has(offered)
      ? offered
      : PREFERRED_PROTOCOL_VERSION;
    return mcpJson(rpcResult(id, {
      protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: {
        name: "tookeffect-oxagen-verifier",
        title: "TookEffect × Oxagen verifier",
        version: "0.2.0",
        websiteUrl: "https://tookeffect.com",
      },
      instructions:
        "Demo-scoped read-only verifier. Oxagen/Stella may supply a success claim; TookEffect independently checks the server-bound GitHub target and returns provider evidence without performing the claimed action.",
    }));
  }

  if (message.method === "tools/list") {
    return mcpJson(rpcResult(id, { tools: [MCP_TOOL] }));
  }

  if (message.method === "tools/call") {
    if (params.name !== MCP_TOOL_NAME) {
      return mcpJson(rpcError(id, -32602, "unknown_tool"));
    }

    const args = isRecord(params.arguments) ? params.arguments : {};
    const claim = cleanText(args.claim, 240);
    const provenanceRef = args.provenance_ref === undefined
      ? ""
      : cleanText(args.provenance_ref, 240);
    if (!claim || (args.provenance_ref !== undefined && !provenanceRef)) {
      return mcpJson(rpcError(id, -32602, "invalid_tool_arguments"));
    }

    try {
      if (!(await takeVerificationBudget(request, env, "mcp"))) {
        return mcpJson(rpcError(id, -32029, "demo_rate_limit_exceeded"));
      }
      const observed = await verify(env);
      return mcpJson(rpcResult(id, toolResult(observed, claim, provenanceRef)));
    } catch (error) {
      console.error(JSON.stringify({
        event: "oxagen_mcp_verification_failed",
        error: safeError(error),
      }));
      return mcpJson(rpcError(id, -32000, "verification_unavailable"));
    }
  }

  return mcpJson(rpcError(id, -32601, "method_not_found"));
}

function toolResult(
  observed: DemoVerificationResult,
  claim: string,
  provenanceRef: string,
): JsonRecord {
  const lines = [
    `Claim: ${claim}`,
    `Verdict: ${observed.verdict}`,
    "Provider read-back: live",
    "Control: OBSERVE_ONLY",
    "Provider mutation: no",
    "Signed Receipt: verified",
    `Evidence digest: ${observed.receipt.evidenceDigest}`,
  ];
  if (provenanceRef) lines.splice(1, 0, `Provenance ref: ${provenanceRef}`);

  return {
    content: [{ type: "text", text: lines.join("\n") }],
    structuredContent: {
      claim,
      ...(provenanceRef ? { provenanceRef } : {}),
      status: observed.status,
      verdict: observed.verdict,
      providerReadback: observed.providerReadback,
      controlMode: observed.controlMode,
      actionAttempted: observed.actionAttempted,
      receipt: observed.receipt,
    },
    isError: false,
  };
}

function rpcResult(id: unknown, result: unknown): JsonRecord {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: unknown, code: number, message: string): JsonRecord {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function mcpJson(value: unknown, status = 200, extra?: HeadersInit): Response {
  const headers = mcpHeaders();
  if (extra) new Headers(extra).forEach((value, key) => headers.set(key, value));
  return new Response(JSON.stringify(value), { status, headers });
}

function mcpHeaders(): Headers {
  return new Headers({
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  });
}

function originAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function readBoundedText(request: Request, limit: number): Promise<string> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) throw new Error("body_too_large");
  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new Error("body_too_large");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const text = value.trim();
  return text.length > 0 && text.length <= max ? text : "";
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeError(error: unknown): string {
  if (!(error instanceof Error)) return "unknown";
  return /^[a-z0-9:_-]{1,100}$/i.test(error.message) ? error.message : "internal";
}
