# A little shelter

Six-second silent loop at 736 × 920, preserving the supplied ink illustration.

The rain falls with a slight breeze. The two leaves sway around their stems, the mouse shivers in three short bursts, and droplets fall from the large leaf's tip. Each motion repeats continuously after six seconds.

## Preview

Run `npm run dev`, open the Studio URL printed by the command, and press Space to play. The loop control beside the playback speed repeats the animation.

## Export on Windows

Run `./render.ps1` in PowerShell. It locates the project-local FFmpeg and FFprobe encoders and exports `renders/rain-mouse.mp4` at 30fps.

## Edit

The drawing and motion live in `compositions/shelter-scene.html`. The root `index.html` mounts this scene in the Studio timeline. Local assets and their provenance are documented in `ASSETS.md`.

Checks: HyperFrames lint, runtime, layout, and motion checks pass with zero errors or warnings. Sampled frames were visually reviewed during development.
