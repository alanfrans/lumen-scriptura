# Gaussian splat assets

## Toy tree

- Source file: `gsplat-toy-tree.splat`
- Derived files: `public/splats/tree.ply`, `public/splats/tiles/*.ply`, and any `*-lod.rad` / `*.radc` built from those tiles
- License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) (public domain)
- Author: Innerscene
- Source page: <https://www.innerscene.com/samples/SOURCES.md> (`gsplat-toy-tree.splat`)
- Download: <https://www.innerscene.com/samples/gsplat-toy-tree.splat>

Innerscene describes it as a toy tree on a mossy disc: 19,500 flat splats, antimatter15 `.splat`, stored in the usual 3D Gaussian Splatting y-down axes. No attribution is required. This repository keeps the credit anyway.

The grove tiles are that tree converted to y-up, scaled to about 4.8 m, and copied into 12 m cells west of the planted garden. Nothing else is mixed into the files. The PLY copies are build products (`npm run splats:tiles`) and are not committed. The viewer streams the chunked `.rad` files built from them.

The collision grid is produced by PlayCanvas `@playcanvas/splat-transform` (MIT). The splats are drawn by World Labs Spark, `@sparkjsdev/spark` (MIT).
