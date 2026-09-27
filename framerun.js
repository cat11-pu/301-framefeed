// framerun.js：按处理预算处理数据块，预算用尽就把数据块连着载压在账上；收尾不限预算清账。
import { takeFrames } from "./frames.js";

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function cloneState(state) {
  const source = state || {};
  return {
    frames: (source.frames || []).map(function (frame) { return [frame[0], frame[1]]; }),
    buffer: source.buffer || "",
    next_seq: source.next_seq === undefined ? 1 : source.next_seq,
    ledger: (source.ledger || []).map(function (entry) { return [entry[0], entry[1]]; }),
    applied: (source.applied || []).slice()
  };
}

function applyChunk(state, chunk, lengthCode) {
  let got;
  try {
    got = takeFrames(state.buffer + chunk, state.next_seq);
  } catch (error) {
    if (error && error.code === "E_BAD_LENGTH") fail(lengthCode, error.message);
    throw error;
  }
  for (const frame of got.frames) state.frames.push(frame);
  state.next_seq += got.frames.length;
  state.buffer = got.rest;
}

function validate(events, eventCode) {
  for (const event of events) {
    if (!event || event.kind !== "feed" || typeof event.chunk !== "string" || event.chunk.length === 0) {
      fail(eventCode, "bad event");
    }
  }
}

export function step(spec) {
  const state = cloneState(spec.state);
  const events = spec.events || [];
  const eventCode = spec.event_error_code || "E_BAD_EVENT";
  const lengthCode = spec.length_error_code || "E_BAD_LENGTH";
  validate(events, eventCode);
  let budget = spec.budget || 0;
  let served = 0;
  let judged = 0;
  while (state.ledger.length > 0 && budget > 0) {
    const entry = state.ledger.shift();
    applyChunk(state, entry[1], lengthCode);
    budget -= 1;
    served += 1;
  }
  for (const event of events) {
    if (event.id !== undefined) {
      if (state.applied.indexOf(event.id) !== -1) continue;
      state.applied.push(event.id);
    }
    if (budget <= 0) {
      state.ledger.push([event.kind, event.chunk]);
      continue;
    }
    applyChunk(state, event.chunk, lengthCode);
    budget -= 1;
    served += 1;
    judged += 1;
  }
  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map(function (entry) { return [entry[0], entry[1]]; }),
    judged: judged,
    judged_bound: events.length
  };
}

export function close(spec) {
  const state = cloneState(spec.state);
  const lengthCode = spec.length_error_code || "E_BAD_LENGTH";
  let catchup = 0;
  while (state.ledger.length > 0) {
    const entry = state.ledger.shift();
    applyChunk(state, entry[1], lengthCode);
    catchup += 1;
  }
  return { state: state, catchup: catchup };
}
