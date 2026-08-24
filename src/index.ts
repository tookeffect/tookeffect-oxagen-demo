import {
  demoInfo,
  verifyLiveOutcome,
  type VerificationEnv,
} from "./verification";

type Env = VerificationEnv;

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

    if (request.method === "POST" && url.pathname === "/api/demo/verify") {
      if (!sameOriginIfPresent(request)) {
        return json({ error: "invalid_origin" }, 403);
      }

      try {
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
  if (extra) {
    new Headers(extra).forEach((value, key) => headers.set(key, value));
  }
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
  <meta name="color-scheme" content="light dark" />
  <title>TookEffect × Oxagen</title>
  <style>
    :root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#171717;background:#f6f5f2;--panel:#fff;--line:#dedbd3;--muted:#69665f;--ink:#171717;--soft:#f0eee8;--good:#155d38;--warn:#8a4b08}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 75% 0,#fff 0,transparent 38%),#f6f5f2;color:var(--ink)}
    button{font:inherit}.shell{width:min(1120px,calc(100% - 32px));margin:auto;padding:28px 0 64px}.top{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:68px}.brand{display:flex;align-items:center;gap:12px}.mark{width:34px;height:34px;display:grid;place-items:center;border:1px solid var(--ink);border-radius:10px;font-weight:800}.brandCopy{display:grid}.brandCopy small{color:var(--muted)}.pill{padding:8px 11px;border:1px solid var(--line);border-radius:999px;background:var(--panel);font-size:12px;font-weight:700}
    .hero{max-width:820px;margin-bottom:38px}.eyebrow{margin:0 0 10px;color:var(--muted);font-size:12px;font-weight:800;letter-spacing:.11em;text-transform:uppercase}.hero h1{font-size:clamp(42px,7vw,74px);line-height:.96;letter-spacing:-.055em;margin:0 0 22px}.hero p:last-child{max-width:760px;margin:0;color:var(--muted);font-size:18px;line-height:1.6}
    .flow{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;gap:12px;align-items:center;margin-bottom:28px}.step{min-height:138px;padding:20px;border:1px solid var(--line);border-radius:18px;background:var(--panel);display:flex;flex-direction:column;justify-content:space-between}.step b{font-size:17px;line-height:1.25}.step small{color:var(--muted)}.num{width:32px;height:32px;display:grid;place-items:center;border:1px solid var(--line);border-radius:999px;font-weight:800}.arrow{color:var(--muted)}
    .proof{border:1px solid var(--line);border-radius:22px;background:var(--panel);padding:30px;margin-top:28px}.proofHead{display:flex;align-items:flex-end;justify-content:space-between;gap:30px;padding-bottom:22px;border-bottom:1px solid var(--line)}.proofHead h2{font-size:clamp(28px,4vw,42px);letter-spacing:-.04em;line-height:1.05;margin:4px 0 8px}.proofHead p{margin:0;color:var(--muted);line-height:1.55}.mode{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.mode span{padding:8px 10px;border:1px solid var(--line);border-radius:999px;font-size:11px}.mode b{margin-left:4px}
    .cards{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px}.card{padding:22px;border:1px solid var(--line);border-radius:16px;background:var(--soft)}.label{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:800;margin-bottom:18px}.rows{display:grid;gap:0}.row{display:flex;justify-content:space-between;gap:20px;padding:10px 0;border-top:1px solid var(--line);font-size:13px}.row:first-child{border-top:0}.row span{color:var(--muted)}blockquote{font-size:24px;line-height:1.35;letter-spacing:-.025em;margin:8px 0 14px;font-weight:750}.card p{color:var(--muted);font-size:13px;line-height:1.55;margin-bottom:0}
    .action{display:flex;align-items:center;gap:16px;margin-top:20px}.action button{border:0;border-radius:12px;background:var(--ink);color:#fff;padding:13px 18px;font-weight:800;cursor:pointer}.action button:disabled{opacity:.45;cursor:not-allowed}.action span{font-size:12px;color:var(--muted)}.result{display:none;margin-top:20px;border:1px solid var(--line);border-radius:16px;padding:22px}.result.show{display:block}.resultLead{display:flex;justify-content:space-between;gap:16px;align-items:center}.verdict{font-size:30px;font-weight:850;letter-spacing:-.04em}.receipt{font-size:13px;font-weight:800}.resultText{color:var(--muted);line-height:1.55;margin:10px 0 0}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px}.meta div{padding:12px;border:1px solid var(--line);border-radius:12px}.meta span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em}.meta b{display:block;margin-top:5px;font-size:12px;overflow-wrap:anywhere}
    .integration{display:grid;grid-template-columns:1.2fr .8fr;gap:16px;margin-top:18px}.integration>div{border:1px solid var(--line);border-radius:18px;padding:24px;background:var(--panel)}.integration h3{margin:3px 0 10px;font-size:22px;letter-spacing:-.025em}.integration p{margin:0;color:var(--muted);line-height:1.6;font-size:13px}.boundary{display:grid;gap:9px;margin-top:16px}.boundary div{display:flex;gap:10px;align-items:center;font-size:13px}.dot{width:9px;height:9px;border-radius:50%;background:var(--ink);flex:none}.footer{margin-top:28px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:11px;line-height:1.5}
    .error{color:#8b1e1e}.success{color:var(--good)}
    @media(max-width:760px){.shell{width:min(100% - 22px,1120px);padding-top:18px}.top{margin-bottom:44px}.flow{grid-template-columns:1fr}.arrow{display:none}.cards,.integration{grid-template-columns:1fr}.proof{padding:20px}.proofHead{display:block}.mode{justify-content:flex-start;margin-top:16px}.action{align-items:flex-start;flex-direction:column}.resultLead{align-items:flex-start;flex-direction:column}.meta{grid-template-columns:1fr}}
    @media(prefers-color-scheme:dark){:root{color:#eee;background:#111;--panel:#181818;--line:#333;--muted:#aaa;--ink:#f2f2f2;--soft:#202020;--good:#77d19e;--warn:#f1b36a}body{background:radial-gradient(circle at 75% 0,#222 0,transparent 38%),#111}.action button{background:#f2f2f2;color:#111}}
  </style>
</head>
<body>
  <main class="shell">
    <header class="top">
      <div class="brand"><div class="mark">T</div><div class="brandCopy"><strong>TookEffect</strong><small>Oxagen design-partner demo</small></div></div>
      <span class="pill">Observe-only</span>
    </header>

    <section class="hero">
      <p class="eyebrow">Oxagen × TookEffect</p>
      <h1>Context before the action. Proof after it.</h1>
      <p>Oxagen can govern what an agent knows and is allowed to do. TookEffect independently verifies whether the external effect actually happened, then returns a cryptographically checked Receipt.</p>
    </section>

    <section class="flow" aria-label="Integration flow">
      <article class="step"><span class="num">1</span><div><small>Oxagen / Stella</small><br><b>Context + authority</b></div></article>
      <span class="arrow">→</span>
      <article class="step"><span class="num">2</span><div><small>Agent</small><br><b>Claims an external effect</b></div></article>
      <span class="arrow">→</span>
      <article class="step"><span class="num">3</span><div><small>TookEffect</small><br><b>Independent read-back + Receipt</b></div></article>
    </section>

    <section class="proof">
      <div class="proofHead">
        <div>
          <p class="eyebrow">Live proof</p>
          <h2>Can the agent's success claim be trusted?</h2>
          <p>The handoff is illustrative. The provider verification is live and read-only.</p>
        </div>
        <div class="mode"><span>Oxagen handoff <b>Example</b></span><span>Provider verification <b>Live</b></span></div>
      </div>

      <div class="cards">
        <article class="card">
          <div class="label">Example governed context</div>
          <div class="rows">
            <div class="row"><span>Effect</span><b>GitHub pull request merge</b></div>
            <div class="row"><span>Resource</span><b>Authorized demo change</b></div>
            <div class="row"><span>Expected outcome</span><b>Merged</b></div>
            <div class="row"><span>Provenance</span><b>Workspace-scoped context</b></div>
          </div>
        </article>
        <article class="card">
          <div class="label">Agent success message</div>
          <blockquote>“The requested change was merged.”</blockquote>
          <p>The executor says the job is done. TookEffect does not use the executor's message as evidence.</p>
        </article>
      </div>

      <div class="action">
        <button id="verify" type="button" disabled>Loading verification…</button>
        <span id="availability">Checking the server-side verification boundary.</span>
      </div>

      <section class="result" id="result" aria-live="polite">
        <div class="resultLead"><div><div class="label">Observed verdict</div><div class="verdict" id="verdict">—</div></div><div class="receipt" id="receipt">—</div></div>
        <p class="resultText" id="resultText"></p>
        <div class="meta">
          <div><span>Control</span><b>OBSERVE_ONLY</b></div>
          <div><span>Provider mutation</span><b>No</b></div>
          <div><span>Evidence digest</span><b id="digest">—</b></div>
        </div>
      </section>
    </section>

    <section class="integration">
      <div>
        <p class="eyebrow">Where the boundary fits</p>
        <h3>Stella can stay the context and authority layer.</h3>
        <p>TookEffect only needs the narrow effect claim and an approved target binding. It independently reads provider state and sends the verdict back without needing Oxagen's internal graph.</p>
        <div class="boundary"><div><span class="dot"></span>Oxagen / Stella supplies governed context</div><div><span class="dot"></span>The agent acts using its existing tools</div><div><span class="dot"></span>TookEffect verifies the external outcome</div><div><span class="dot"></span>The signed Receipt becomes durable evidence</div></div>
      </div>
      <div>
        <p class="eyebrow">Next integration step</p>
        <h3>A narrow read-only tool for Stella.</h3>
        <p>The same verifier can be exposed to Stella as a scoped MCP or API tool. The contract stays small: intended effect, approved resource, expected state, verdict and Receipt.</p>
      </div>
    </section>

    <footer class="footer">The provider binding and TookEffect credential remain server-side. They are not embedded in this page or returned by its public API.</footer>
  </main>

  <script>
    const button = document.getElementById("verify");
    const availability = document.getElementById("availability");
    const result = document.getElementById("result");
    const verdict = document.getElementById("verdict");
    const receipt = document.getElementById("receipt");
    const resultText = document.getElementById("resultText");
    const digest = document.getElementById("digest");

    function messageFor(value) {
      if (value === "APPLIED") return "The provider confirms the claimed outcome.";
      if (value === "NOT_APPLIED") return "The provider does not confirm the agent's success claim. The success message and external reality disagree.";
      return "The provider cannot prove the outcome strongly enough. TookEffect stays ambiguous instead of guessing.";
    }

    async function load() {
      try {
        const response = await fetch("/api/demo", { cache: "no-store" });
        const info = await response.json();
        if (!response.ok || info.enabled !== true) throw new Error("not-ready");
        button.disabled = false;
        button.textContent = "Verify outcome";
        availability.textContent = "Ready. The exact verification binding stays on the server.";
      } catch {
        button.disabled = true;
        button.textContent = "Verification unavailable";
        availability.textContent = "The live verification boundary is not configured.";
      }
    }

    button.addEventListener("click", async () => {
      if (button.disabled) return;
      button.disabled = true;
      button.textContent = "Reading provider…";
      result.classList.remove("show");
      try {
        const response = await fetch("/api/demo/verify", { method: "POST", headers: { accept: "application/json" } });
        const value = await response.json();
        if (!response.ok) throw new Error("verification-failed");
        verdict.textContent = value.verdict;
        verdict.className = "verdict " + (value.verdict === "APPLIED" ? "success" : "");
        receipt.textContent = value.receipt && value.receipt.signatureVerified === true ? "Signed Receipt verified ✓" : "Receipt unavailable";
        resultText.textContent = messageFor(value.verdict);
        digest.textContent = value.receipt && value.receipt.evidenceDigest ? value.receipt.evidenceDigest : "—";
        result.classList.add("show");
      } catch {
        verdict.textContent = "UNAVAILABLE";
        verdict.className = "verdict error";
        receipt.textContent = "No proof issued";
        resultText.textContent = "Verification failed closed. No provider mutation was attempted.";
        digest.textContent = "—";
        result.classList.add("show");
      } finally {
        button.disabled = false;
        button.textContent = "Verify again";
      }
    });

    load();
  </script>
</body>
</html>`;
}
