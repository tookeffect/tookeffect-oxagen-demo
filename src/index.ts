import {
  demoInfo,
  verifyLiveOutcome,
  type VerificationEnv,
} from "./verification";
import {
  handleMcpRequest,
  mcpPublicInfo,
  takeVerificationBudget,
  type DemoRuntimeEnv,
} from "./mcp";

type Env = VerificationEnv & DemoRuntimeEnv;

const securityHeaders = {
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/healthz") {
      return json({ status: "ok", service: "tookeffect-oxagen-demo" }, 200);
    }

    if (request.method === "GET" && url.pathname === "/api/demo") {
      return json(demoInfo(env), 200);
    }

    if (request.method === "GET" && url.pathname === "/api/mcp") {
      return json(mcpPublicInfo(), 200);
    }

    if (url.pathname === "/mcp") {
      return handleMcpRequest(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/demo/verify") {
      if (!sameOriginIfPresent(request)) {
        return json({ error: "invalid_origin" }, 403);
      }

      try {
        if (!(await takeVerificationBudget(request, env, "web"))) {
          return json(
            { error: "demo_rate_limit_exceeded", retryAfterSeconds: 60 },
            429,
            { "retry-after": "60" },
          );
        }
        return json(await verifyLiveOutcome(env), 200);
      } catch (error) {
        console.error(JSON.stringify({
          event: "oxagen_demo_verification_failed",
          error: safeError(error),
        }));
        return json({ error: "verification_unavailable" }, 503);
      }
    }

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      return html(page());
    }

    if (request.method !== "GET" && request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405, { allow: "GET, POST" });
    }

    return json({ error: "not_found" }, 404);
  },
};

function json(value: unknown, status: number, extra?: HeadersInit): Response {
  const headers = new Headers({
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    ...securityHeaders,
  });
  if (extra) new Headers(extra).forEach((value, key) => headers.set(key, value));
  return new Response(JSON.stringify(value), { status, headers });
}

function html(value: string): Response {
  return new Response(value, {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      ...securityHeaders,
    },
  });
}

function sameOriginIfPresent(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function safeError(error: unknown): string {
  if (!(error instanceof Error)) return "unknown";
  return /^[a-z0-9:_-]{1,100}$/i.test(error.message) ? error.message : "internal";
}

function page(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>TookEffect × Oxagen — Live verification</title>
  <style>
    :root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111;background:#fbfaf8;--ink:#111;--muted:#696969;--panel:#fff;--line:#e4e2de;--soft:#f5f3ef;--green:#146b43;--green-bg:#edf8f2;--amber:#8a4b08;--amber-bg:#fff7e9;--red:#9b2c2c;--red-bg:#fff1f1}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;min-height:100vh;background:#fbfaf8;color:var(--ink)}button{font:inherit}.shell{width:min(1160px,calc(100% - 36px));margin:0 auto;padding:22px 0 60px}
    .top{height:58px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);margin-bottom:72px}.brand{display:flex;align-items:center;gap:11px;font-weight:800;letter-spacing:-.02em}.mark{width:31px;height:31px;border:1.5px solid var(--ink);border-radius:8px;display:grid;place-items:center;font-size:14px}.partner{font-weight:500;color:var(--muted)}.topPills{display:flex;gap:8px;flex-wrap:wrap}.pill{border:1px solid var(--line);background:#fff;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:750}.pill.live{color:var(--green);border-color:#b9ddca;background:var(--green-bg)}
    .hero{max-width:890px;margin-bottom:42px}.eyebrow{font-size:11px;line-height:1;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);font-weight:800;margin:0 0 14px}.hero h1{font-size:clamp(48px,7.5vw,86px);line-height:.94;letter-spacing:-.062em;margin:0 0 24px;max-width:960px}.heroLead{font-size:19px;line-height:1.55;color:var(--muted);max-width:790px;margin:0}.heroStrong{color:var(--ink);font-weight:700}
    .availability{display:flex;gap:8px;flex-wrap:wrap;margin:28px 0 0}.availability span{font-size:11px;font-weight:700;border:1px solid var(--line);background:#fff;border-radius:8px;padding:8px 10px}
    .journey{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--line);background:var(--panel);border-radius:18px;overflow:hidden;margin:34px 0}.stage{padding:21px;min-height:168px;border-right:1px solid var(--line);display:flex;flex-direction:column;justify-content:space-between}.stage:last-child{border-right:0}.stageTop{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.number{font-size:12px;font-weight:850}.status{font-size:9px;letter-spacing:.1em;border:1px solid var(--line);border-radius:999px;padding:5px 7px;color:var(--muted);font-weight:850}.stage small{display:block;color:var(--muted);font-size:11px;margin-bottom:7px}.stage b{font-size:16px;line-height:1.3;letter-spacing:-.015em}
    .proof{border:1px solid var(--line);background:var(--panel);border-radius:20px;overflow:hidden}.proofTitle{padding:28px 30px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:flex-end;gap:24px}.proofTitle h2{font-size:clamp(28px,4vw,43px);line-height:1;letter-spacing:-.045em;margin:5px 0 10px}.proofTitle p{margin:0;color:var(--muted);max-width:660px;line-height:1.55}.mode{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.mode span{font-size:10px;border:1px solid var(--line);border-radius:999px;padding:7px 9px;white-space:nowrap}.mode b{margin-left:3px}
    .claimGrid{display:grid;grid-template-columns:1fr 1fr}.claim{padding:28px 30px;min-height:236px}.claim:first-child{border-right:1px solid var(--line)}.label{font-size:10px;text-transform:uppercase;letter-spacing:.11em;color:var(--muted);font-weight:850;margin-bottom:18px}.contextRows{display:grid}.row{display:flex;justify-content:space-between;gap:20px;padding:11px 0;border-top:1px solid var(--line);font-size:13px}.row:first-child{border-top:0}.row span{color:var(--muted)}blockquote{font-size:27px;line-height:1.25;letter-spacing:-.032em;font-weight:780;margin:6px 0 18px}.claim p{font-size:13px;line-height:1.55;color:var(--muted);margin:0}
    .verifyBar{border-top:1px solid var(--line);padding:20px 30px;display:flex;align-items:center;gap:15px}.verifyBar button{border:0;background:var(--ink);color:#fff;border-radius:9px;padding:12px 16px;font-size:13px;font-weight:800;cursor:pointer}.verifyBar button:disabled{opacity:.45;cursor:not-allowed}.verifyBar span{color:var(--muted);font-size:12px}
    .result{display:none;border-top:1px solid var(--line);padding:28px 30px}.result.show{display:block}.resultHeader{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.verdict{font-size:42px;line-height:1;font-weight:900;letter-spacing:-.05em}.receipt{font-size:12px;font-weight:850;padding:8px 10px;border-radius:8px;background:var(--green-bg);color:var(--green)}.resultText{margin:13px 0 0;color:var(--muted);font-size:14px;line-height:1.55;max-width:720px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:22px}.meta div{border:1px solid var(--line);border-radius:10px;padding:12px}.meta span{display:block;font-size:9px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);font-weight:800}.meta b{display:block;font-size:12px;margin-top:5px}.proofDetails{margin-top:12px;border-top:1px solid var(--line);padding-top:13px}.proofDetails summary{cursor:pointer;font-size:11px;font-weight:800;color:var(--muted)}.digest{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;overflow-wrap:anywhere;color:var(--muted);margin-top:10px}
    .integration{margin-top:24px;border:1px solid var(--line);background:var(--panel);border-radius:20px;overflow:hidden}.integrationHead{padding:28px 30px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.integrationHead h2{font-size:34px;letter-spacing:-.04em;margin:5px 0 9px}.integrationHead p{margin:0;color:var(--muted);font-size:13px;line-height:1.55;max-width:720px}.mcpState{font-size:11px;font-weight:850;border:1px solid #b9ddca;background:var(--green-bg);color:var(--green);border-radius:999px;padding:8px 10px;white-space:nowrap}.integrationGrid{display:grid;grid-template-columns:1fr 1fr}.integrateCard{padding:28px 30px;min-height:300px}.integrateCard:first-child{border-right:1px solid var(--line)}.integrateCard h3{font-size:20px;margin:0 0 9px;letter-spacing:-.025em}.integrateCard p{font-size:13px;line-height:1.55;color:var(--muted);margin:0}.code{margin:18px 0 0;background:#111;color:#f6f6f6;border-radius:12px;padding:17px 18px;overflow:auto;font:12px/1.65 ui-monospace,SFMono-Regular,Menlo,monospace}.toolName{margin-top:16px;border:1px solid var(--line);border-radius:10px;padding:12px}.toolName span{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.1em;font-weight:800}.toolName code{display:block;margin-top:6px;font-size:11px;overflow-wrap:anywhere}.chain{display:grid;gap:0;margin-top:18px}.chain div{display:flex;align-items:center;gap:11px;padding:12px 0;border-top:1px solid var(--line);font-size:13px}.chain div:first-child{border-top:0}.dot{width:8px;height:8px;border-radius:50%;background:var(--ink);flex:none}.chain b{margin-left:auto;font-size:10px;color:var(--muted)}
    .note{margin-top:20px;padding:18px 0 0;border-top:1px solid var(--line);color:var(--muted);font-size:11px;line-height:1.55}.footer{padding:30px 0 4px;color:var(--muted);font-size:11px;display:flex;justify-content:space-between;gap:20px}.error{color:var(--red)!important}.success{color:var(--green)!important}
    @media(max-width:820px){.shell{width:min(100% - 22px,1160px)}.top{margin-bottom:48px}.partner{display:none}.journey{grid-template-columns:1fr 1fr}.stage:nth-child(2){border-right:0}.stage:nth-child(-n+2){border-bottom:1px solid var(--line)}.claimGrid,.integrationGrid{grid-template-columns:1fr}.claim:first-child,.integrateCard:first-child{border-right:0;border-bottom:1px solid var(--line)}.proofTitle,.integrationHead{display:block}.mode{justify-content:flex-start;margin-top:16px}.meta{grid-template-columns:1fr}.footer{display:block}.footer span{display:block;margin-top:5px}}
    @media(max-width:520px){.topPills .pill:not(.live){display:none}.hero h1{font-size:50px}.journey{grid-template-columns:1fr}.stage{border-right:0!important;border-bottom:1px solid var(--line)}.stage:last-child{border-bottom:0}.claim,.proofTitle,.result,.integrateCard,.integrationHead{padding-left:20px;padding-right:20px}.verifyBar{padding:18px 20px;align-items:flex-start;flex-direction:column}.resultHeader{display:block}.receipt{display:inline-block;margin-top:13px}}
  </style>
</head>
<body>
  <main class="shell">
    <header class="top">
      <div class="brand"><span class="mark">T</span><span>TookEffect</span><span class="partner">× Oxagen</span></div>
      <div class="topPills"><span class="pill">GitHub</span><span class="pill">Observe-only</span><span class="pill live">Live verification</span></div>
    </header>

    <section class="hero">
      <p class="eyebrow">Proof for agent actions · Oxagen design-partner POC</p>
      <h1>Stella says done. TookEffect proves it.</h1>
      <p class="heroLead"><span class="heroStrong">Oxagen governs context. Stella acts.</span> TookEffect independently checks the real external system before anyone has to trust the agent's success message.</p>
      <div class="availability"><span>Oxagen handoff: illustrative</span><span>GitHub read-back: live</span><span>Receipt verification: live</span><span id="mcpHero">Stella MCP: checking…</span></div>
    </section>

    <section class="journey" aria-label="Oxagen Stella TookEffect verification flow">
      <article class="stage"><div class="stageTop"><span class="number">01</span><span class="status">REQUESTED</span></div><div><small>Oxagen</small><b>Governed context + authority</b></div></article>
      <article class="stage"><div class="stageTop"><span class="number">02</span><span class="status">CLAIMED</span></div><div><small>Stella / agent</small><b>“The requested change was merged.”</b></div></article>
      <article class="stage"><div class="stageTop"><span class="number">03</span><span class="status">CHECKED</span></div><div><small>TookEffect</small><b>Reads GitHub itself</b></div></article>
      <article class="stage"><div class="stageTop"><span class="number">04</span><span class="status">PROVED</span></div><div><small>Verified result</small><b>Verdict + signed Receipt</b></div></article>
    </section>

    <section class="proof">
      <div class="proofTitle">
        <div><p class="eyebrow">Live proof</p><h2>A success message is not proof.</h2><p>This demo deliberately starts with an agent claiming success. TookEffect checks authoritative GitHub state instead of trusting that message.</p></div>
        <div class="mode"><span>Handoff <b>Example</b></span><span>Provider state <b>Live</b></span></div>
      </div>

      <div class="claimGrid">
        <article class="claim">
          <div class="label">01 · Governed context</div>
          <div class="contextRows">
            <div class="row"><span>Effect</span><b>GitHub pull request merge</b></div>
            <div class="row"><span>Resource</span><b>Authorized demo change</b></div>
            <div class="row"><span>Expected</span><b>Merged</b></div>
            <div class="row"><span>Provenance</span><b>Workspace-scoped context</b></div>
          </div>
        </article>
        <article class="claim">
          <div class="label">02 · Stella / agent claim</div>
          <blockquote>“The requested change was merged.”</blockquote>
          <p>The executor says it is done. TookEffect treats that as a claim to verify — never as evidence.</p>
        </article>
      </div>

      <div class="verifyBar">
        <button id="verify" type="button" disabled>Loading verification…</button>
        <span id="availabilityText">Checking the server-side verification boundary.</span>
      </div>

      <section class="result" id="result" aria-live="polite">
        <div class="resultHeader"><div><div class="label">Verified result</div><div class="verdict" id="verdict">—</div></div><div class="receipt" id="receipt">—</div></div>
        <p class="resultText" id="resultText"></p>
        <div class="meta"><div><span>Checked</span><b>Real GitHub state</b></div><div><span>Control</span><b>OBSERVE_ONLY</b></div><div><span>Provider mutation</span><b>No</b></div></div>
        <details class="proofDetails"><summary>View proof details</summary><div class="digest" id="digest">—</div></details>
      </section>
    </section>

    <section class="integration">
      <div class="integrationHead">
        <div><p class="eyebrow">Real Stella integration</p><h2>The verifier is already an MCP tool.</h2><p>This is not a mock integration. Stella can connect to the live TookEffect Streamable HTTP endpoint, discover the read-only verifier, call it, and receive the same provider-backed verdict and Receipt evidence shown above.</p></div>
        <span class="mcpState" id="mcpState">MCP server checking…</span>
      </div>
      <div class="integrationGrid">
        <article class="integrateCard">
          <h3>Connect from Stella</h3>
          <p>Add this server to <code>.stella/mcp.toml</code>. The demo endpoint is public, target-bound and read-only, so no provider credential or TookEffect credential is placed in Stella.</p>
          <pre class="code">[servers.tookeffect]
transport = "http"
url = "https://oxagen.tookeffect.com/mcp"
candidate_safe = true</pre>
          <div class="toolName"><span>Tool visible inside Stella</span><code>mcp__tookeffect__verify_github_pull_request_merge</code></div>
          <div class="note">Stella's project trust boundary still applies: <code>export STELLA_TRUST_PROJECT=1</code> for a repo whose MCP configuration you intentionally trust.</div>
        </article>
        <article class="integrateCard">
          <h3>The boundary stays narrow</h3>
          <p>Oxagen does not need to hand TookEffect its internal graph. Stella sends the claim and, optionally, a provenance reference. TookEffect chooses no target from those values: the approved demo target is bound server-side.</p>
          <div class="chain"><div><span class="dot"></span>Oxagen supplies governed context<b>CONTEXT</b></div><div><span class="dot"></span>Stella performs the action<b>ACT</b></div><div><span class="dot"></span>Stella calls TookEffect MCP<b>VERIFY</b></div><div><span class="dot"></span>TookEffect reads provider state<b>CHECK</b></div><div><span class="dot"></span>Verdict + signed Receipt return<b>PROVE</b></div></div>
          <div class="note">Production integration would add tenant authentication and per-target authorization. This POC intentionally exposes only one fixed, read-only demo verifier.</div>
        </article>
      </div>
    </section>

    <footer class="footer"><strong>TookEffect</strong><span>AI says done. TookEffect checks the real system and keeps proof.</span></footer>
  </main>

  <script>
    const button = document.getElementById("verify");
    const availability = document.getElementById("availabilityText");
    const result = document.getElementById("result");
    const verdict = document.getElementById("verdict");
    const receipt = document.getElementById("receipt");
    const resultText = document.getElementById("resultText");
    const digest = document.getElementById("digest");
    const mcpState = document.getElementById("mcpState");
    const mcpHero = document.getElementById("mcpHero");

    async function loadStatus() {
      try {
        const responses = await Promise.all([fetch("/api/demo", { cache: "no-store" }), fetch("/api/mcp", { cache: "no-store" })]);
        if (!responses[0].ok || !responses[1].ok) throw new Error("status_failed");
        const info = await responses[0].json();
        const mcp = await responses[1].json();
        if (!info.enabled || !info.observeOnly || info.providerVerification !== "live") throw new Error("verification_disabled");
        if (!mcp.enabled || !mcp.readOnly || mcp.transport !== "streamable-http") throw new Error("mcp_disabled");
        button.disabled = false;
        button.textContent = "Verify claimed outcome";
        availability.textContent = "Ready — TookEffect will read the live provider state without performing the claimed action.";
        mcpState.textContent = "MCP SERVER LIVE";
        mcpHero.textContent = "Stella MCP: live";
        mcpHero.classList.add("success");
      } catch (_) {
        button.disabled = true;
        button.textContent = "Verification unavailable";
        availability.textContent = "The live verification boundary is unavailable right now.";
        availability.classList.add("error");
        mcpState.textContent = "MCP unavailable";
        mcpState.classList.add("error");
        mcpHero.textContent = "Stella MCP: unavailable";
        mcpHero.classList.add("error");
      }
    }

    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "Checking GitHub…";
      availability.textContent = "Reading authoritative provider state and validating the signed Receipt.";
      try {
        const response = await fetch("/api/demo/verify", { method: "POST", headers: { accept: "application/json" } });
        const data = await response.json().catch(() => ({}));
        if (response.status === 429) throw new Error("rate_limit");
        if (!response.ok || data.status !== "completed") throw new Error("verify_failed");

        verdict.textContent = data.verdict;
        receipt.textContent = data.receipt && data.receipt.signatureVerified ? "SIGNED RECEIPT VERIFIED ✓" : "RECEIPT UNAVAILABLE";
        digest.textContent = "Evidence digest: " + ((data.receipt && data.receipt.evidenceDigest) || "unavailable");
        result.classList.add("show");

        if (data.verdict === "NOT_APPLIED") {
          resultText.textContent = "Demo success: the agent claimed the change was merged, but GitHub does not confirm that outcome. TookEffect caught the mismatch instead of trusting ‘done.’";
        } else if (data.verdict === "APPLIED") {
          resultText.textContent = "GitHub independently confirms the claimed outcome. TookEffect can prove the external effect actually happened.";
        } else {
          resultText.textContent = "TookEffect cannot prove the claimed outcome with sufficient certainty, so it stays AMBIGUOUS rather than inventing success.";
        }
        availability.textContent = "Provider read-back complete. No provider mutation was attempted.";
      } catch (error) {
        result.classList.add("show");
        verdict.textContent = "UNAVAILABLE";
        receipt.textContent = "NO VERDICT ISSUED";
        digest.textContent = "No proof was issued.";
        resultText.textContent = error && error.message === "rate_limit" ? "The public demo verification limit was reached. Try again in about a minute." : "The verifier failed closed. TookEffect did not infer success.";
        availability.textContent = "Verification failed closed.";
      } finally {
        button.disabled = false;
        button.textContent = "Verify claimed outcome";
      }
    });

    loadStatus();
  </script>
</body>
</html>`;
}
