# Generated foreground flowers

Generated with the built-in image-generation tool, with transparent_background=true.
Original PNG alpha channels are preserved. Separate files:

- white-01.png — ivory white
- blue-01.png — pale cornflower blue
- pink-01.png — soft rose pink

Each file was generated separately with this exact prompt, substituting the color:

Create ONE isolated photorealistic {color} cosmos flower cutout for a layered WebGL water garden. Single open blossom, five to seven broad delicate organically irregular gently curved petals with fine veins, small golden yellow stamens in center, short slender green stem extending down-left, photographed from above at about 65 degrees. Warm sunlight from upper left, natural soft self-shadows inside the petals, realistic botanical detail. Blossom occupies 80 percent of a square frame with room for the short stem. Genuine transparent alpha background. No water, stones, ground, cast shadow outside the flower, checkerboard, labels, border, text or additional flowers. Output a separate PNG asset.

Scene placement, scale, rotation and references are in src/config/scene.js.

## Angled flower variants

Generated separately with the built-in image-generation tool, transparent_background=true:
white-angle.png, blue-side.png, pink-cup.png, purple-side.png.

Prompt for each:
One isolated photorealistic cosmos flower cutout, {orientation}. Fine delicate organic veined petals and small yellow stamens. A realistic small floating cut flower asset for a photographic water garden. Warm upper-left sunlight, gentle self-shadow, no exterior cast shadow. Entire flower and stem within frame, comfortable transparent margin, flower fills 75% of square image. True transparent alpha background, NO checkerboard, no surface, no water, no labels, no collage, no extra flowers. The distinctly angled side-facing orientation is essential; do not make a flat front-facing flower.

Orientations:
- white-angle: ivory white, angled three-quarter view, blossom tilted right, visible green stem diagonally down-left
- blue-side: pale blue, almost side profile trumpet-shaped cupped blossom pointing upper right, visible slender stem diagonally down-left
- pink-cup: soft pink, low side view open bowl-shaped blossom, petals reaching upward, slender stem extending downward
- purple-side: pale lavender purple, side profile cupped blossom pointing upper right, green stem diagonally down-left
