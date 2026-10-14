# Keyspace

A responsive, dependency-free interactive keyboard study inspired by the supplied orange keyboard poster and physical keycap globe.

## Preview

Run `node server.mjs` from this directory, then open http://127.0.0.1:5180.

## Interactions

- Press physical keys or tap the visible keys for rotating color highlights. Highlights persist while a key is held and fade on release.
- Scroll, or use “Take it for a spin”, to gather the same key field into an ivory globe.
- Hold arrow keys, use the four on-screen arrow buttons, or drag the globe to rotate it.
- The top-right stage control and footer cue advance to the next scene, then return to the field after the typing scene.
- Continue scrolling past the globe to unfold the same keys into one keyboard beneath a typing exercise. The three stage controls cycle through the field, globe, and typing view.
- Type the shown passage using a physical keyboard, tap the drawn keys, or tap the text to use a phone keyboard. Correct letters turn dark, errors turn red, and Backspace corrects mistakes. Speed, accuracy, and elapsed time update live. Use ↻ for a new passage. Timing pauses when leaving the typing stage or switching away from the page.
- The final scene keeps its cream palette and centered passage, with a flat outlined keyboard beneath it. Separate live charts track errors per second and 5-second typing pace, highlighting pace drops in orange. Charts occupy the right margin on desktop and stack into a compact row on smaller screens.
- Key presses, key taps, and button clicks play a short synthesized mechanical click. The music-note button toggles sound.
- The bottom-right key trail stacks colored entries in press order, counts presses, and retains the latest 200 entries in a scrollable panel. The × button clears it. Held-key auto-repeat does not flood the trail. History stays only in memory for the current page.

Canvas projection draws individually shaded keycaps with perspective and depth sorting. All assets except optional Google Fonts are local. Font fallbacks allow offline use. Animation sleeps while idle; pixel density is capped at 2. Reduced-motion preferences disable scroll and rotation easing. Browser and operating-system shortcuts retain their normal behavior; reserved shortcuts may be intercepted before the page receives them.

The source is in `dist/` and needs no build step. `server.mjs` is only a local preview server.
