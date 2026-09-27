// frames.js：从字节缓冲里按“四位长度前缀 + 载荷”切帧（原生 JS，零依赖）。

// 看缓冲开头四位：四位数字就返回载荷长度；不足四位或开头四位不全是数字，返回 -1。
export function peekLength(buffer) {
  const head = String(buffer == null ? "" : buffer).slice(0, 4);
  if (head.length < 4 || !/^[0-9]{4}$/.test(head)) return -1;
  return parseInt(head, 10);
}

// 反复切帧：够四位先读长度；开头四位不是数字就抛 E_BAD_LENGTH；
// 够一整帧（4 + 长度）就切出来，序号从 nextSeq 起递增；不够整帧就停下，
// 返回 { frames: [[seq, payload], ...], rest: 剩余缓冲 }。
export function takeFrames(buffer, nextSeq) {
  let rest = String(buffer == null ? "" : buffer);
  const frames = [];
  let seq = nextSeq;
  for (;;) {
    if (rest.length < 4) break;
    const head = rest.slice(0, 4);
    if (!/^[0-9]{4}$/.test(head)) {
      const error = new Error("bad length prefix: " + JSON.stringify(head));
      error.code = "E_BAD_LENGTH";
      throw error;
    }
    const length = parseInt(head, 10);
    if (rest.length < 4 + length) break;
    frames.push([seq, rest.slice(4, 4 + length)]);
    seq += 1;
    rest = rest.slice(4 + length);
  }
  return { frames, rest };
}
