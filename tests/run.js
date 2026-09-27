import assert from "node:assert";
import { takeFrames, peekLength } from "../frames.js";
import { step, close } from "../framerun.js";
import { render } from "../app.js";

const base = {
  budget: 1,
  state: { frames: [], buffer: "", ledger: [], applied: [] },
  events: [],
  length_error_code: "E_BAD_LENGTH", event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("takeFrames returns frames and rest", () => {
  const got = takeFrames("", 1);
  assert.ok(Array.isArray(got.frames));
  assert.strictEqual(typeof got.rest, "string");
});

check("peekLength returns a number", () => {
  assert.strictEqual(typeof peekLength("aaaa"), "number");
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
