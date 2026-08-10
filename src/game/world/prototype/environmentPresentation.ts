export interface SnowBounds {
  readonly ceiling: number;
  readonly floor: number;
  readonly maxX: number;
  readonly maxZ: number;
  readonly minX: number;
  readonly minZ: number;
}

export interface SnowField {
  readonly drift: Float32Array;
  readonly phase: Float32Array;
  readonly positions: Float32Array;
  readonly speed: Float32Array;
}

export const PROTOTYPE_SNOW_BOUNDS: SnowBounds = { minX: -11.5, maxX: 14.5, minZ: -8.5, maxZ: 8.5, floor: 0.05, ceiling: 12 };

function seededUnit(index: number, salt: number): number {
  let value = (index + 1) * 0x9e3779b1 ^ salt * 0x85ebca6b;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  return (value >>> 0) / 0xffffffff;
}

export function createSnowField(count: number, bounds: SnowBounds = PROTOTYPE_SNOW_BOUNDS): SnowField {
  const positions = new Float32Array(count * 3);
  const speed = new Float32Array(count);
  const drift = new Float32Array(count);
  const phase = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = bounds.minX + seededUnit(index, 1) * (bounds.maxX - bounds.minX);
    positions[index * 3 + 1] = bounds.floor + seededUnit(index, 2) * (bounds.ceiling - bounds.floor);
    positions[index * 3 + 2] = bounds.minZ + seededUnit(index, 3) * (bounds.maxZ - bounds.minZ);
    speed[index] = 0.55 + seededUnit(index, 4) * 0.75;
    drift[index] = 0.04 + seededUnit(index, 5) * 0.12;
    phase[index] = seededUnit(index, 6) * Math.PI * 2;
  }
  return { drift, phase, positions, speed };
}

export function advanceSnowField(field: SnowField, deltaSeconds: number, bounds: SnowBounds = PROTOTYPE_SNOW_BOUNDS): void {
  for (let index = 0; index < field.speed.length; index += 1) {
    const positionIndex = index * 3;
    field.phase[index] = (field.phase[index] ?? 0) + deltaSeconds * (0.45 + index % 5 * 0.07);
    field.positions[positionIndex] = (field.positions[positionIndex] ?? 0) + ((field.drift[index] ?? 0) + Math.sin(field.phase[index] ?? 0) * 0.035) * deltaSeconds;
    field.positions[positionIndex + 1] = (field.positions[positionIndex + 1] ?? 0) - (field.speed[index] ?? 0) * deltaSeconds;
    if ((field.positions[positionIndex + 1] ?? 0) < bounds.floor) {
      field.positions[positionIndex + 1] = bounds.ceiling - seededUnit(index, 7) * 1.5;
      field.positions[positionIndex + 2] = bounds.minZ + seededUnit(index, 8) * (bounds.maxZ - bounds.minZ);
    }
    if ((field.positions[positionIndex] ?? 0) > bounds.maxX) field.positions[positionIndex] = bounds.minX;
  }
}
