---
workflow: general-video
flow: automation
storyboard: no
message: "A little mouse shelters beneath a leaf in gently windblown rain."
aspect: "4:5"
length: 6
---

## Intent
Animate the supplied ink illustration: rain lines move, a little wind sways and dips the leaf, the mouse shivers. User approved the proposed HyperFrames/GSAP approach and short looping treatment by saying "lets do this then".

## Decisions
Six seconds, 736 by 920, 30fps, silent, seamless loop. Preserve original illustration geometry and photographed paper. No added text or scenes. Deliver MP4 and an editable local preview. These production defaults implement the accepted proposal.

## Assets
Original user image: assets/original.png. A built-in image generation edit creates a clean paper background. All visible ink subjects are clipped from the original photograph, not regenerated.

## Motion
Slow leaf sway anchored at its stem, small rain-induced tip dips. Intermittent subpixel mouse shivers, tiny ear motion. Thin hand-drawn rain strokes drift downward; shelter under leaf remains clear. Sine-wave-loop and deterministic particle motion drive a single paused GSAP timeline.
