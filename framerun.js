// framerun.js：按整批共用的处理预算消费数据块，预算用尽就压在“账”（ledger）上；
// 收尾（close）不限预算把账清空。原生 JS，零依赖。
import { takeFrames } from "./frames.js";

function eventCode(spec) {
  return (spec && spec.event_error_code) || "E_BAD_EVENT";
}

function lengthCode(spec) {
  return (spec && spec.length_error_code) || "E_BAD_LENGTH";
}

// 数据块为空或事件不合法（先校验，与预算无关）都报 E_BAD_EVENT。
function validate(events, code) {
  if (!Array.isArray(events)) {
    const error = new Error("events must be an array");
    error.code = code;
    throw error;
  }
  for (const event of events) {
    if (!event || typeof event !== "object"
        || event.kind !== "feed"
        || typeof event.chunk !== "string"
        || event.chunk.length === 0) {
      const error = new Error("bad event: " + JSON.stringify(event));
      error.code = code;
      throw error;
    }
  }
}

function cloneState(state) {
  const source = state || {};
  return {
    frames: Array.isArray(source.frames) ? source.frames.map(function (frame) {
      return [frame[0], frame[1]];
    }) : [],
    buffer: typeof source.buffer === "string" ? source.buffer : "",
    next_seq: Number.isFinite(source.next_seq)
      ? source.next_seq
      : (Array.isArray(source.frames) ? source.frames.length + 1 : 1),
    ledger: Array.isArray(source.ledger)
      ? source.ledger.map(function (row) { return [row[0], row[1]]; })
      : [],
    applied: Array.isArray(source.applied) ? source.applied.slice() : []
  };
}

// 把一个数据块接进缓冲并尽量切帧（长度前缀非法时换成场景约定的报码）。
function feedInto(state, chunk, badLengthCode) {
  state.buffer += chunk;
  let cut;
  try {
    cut = takeFrames(state.buffer, state.next_seq);
  } catch (error) {
    if (error && error.code === "E_BAD_LENGTH") error.code = badLengthCode;
    throw error;
  }
  for (const frame of cut.frames) state.frames.push(frame);
  state.next_seq += cut.frames.length;
  state.buffer = cut.rest;
}

// 共用执行器：先清上轮压账（FIFO），再处理本轮新事件；每条花一次预算，
// 预算用尽后没处理的数据块连着载压在账上。已处理过（applied）的事件重放时跳过且不花预算。
function run(spec, unlimited) {
  const events = spec.events || [];
  validate(events, eventCode(spec));

  const state = cloneState(spec.state);
  let budget = unlimited ? Infinity : (Number(spec.budget) || 0);
  let served = 0;

  // 先还旧账
  while (state.ledger.length > 0 && budget > 0) {
    const row = state.ledger.shift();
    feedInto(state, row[1], lengthCode(spec));
    budget -= 1;
    served += 1;
  }

  // 再处理本轮事件：重放已处理的事件直接跳过，不计工作、不花预算
  const fresh = events.filter(function (event) {
    return !state.applied.includes(event.id);
  });
  const judged = fresh.length;
  for (const event of fresh) {
    if (budget > 0) {
      feedInto(state, event.chunk, lengthCode(spec));
      budget -= 1;
      served += 1;
    } else {
      state.ledger.push([event.kind, event.chunk]);
    }
    state.applied.push(event.id);
  }

  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger,
    judged: judged,
    judged_bound: events.length
  };
}

export function step(spec) {
  return run(spec || {}, false);
}

// 收尾：不限预算把账处理完，catchup 为这一轮补齐的条数。
export function close(spec) {
  const result = run(spec || {}, true);
  return { state: result.state, catchup: result.served };
}
