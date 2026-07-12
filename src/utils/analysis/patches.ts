// Small W×H patch primitives shared by the fields and gliders detectors.

/** True when every cell of the W×H patch at (x0, y0) holds the same value. */
export function isUniformPatch(
  rows: Uint8Array[],
  x0: number,
  y0: number,
  bw: number,
  bh: number
): boolean {
  const first = rows[y0][x0]
  for (let y = 0; y < bh; y++) {
    const rowData = rows[y0 + y]
    for (let x = 0; x < bw; x++) {
      if (rowData[x0 + x] !== first) {
        return false
      }
    }
  }
  return true
}

/** True when the two W×H patches at (ax, ay) and (bx, by) are cell-for-cell equal. */
export function patchesEqual(
  rows: Uint8Array[],
  ax: number,
  ay: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
): boolean {
  for (let y = 0; y < bh; y++) {
    const ra = rows[ay + y]
    const rb = rows[by + y]
    for (let x = 0; x < bw; x++) {
      if (ra[ax + x] !== rb[bx + x]) {
        return false
      }
    }
  }
  return true
}
