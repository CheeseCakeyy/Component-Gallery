# No plan Society

A reference-inspired interactive paper calendar. Built with SVG, CSS and JavaScript, with no dependencies, remote assets or WebGL requirement.

Run `npm run dev` in this folder, then open http://127.0.0.1:5186. Run `npm test` for date logic checks. Serve this folder on any static host; no build required.

The character peeks through the selected weekday, with a different horizontal position each date. Choose a row, use the previous/next arrows, or click the date to choose one. Back to today resets the date. When viewing today, the calendar follows the local date across midnight. The character blinks and follows the pointer. Reduced motion disables the transition and decorative movement. Keyboard users can tab through all controls, and date changes are announced to screen readers.
