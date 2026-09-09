# Assets research: Poly Haven HDRIs + chess piece models

Verified 2026-09-09 against the live Poly Haven API / CDN, live poly.pizza pages, and the installed
packages (`three@0.185.1`, `@types/three@0.185.4`, `@react-three/drei@10.7.8`). Everything below
that names a URL, byte count, prop or signature was checked directly; see "Source" notes.

TL;DR
- Five 1k CC0 `.hdr` files are **already downloaded** to `public/hdri/{study,space,park,arcade,minimal}.hdr`
  (md5-verified against the Poly Haven API). Total 7,256,091 bytes (6.92 MiB); each file < 1,572,864 bytes.
- **No CC0 chess GLB exists on Poly Pizza** (every chess hit is CC-BY 3.0; Sketchfab needs login). Nothing was
  downloaded into `public/models/`. Build pieces procedurally with `THREE.LatheGeometry` using the profiles in
  section B3 (plus an extruded knight head).

---

## A. Poly Haven HDRIs

### A1. Public API (verified with curl)

| Endpoint | Returns | Notes |
|---|---|---|
| `GET https://api.polyhaven.com/assets?t=hdris` | JSON object keyed by asset id (994 HDRIs on 2026-09-09) | Each value: `name, categories[], tags[], description, authors{}, max_resolution[w,h], date_published, thumbnail_url, download_count, ...`. ~1 MB response. |
| `GET https://api.polyhaven.com/info/<id>` | Same record for one asset | e.g. `/info/fireplace` |
| `GET https://api.polyhaven.com/files/<id>` | `{ hdri: { "1k": { hdr: {url,size,md5}, exr: {url,size,md5} }, "2k": ..., "4k": ..., "8k": ..., "16k": ... , ["20k"/"24k"] } }` | **1k is the smallest resolution served** for every asset checked (keys were `1k,2k,4k,8k,16k[,20k/24k]`). No 512 px tier exists. |

Direct download URL pattern (verified 200 for all five below):

```
https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/<id>_1k.hdr
https://dl.polyhaven.org/file/ph-assets/HDRIs/exr/1k/<id>_1k.exr
```

Gotchas found:
- `Content-Type` on dl.polyhaven.org is inconsistent (`application/octet-stream` for 4 files, `image/vnd.radiance` for `meadow_2`). drei picks the loader from the **file extension**, not the MIME type, so this does not matter (see A4).
- `Content-Length` header equals the API `size` field exactly; use the API to pre-filter instead of HEAD-ing hundreds of files.
- Almost every 1k `.hdr` is 1.5–1.9 MB. Out of ~300 candidates only ~70 are under the 1,572,864-byte cap (NFR-9). The 1k `.exr` is *sometimes* smaller (e.g. `cyclorama_hard_light` exr = 882,171 B vs hdr = 1,409,707 B) but for the newer 20k/24k-source assets the 1k `.exr` balloons to 5.5–6.2 MB (e.g. `kloppenheim_02_puresky` exr = 5,486,574 B). So `.exr` is not a reliable way to shrink; `.hdr` 1k is the safe choice.
- Licence: Poly Haven's licence page (`https://polyhaven.com/license`) states all assets are CC0 ("CC0 means absolute freedom"). No attribution required, but crediting the photographer is polite; authors are listed below.

### A2. Chosen presets (downloaded)

Files live at `public/hdri/<room>.hdr` and are served statically by Next.js at `/hdri/<room>.hdr`.

| Room (PRD FR-21i) | `players.roomPreset` | Poly Haven id | Source URL | Bytes | md5 (matches API) | Author(s) | Licence |
|---|---|---|---|---|---|---|---|
| Classic Study (warm indoor, wood) | `study` | `fireplace` | https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/fireplace_1k.hdr | 1,529,229 | `42ea9e4241d230a343955f4921b9ab30` | Greg Zaal | CC0 |
| Space (dark) | `space` | `qwantani_night_puresky` | https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/qwantani_night_puresky_1k.hdr | 1,389,258 | `e8691211295e505f77c8c3bdcf3055d9` | Greg Zaal (photo), Jarod Guest (processing) | CC0 |
| Park (outdoor daylight, greenery) | `park` | `meadow_2` | https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/meadow_2_1k.hdr | 1,552,993 | `7deac04bbf250f12a4daf1afaa6cab5f` | Sergej Majboroda | CC0 |
| Neon Arcade (dark, coloured lights) | `arcade` | `wooden_studio_10` | https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/wooden_studio_10_1k.hdr | 1,453,939 | `884fd235db23ab0c2e4424f7aad5c66e` | Alexander Scholten | CC0 |
| Minimal White (bright clean studio) | `minimal` | `white_studio_06` | https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/white_studio_06_1k.hdr | 1,330,672 | `d9950d6316c57b1b92494d909bd1a92a` | Grzegorz Wronkowski | CC0 |

Total: **7,256,091 bytes (6.92 MiB)**. All five are `#?RADIANCE` RGBE files, 1024x512, HTTP 200.

What each one looks like (checked against the Poly Haven thumbnails):
- `fireplace`: night lounge, amber lamps + fireplace glow, wood/brick, couch. High contrast. Reads as a study/den. Pair with a warm key light (`#ffd9a8`) and a polished-wood board material.
- `qwantani_night_puresky`: pure sky, clear low-contrast night, visible Milky Way, faint horizon glow, no ground/props. The darkest suitable sky Poly Haven has; there is **no true starfield HDRI**. Add drei `<Stars>` on top (A4) and consider `backgroundIntensity` 0.6–0.8 so the horizon glow does not read as "dawn". Board: dark glass/metal.
- `meadow_2`: bright morning/afternoon meadow clearing, clear blue sky, direct sun, trees all round. Strong natural key from the sun; a directional light at roughly the sun azimuth gives matching shadows. Board: light wood / stone.
- `wooden_studio_10`: dark studio, black floor, wooden ceiling, magenta + blue LED panels and a softbox. Reads as neon arcade once the board is glossy black with emissive square highlights in cyan/magenta.
- `white_studio_06`: bright white studio, big skylight, soft low-contrast natural light. Board: matte white/light grey, subtle reflections.

Runner-ups that also fit the size cap (all verified via `/files/<id>`; swap without re-researching):

| Room | id | 1k hdr bytes | Why |
|---|---|---|---|
| study | `warm_bar` | 1,487,340 | cosy pub, amber night light, wood |
| study | `lythwood_lounge` | 1,538,903 | warm hotel lounge, daytime |
| study | `brown_photostudio_06` | 1,569,967 | herringbone wood floor, warm sunlight through curtains (only 2.9 KB under the cap) |
| study | `christmas_photo_studio_05` | 1,513,182 | Victorian room with fireplace (has Christmas decor) |
| space | `kloppenheim_02_puresky` | 1,393,622 | clear night sky but with a bright moon bloom (less "space") |
| space | `qwantani_moon_noon_puresky` | 1,220,313 | smallest night sky; moonlit, high contrast |
| space | `qwantani_moonrise_puresky` | 1,272,812 | moonrise, cool blue |
| park | `bismarckturm` | 1,304,988 | grassy park with path, golden-hour low-contrast |
| park | `binnenalster` | 1,564,865 | overcast lakeside city park |
| park | `misty_dawn` / `spruit_sunrise` | 1,512,633 / 1,500,948 | field at dawn/sunrise |
| arcade | `ferndale_studio_05` | 1,373,092 | dark studio flooded pink/purple |
| arcade | `ferndale_studio_06` | 1,228,415 | dark studio, red/blue gels (smallest option) |
| arcade | `newman_lobby` | 1,534,472 | real magenta neon sign, glossy floor, but brighter/mall-like |
| arcade | `wooden_studio_09` | 1,516,235 | red/teal/blue LEDs, black floor |
| minimal | `cyclorama_hard_light` | 1,409,707 | white cyc, hard umbrella light (its 1k exr is only 882,171 B) |
| minimal | `white_studio_02` | 1,312,076 | white studio, low contrast |
| minimal | `story_studio_04` / `studio_wizja_01` | 1,368,186 / 1,359,911 | white infinity cove |

Rejected because 1k hdr > 1,572,864 B: `studio_small_09` (1,615,248), `neon_photostudio` (1,618,638), `moonless_golf` (1,672,754), `dikhololo_night` (1,745,132), `greenwich_park_02` (1,854,789), `comfy_cafe` (1,609,391), `brown_photostudio_01` (1,649,529), `rooitou_park` (1,588,504), `photo_studio_01` (1,597,273), `hotel_room` (1,572,830 - technically under by 34 bytes, too tight).

### A3. Size budget note

PRD risk section says "five presets should total under 6 MB". That is **not achievable with five 1k Radiance `.hdr` files** from Poly Haven: the smallest suitable ones are ~1.22-1.39 MB each, so the floor is ~6.3 MB. The hard NFR (NFR-9, < 1.5 MB per file, lazy-loaded) is met. Options if the total matters (none verified in-browser; see open questions):
1. Lazy-load only the active room's HDRI (PRD already requires lazy load + cache); the 7 MB total is never fetched at once.
2. Serve pre-compressed: RGBE is RLE-encoded so gzip/brotli helps only modestly (untested).
3. Use `cyclorama_hard_light_1k.exr` (882 KB) for the minimal room; drei loads `.exr` via `EXRLoader` (A4).

### A4. Using them with drei (verified against installed `@react-three/drei@10.7.8`)

`core/useEnvironment.js` picks the loader from the extension of the first entry in `files`
(`.hdr` -> `RGBELoader`, `.exr` -> `EXRLoader`, `.jpg/.jpeg` -> `HDRJPGLoader`, `.webp` (3 files incl. json) -> `GainMapLoader`, 6 files -> `CubeTextureLoader`). Query strings are stripped before the extension check, so cache-busting `?v=` is fine.

`EnvironmentProps` (from `core/Environment.d.ts`):
`files?: string | string[]`, `path?: string`, `preset?`, `background?: boolean | 'only'`, `blur?`, `backgroundBlurriness?`, `backgroundIntensity?`, `backgroundRotation?: Euler`, `environmentIntensity?`, `environmentRotation?: Euler`, `map?: Texture`, `scene?`, `ground?: boolean | {radius?, height?, scale?}`, `resolution?`, `frames?`, `near?`, `far?`, `colorSpace?`, `extensions?: (loader) => void`, `children?`.

`useEnvironment.preload({ files, path, ... })` and `useEnvironment.clear(...)` exist (`core/useEnvironment.d.ts` lines 12-13) - use `preload` when the settings drawer opens (FR-21m).

```tsx
// rooms.config.ts (FR-21n: single config file)
export const ROOMS = {
  study:   { hdri: '/hdri/study.hdr',   polyhaven: 'fireplace',              bgIntensity: 1.0, envIntensity: 1.0, stars: false },
  space:   { hdri: '/hdri/space.hdr',   polyhaven: 'qwantani_night_puresky', bgIntensity: 0.7, envIntensity: 0.6, stars: true  },
  park:    { hdri: '/hdri/park.hdr',    polyhaven: 'meadow_2',               bgIntensity: 1.0, envIntensity: 1.0, stars: false },
  arcade:  { hdri: '/hdri/arcade.hdr',  polyhaven: 'wooden_studio_10',       bgIntensity: 1.0, envIntensity: 1.2, stars: false },
  minimal: { hdri: '/hdri/minimal.hdr', polyhaven: 'white_studio_06',        bgIntensity: 1.0, envIntensity: 1.0, stars: false },
} as const;

// in the scene
import { Environment, Stars, useEnvironment } from '@react-three/drei';
<Environment files={room.hdri} background backgroundBlurriness={0.05}
             backgroundIntensity={room.bgIntensity} environmentIntensity={room.envIntensity} />
{room.stars && <Stars radius={100} depth={50} count={4000} factor={4} saturation={0} fade speed={0.5} />}

// preload all five when the drawer opens
Object.values(ROOMS).forEach(r => useEnvironment.preload({ files: r.hdri }));
```

`StarsProps` (verified `core/Stars.d.ts`): `radius?, depth?, count?, factor?, saturation?: number; fade?: boolean; speed?: number`. Component is `ForwardRefComponent<StarsProps, THREE.Points>`.

Note: `<Stars>` renders inside the scene at `radius` world units; with `background` from the HDRI the stars draw on top of the sky texture because the background is not depth-tested against scene geometry.

---

## B. Chess piece models

### B1. Poly Pizza search result: no CC0 chess set

Searched `https://poly.pizza/search/<q>` for `chess`, `chess piece`, `chess set`, `chessboard`, `chess king`, `pawn` and parsed the JSON embedded in each page (`{"id":..,"title":..,"publicID":..,"licence":..}`); also opened the individual model pages. Every chess-related asset is **CC-BY 3.0** (they are Google Poly imports):

| Title | Author | publicID | Licence (page) |
|---|---|---|---|
| Chess Set (full set, OBJ/GLTF) | Jarlan Perez | `00f9MZIwA1V` | CC-BY 3.0 (https://creativecommons.org/licenses/by/3.0/) |
| Chess Set | Pia Leung | `bfb3C6hpdi0` | CC-BY 3.0 |
| Chess King / Queen / Rook / Bishop / Knight / Pawn (singles) | Jarlan Perez | `4TP6oa34Fp-`, `0EE-Yj8eu2c`, `417Xec_xlU0`, `7xay8UYqePI`, `fMIykP6ncx7`, `0xRVhzfseb3` | CC-BY 3.0 |
| Knight chess piece / Pawn / Bishop | Poly by Google | `aW5HcCo0KZa`, `fXbCgbsujx4`, `79A3nqzZf56`, `0Iwry_4fNw0` | CC-BY 3.0 |
| Low Poly Chess - Queen / Rook | Leo Battle | `bn7Zks1cXFD`, `1qCABVTmJ_g` | CC-BY 3.0 |
| low poly chess knights | Thomas Saint Pierre | `373iD4phSZh` | CC-BY 3.0 |
| Chessboard / chessboard / Wood Checkboard / Classic Checkerboard | peter moore / Chris Braeuer / Jarlan Perez | `21bXFn9QEw9`, `8QlciymX0tY`, `cFejdg3fa2P`, `cGy_jtmd2Qf` | CC-BY 3.0 |

The only CC0 hits for those queries were unrelated (Cheese Block, Chest, Cutting Board, Modular Castle Kit, a "King" character). Sketchfab was skipped (downloads require login; no direct link). **Nothing was downloaded to `public/models/`.**

Poly Pizza direct-download pattern, for the record (verified on the Jarlan Perez set page; the model-viewer `src` attribute):
```
https://static.poly.pizza/<uuid>.glb        e.g. https://static.poly.pizza/7f50b401-9f06-40de-985d-d3a5f441ec26.glb
https://static.poly.pizza/<uuid>.glb.br     (brotli-compressed twin)
```
`curl -sI` on that GLB: HTTP 200, `content-type: binary/octet-stream`, `content-length: 436704` (427 KB). It is a viable **CC-BY** fallback if the team decides attribution ("Chess Set by Jarlan Perez, CC-BY 3.0, via poly.pizza") in the settings/about screen is acceptable. It was **not** downloaded because the brief requires CC0. Its internal mesh names were not inspected.

### B2. Decision: procedural Staunton-style pieces with `LatheGeometry`

`THREE.LatheGeometry` signature (verified `@types/three@0.185.4/src/geometries/LatheGeometry.d.ts` line 33):
```ts
new THREE.LatheGeometry(points?: Vector2[], segments?: number /* default 12 */, phiStart?: number /* 0 */, phiLength?: number /* 2*PI */)
```
`points[i].x` = radius (must be > 0 except at the very top/bottom where 0 closes the cap), `points[i].y` = height. Points must go bottom-to-top monotonically in y for sane normals; call `geometry.computeVertexNormals()` is not needed (LatheGeometry computes them) but use `segments >= 32` for smooth silhouettes and mark hard edges (collars) with duplicated y values.

Units below: **1 board square = 1.0 world unit**, origin at the piece base centre, +Y up. Base radii keep ~0.1 clearance to the square edge. Heights follow Staunton proportions (king ~1.7x square, pawn ~55% of king). Profiles are `[radius, height]` pairs, bottom to top; the last point is `[0, H]` to close the top. Duplicated heights create crisp rings/collars.

```ts
// pieces.profiles.ts - all numbers in board-square units
export type Profile = [radius: number, height: number][];

export const PAWN: Profile = [
  [0.00, 0.00], [0.30, 0.00], [0.30, 0.04], [0.26, 0.10],   // base disc + chamfer
  [0.18, 0.16], [0.14, 0.24], [0.11, 0.40], [0.10, 0.52],   // stem
  [0.16, 0.56], [0.16, 0.60], [0.12, 0.64],                 // collar
  [0.13, 0.68], [0.16, 0.76], [0.13, 0.86], [0.06, 0.93], [0.00, 0.95], // ball head
];  // H = 0.95

export const ROOK: Profile = [
  [0.00, 0.00], [0.34, 0.00], [0.34, 0.05], [0.29, 0.12],
  [0.22, 0.20], [0.20, 0.30], [0.19, 0.60], [0.20, 0.78],   // slightly waisted cylinder
  [0.26, 0.84], [0.27, 0.90], [0.27, 1.05],                 // battlement ring (outer wall)
  [0.19, 1.05], [0.19, 0.96], [0.00, 0.96],                 // hollow top (inner wall + floor)
];  // H = 1.05. Then subtract 4 crenel notches: 4 boxes (0.10 x 0.12 x 0.30) at y=1.05, rotated 0/90/180/270 deg,
    // either via CSG or by simply overlaying 4 thin box "merlons" on a plain top ring at r=0.27.

export const BISHOP: Profile = [
  [0.00, 0.00], [0.32, 0.00], [0.32, 0.05], [0.27, 0.12],
  [0.18, 0.20], [0.14, 0.30], [0.11, 0.55], [0.10, 0.70],
  [0.17, 0.74], [0.17, 0.78], [0.12, 0.82],                 // collar
  [0.15, 0.88], [0.19, 1.00], [0.16, 1.14], [0.09, 1.24],   // mitre (egg)
  [0.05, 1.28], [0.06, 1.31], [0.04, 1.36], [0.00, 1.38],   // small knob
];  // H = 1.38. Mitre slit: a thin box (0.02 x 0.16 x 0.40) subtracted or rendered as a dark inset strip at 30 deg.

export const QUEEN: Profile = [
  [0.00, 0.00], [0.36, 0.00], [0.36, 0.05], [0.31, 0.13],
  [0.21, 0.22], [0.16, 0.34], [0.12, 0.62], [0.11, 0.88],
  [0.19, 0.93], [0.19, 0.98], [0.14, 1.02],                 // collar
  [0.17, 1.08], [0.24, 1.20], [0.27, 1.32], [0.25, 1.40],   // crown cup
  [0.19, 1.40], [0.16, 1.34],                               // cup rim / inner lip
  [0.09, 1.42], [0.11, 1.48], [0.08, 1.54], [0.00, 1.57],   // orb
];  // H = 1.57. Add 8 small spheres (r=0.035) on the rim at r=0.245, y=1.40 for the crown points.

export const KING: Profile = [
  [0.00, 0.00], [0.38, 0.00], [0.38, 0.05], [0.33, 0.13],
  [0.22, 0.23], [0.17, 0.36], [0.13, 0.66], [0.12, 0.96],
  [0.20, 1.01], [0.20, 1.06], [0.15, 1.10],                 // collar
  [0.18, 1.16], [0.25, 1.28], [0.26, 1.40], [0.22, 1.46],   // flared crown
  [0.14, 1.48], [0.12, 1.52], [0.00, 1.54],                 // flat crown top
];  // H = 1.54 body; cross on top: two boxes 0.05 thick, vertical 0.06 x 0.22 and horizontal 0.16 x 0.06,
    // centred at y = 1.54 + 0.11  -> total height ~1.76.

// KNIGHT: lathe only the base/collar, then add an extruded head.
export const KNIGHT_BASE: Profile = [
  [0.00, 0.00], [0.33, 0.00], [0.33, 0.05], [0.28, 0.12], [0.22, 0.20], [0.20, 0.28], [0.22, 0.34], [0.00, 0.34],
];  // H = 0.34
// Knight head: THREE.ExtrudeGeometry of this 2D outline (x = forward/back, y = up), depth 0.22 (centered),
// bevelEnabled true, bevelThickness 0.02, bevelSize 0.02. Place at y = 0.34, facing +X for white, -X for black.
export const KNIGHT_HEAD_OUTLINE: [number, number][] = [
  [-0.16, 0.00], [ 0.16, 0.00],            // neck bottom
  [ 0.14, 0.30], [ 0.26, 0.42],            // chest -> muzzle underside
  [ 0.30, 0.52], [ 0.24, 0.60],            // nose
  [ 0.10, 0.62], [ 0.06, 0.70], [ 0.02, 0.80],  // forehead
  [ 0.04, 0.90], [-0.02, 0.88],            // ear
  [-0.10, 0.74], [-0.20, 0.60],            // mane top
  [-0.26, 0.42], [-0.22, 0.20],            // back of neck
];  // total knight height ~ 0.34 + 0.90 = 1.24
```

Height ladder (tallest to shortest): King 1.76, Queen 1.57, Bishop 1.38, Knight 1.24, Rook 1.05, Pawn 0.95 - the standard Staunton ordering. Suggested `segments`: 48 for king/queen, 40 for bishop/rook/pawn.

Build helper:
```ts
import * as THREE from 'three';
export function latheFromProfile(p: Profile, segments = 40) {
  return new THREE.LatheGeometry(p.map(([r, h]) => new THREE.Vector2(r, h)), segments);
}
```
Reuse one geometry per piece type (memoise with `useMemo`) and share two `MeshPhysicalMaterial`s (white/black) driven by the room's material preset (FR-26). Merge the extra parts (rook merlons, king cross, queen orbs, knight head) with `BufferGeometryUtils.mergeGeometries` from `three/examples/jsm/utils/BufferGeometryUtils.js` so each piece is one draw call, or keep them as child meshes under one `<group>` for simplicity.

---

## Unverified / open questions

1. Poly Pizza's official API docs (`https://poly.pizza/docs/api/v1.1`) are client-rendered; the page could not be read with WebFetch/curl, so the search-filter parameter for licence and any API key requirement are unverified. The licence field name in the page-embedded JSON is `licence` with values `"CC0 1.0"` / `"CC-BY 3.0"`.
2. Sketchfab was not searched (login required for downloads, per the brief). There may be CC0 chess sets there.
3. Whether brotli/gzip meaningfully shrinks the RLE-encoded `.hdr` files when served by Next.js/Vercel was not tested; the 7.26 MB total vs the PRD's soft "under 6 MB" note is therefore unresolved (the hard NFR-9 per-file cap is met).
4. In-browser rendering of the five files with drei `Environment` was not executed (no dev server in this task); the loader/extension logic was verified only by reading `@react-three/drei/core/useEnvironment.js`.
5. The lathe profiles are authored here from Staunton proportions, not copied from a reference model; they will need a visual pass (tweak radii/heights) once rendered.
6. Internal node/mesh names of the CC-BY Jarlan Perez GLB (`7f50b401-9f06-40de-985d-d3a5f441ec26.glb`) were not inspected because it was not downloaded.
