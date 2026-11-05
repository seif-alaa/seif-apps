import "server-only";

/** Identify an image by its bytes and read its pixel size (PNG, WebP, JPEG, AVIF-less by design). */
export function imageMeta(b: Uint8Array): { ext: "png" | "webp" | "jpg"; type: string; width: number; height: number } | null {
  const u32be = (o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { ext: "png", type: "image/png", width: u32be(16), height: u32be(20) };
  }
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (chunk === "VP8X") return { ext: "webp", type: "image/webp", width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
    if (chunk === "VP8 ") return { ext: "webp", type: "image/webp", width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
    if (chunk === "VP8L") {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { ext: "webp", type: "image/webp", width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    return null;
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let o = 2;
    while (o < b.length) {
      if (b[o] !== 0xff) return null;
      const marker = b[o + 1];
      const len = (b[o + 2] << 8) | b[o + 3];
      if (marker >= 0xc0 && marker <= 0xc3) return { ext: "jpg", type: "image/jpeg", height: (b[o + 5] << 8) | b[o + 6], width: (b[o + 7] << 8) | b[o + 8] };
      o += 2 + len;
    }
  }
  return null;
}
