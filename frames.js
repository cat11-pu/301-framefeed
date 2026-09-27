// frames.js：从缓冲里切帧。每帧开头四位数字是载荷长度，攒够一帧就切出来。
export function takeFrames(buffer, nextSeq) {
  const frames = [];
  let rest = buffer;
  let seq = nextSeq;
  while (rest.length >= 4) {
    const head = rest.slice(0, 4);
    if (!/^[0-9]{4}$/.test(head)) {
      const error = new Error("length prefix is not four digits: " + head);
      error.code = "E_BAD_LENGTH";
      throw error;
    }
    const size = parseInt(head, 10);
    if (rest.length < 4 + size) break;
    frames.push([seq, rest.slice(4, 4 + size)]);
    seq += 1;
    rest = rest.slice(4 + size);
  }
  return { frames: frames, rest: rest };
}

export function peekLength(buffer) {
  if (buffer.length < 4) return -1;
  const head = buffer.slice(0, 4);
  if (!/^[0-9]{4}$/.test(head)) return -1;
  return parseInt(head, 10);
}
