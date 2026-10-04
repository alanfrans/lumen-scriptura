export interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  solid: boolean;
  /** Blocks only a mounted rider (doorways a horse cannot pass). */
  horseOnly?: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Pushes a circle on the XZ plane out of every solid box. Mutates `p`. */
export function resolveCircle(p: { x: number; z: number }, r: number, boxes: readonly Box[], mounted: boolean): void {
  for (const b of boxes) {
    if (!b.solid || (b.horseOnly && !mounted)) continue;
    const cx = clamp(p.x, b.minX, b.maxX);
    const cz = clamp(p.z, b.minZ, b.maxZ);
    const dx = p.x - cx;
    const dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      p.x = cx + (dx / d) * r;
      p.z = cz + (dz / d) * r;
    } else {
      const left = p.x - b.minX;
      const right = b.maxX - p.x;
      const down = p.z - b.minZ;
      const up = b.maxZ - p.z;
      const m = Math.min(left, right, down, up);
      if (m === left) p.x = b.minX - r;
      else if (m === right) p.x = b.maxX + r;
      else if (m === down) p.z = b.minZ - r;
      else p.z = b.maxZ + r;
    }
  }
}
