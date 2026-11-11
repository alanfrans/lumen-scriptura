# Lumen Scriptura

A walking reader for the text. The ordinary viewer is Babylon.js. Open it with `npm run dev`.

## Gaussian splat grove

`/?splats=1` is a separate prototype. It does not change the viewer unless that query is set, and it does not write the save.

The page starts in the garden of Eden, in the grove west of the two trees, third person, camera south of the character looking north. WASD walks, Space jumps, the mouse orbits, Shift runs, and G draws the hidden collision mesh. `/?splats=1&collider=1` starts with that mesh on.

The scenery is eight copies of one small tree, one file per 12 m cell. Spark streams a prebuilt level-of-detail tree (chunked `.RAD`, loaded with `paged: true`). A tile comes in at 18 m from its center and leaves at 27 m. Each source file is 19,500 splats. `lodScale` and `lodRenderScale` (1.5) coarsen a tile as it gets far, before it unloads. At the spawn only the four nearest tiles are inside 18 m, so the eastern pair stays out until you walk toward it.

### Why Spark, and how it is drawn

The world is already a Babylon scene: the lake, the four rivers, the ground, and the verses. PlayCanvas would be a second engine and could not draw those meshes. Spark is a three.js splat renderer. It does not share Babylon's WebGL context: on that context the sort's integer textures produced no fragments. Spark draws on its own canvas, and the color is copied over the game view. Occlusion uses the hidden collision mesh. Its depth is tested against the depth Babylon wrote for the ground, the character, and the water (water materials write depth while this mode is on). Foliage outside that mesh has no depth sample and is drawn in front. The film post-process (bloom, FXAA, grain, vignette) stays off so that scene depth is still there. Splats keep the color baked into the capture. They do not follow the day and night cycle or the fog.

On a headless SwiftShader run the grove held about 20 fps. Four resident tiles (78,000 splats) used about 290 MB of JS heap. Walking east loaded two more tiles (117,000 resident) while Spark still drew about 78,000, because those tiles sit at the edge of the view. Each chunked tile is about 290 KB plus a 1.5 KB header.

### Regenerating the assets

The source capture is `assets/splats/gsplat-toy-tree.splat` (CC0, Innerscene). See `assets/splats/LICENSE.md`.

```sh
npm run splats:tiles      # y-up tree, eight yawed tiles, src/splats/grove-manifest.ts
npm run splats:collider  # public/splats/tree.voxel.json and tree.collision.glb
npm run splats:lod       # chunked .RAD tiles, then points the manifest at them
npm run splats:rebuild   # all three, in that order
```

`splats:collider` runs PlayCanvas `splat-transform`:

```sh
splat-transform public/splats/tree.ply public/splats/tree.voxel.json \
  --collision-mesh smooth --voxel-size 0.3
```

Voxelization needs a GPU. With no hardware adapter the script retries on lavapipe (`--gpu-backend vulkan`). One mesh is built for the unrotated tree and instanced, with the tile's yaw, for every resident tile. `splat-transform` writes that mesh in its engine space, a 180° roll from the PLY axes, so the loader negates X and Y before handing it to Rapier. The wireframe is the same mesh.

`splats:lod` needs Spark's `build-lod` binary, which is not in the npm package:

```sh
git clone --branch v2.4.0 https://github.com/sparkjsdev/spark.git
cargo build --release --manifest-path spark/rust/build-lod/Cargo.toml
SPARK_BUILD_LOD=spark/rust/target/release/build-lod npm run splats:lod
```

The flags are the documented quick tree and chunked output: `--quick --rad-chunked --max-sh=0`. Each tile becomes `c0r0-lod.rad` plus `c0r0-lod-0.radc` (and the same for the other seven). The page loads the `.rad` header with `paged: true`. Spark fetches the `.radc` chunks. Tiles outside the unload radius are disposed, collider included, which is what keeps a far tree out of memory. The chunk pager only covers tiles that are resident.

### Known limits

- Pop-in. A tile appears when its mesh has initialized, and it becomes solid at the same time. There is no fade.
- The collider is the whole canopy, voxelized at 0.3 m, not a trunk you can walk under. Depth occlusion uses that same mesh, so a few leaf pixels outside it draw in front of the world.
- Baked splat color, no fog, and no bloom or FXAA while `?splats=1` is set.
- The character is a kinematic capsule (Rapier). It walks the ground, the river bank, the water surface, and the existing solid props. If the capsule falls off the world it returns to the grove.
- Level of detail also biases with distance (`lodScale`, and `lodRenderScale` 1.5 on the renderer) so a resident tile gets coarser as you leave it, before it unloads.
