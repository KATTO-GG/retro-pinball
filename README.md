# Neon Nights — Retro Pinball

A small, self-contained browser pinball game with a neon, pseudo-3D arcade-table look. No build step or dependencies are required.

## Play

Open `index.html` in a modern browser, or enable GitHub Pages for this repository and visit the published site.

- **Launch:** Drag down on the plunger in the lower-right lane, then release. You can also drag from the lower part of the table.
- **Left flipper:** `A` or `←`
- **Right flipper:** `D` or `→`
- **Sound:** Use the sound button in the header.

Score is saved as a local high score in your browser. The game uses three balls per round and can be restarted by clicking the table after game over.

## Files

- `index.html` — game page and HUD
- `style.css` — responsive cabinet styling and CRT scanline effect
- `game.js` — canvas rendering, lightweight ball physics, controls, scoring, particles, and synthesized Web Audio effects

## Notes

The visual style is rendered on a 2D canvas with layered lighting and perspective cues, so it has a 3D arcade feel without requiring a graphics library. Sound effects are synthesized in-browser and start after the first user interaction.
