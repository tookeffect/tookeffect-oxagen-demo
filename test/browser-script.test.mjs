import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import worker from "../src/app.ts";

test("browser inline script parses as JavaScript", async () => {
  const response = await worker.fetch(new Request("https://oxagen.tookeffect.com/#proof"), {});
  assert.equal(response.status, 200);
  const html = await response.text();
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match, "inline client script missing");
  assert.doesNotThrow(() => new vm.Script(match[1], { filename: "oxagen-client.js" }));
});
