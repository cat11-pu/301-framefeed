// frames.js：从缓冲里切帧（基线：一律给空表）
export function takeFrames(buffer, nextSeq) {
  return { frames: [], rest: buffer };
}

export function peekLength(buffer) {
  return 0;
}
