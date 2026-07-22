import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.js";

test("handles CORS preflight without calling a provider", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/translate", { method: "OPTIONS" }),
    {}
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
});

test("rejects malformed translation requests", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }),
    {}
  );

  assert.equal(response.status, 400);
  assert.match(await response.text(), /segments must be an array/);
});

test("rejects a missing extension token before provider use", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segments: [{ id: "1", text: "Hello" }] })
    }),
    { EXTENSION_TOKEN: "required-token" }
  );

  assert.equal(response.status, 401);
});

test("reports an explicit configuration error when no provider is enabled", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segments: [{ id: "1", text: "Hello" }] })
    }),
    {}
  );

  assert.equal(response.status, 400);
  assert.match(await response.text(), /No AI backend is configured/);
});
