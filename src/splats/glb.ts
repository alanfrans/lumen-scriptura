/** The first triangle mesh in a binary glTF file. Enough for the collision GLB. */
export function readGlbMesh(buffer: ArrayBuffer): { positions: Float32Array; indices: Uint32Array } {
  const view = new DataView(buffer);
  if (view.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67) {
    throw new Error("Collision file is not a glb");
  }
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength))) as {
    accessors: { bufferView: number; componentType: number; count: number; type: string; byteOffset?: number }[];
    bufferViews: { byteOffset?: number; byteLength: number }[];
    meshes: { primitives: { attributes: { POSITION?: number }; indices?: number }[] }[];
  };
  const bin = new Uint8Array(buffer, 28 + jsonLength);
  const primitive = json.meshes[0]?.primitives[0];
  const positionIndex = primitive?.attributes.POSITION;
  if (positionIndex == null || primitive.indices == null) throw new Error("Collision glb has no triangle mesh");

  const positions = readAccessor(json, bin, positionIndex);
  const indices = readAccessor(json, bin, primitive.indices);
  if (!(positions instanceof Float32Array)) throw new Error("Collision positions are not floats");
  const index32 = indices instanceof Uint32Array ? indices : new Uint32Array(indices);
  // splat-transform voxelizes in engine space. Its PLY space is a 180° roll
  // from that (Transform.PLY = fromEulers(0, 0, 180)), so the written mesh has
  // X and Y negated relative to the file Spark draws. Put the vertices back.
  const aligned = new Float32Array(positions);
  for (let i = 0; i < aligned.length; i += 3) {
    aligned[i] = -aligned[i];
    aligned[i + 1] = -aligned[i + 1];
  }
  return { positions: aligned, indices: new Uint32Array(index32) };
}

function readAccessor(
  json: {
    accessors: { bufferView: number; componentType: number; count: number; type: string; byteOffset?: number }[];
    bufferViews: { byteOffset?: number; byteLength: number }[];
  },
  bin: Uint8Array,
  index: number,
): Float32Array | Uint32Array | Uint16Array {
  const accessor = json.accessors[index];
  const bufferView = json.bufferViews[accessor.bufferView];
  const components = accessor.type === "SCALAR" ? 1 : accessor.type === "VEC3" ? 3 : 0;
  if (!components) throw new Error(`Unsupported accessor type ${accessor.type}`);
  const start = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const byteOffset = bin.byteOffset + start;
  if (accessor.componentType === 5126) {
    return new Float32Array(bin.buffer, byteOffset, accessor.count * components);
  }
  if (accessor.componentType === 5125) {
    return new Uint32Array(bin.buffer, byteOffset, accessor.count * components);
  }
  if (accessor.componentType === 5123) {
    return new Uint16Array(bin.buffer, byteOffset, accessor.count * components);
  }
  throw new Error(`Unsupported component type ${accessor.componentType}`);
}
