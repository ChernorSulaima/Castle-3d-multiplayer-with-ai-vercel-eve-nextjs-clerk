# Room backdrop attribution

These are the **skyboxes** the rooms are seen against: Poly Haven's tonemapped JPG
rendering of the same HDRIs that light the board from `public/hdri/`, downscaled and
re-compressed here. The `.hdr` files remain the light source; these are only looked at.

All four are **CC0** (<https://polyhaven.com/license>) — no attribution is required, and
the photographers are credited anyway.

| File | Poly Haven asset | Photographer | Shipped | Bytes |
|---|---|---|---|---|
| `study.jpg` | [`combination_room`](https://polyhaven.com/a/combination_room) | Sergej Majboroda | 3584x1792, JPEG q72 | 1,489,755 |
| `park.jpg` | [`meadow_2`](https://polyhaven.com/a/meadow_2) | Sergej Majboroda | 3072x1536, JPEG q70 | 1,546,531 |
| `arcade.jpg` | [`ferndale_studio_06`](https://polyhaven.com/a/ferndale_studio_06) | Dimitrios Savva, Greg Zaal | 4096x2048, JPEG q72 | 562,968 |
| `minimal.jpg` | [`white_studio_06`](https://polyhaven.com/a/white_studio_06) | Grzegorz Wronkowski | 4096x2048, JPEG q72 | 545,037 |

The Space room has no backdrop: it is a flat colour plus drei `<Stars>`.

Source files, before processing, from
`https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/<id>.jpg`
(8192x4096 each; md5 checked against `https://api.polyhaven.com/files/<id>` →
`tonemapped.md5`, tabulated in assets.md §A2b). Processing was two `sips` passes —
`-Z <width>`, then
`-s format jpeg -s formatOptions <q>`. Full provenance, the sizing rationale and the
three.js gotchas are in `docs/research/assets.md` §A2b; which way each room faces, and
why the Arcade asset changed, is §A2c; why the Study's asset changed, and the arc the
idle camera sweeps in each room, is §A2d.

The Study ships at 3584 rather than 4096 wide: `combination_room` is a high-entropy
photograph (an inlaid parquet floor fills most of the frame) and comes to 2,047,644 B at
4096 q72. 3584 q72 is 1,489,755 B, inside the same budget, with none of the blocking that
4096 at q55-q60 puts into the room's flat plaster.
