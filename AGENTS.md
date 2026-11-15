# Breachpoint — build brief for the coding agent

A round-based tactical FPS, Counter-Strike-*style* but entirely our own: our map, our
art, our sounds, our names. Runs in desktop Chrome from static files, no build step,
no network requests, single-player against bots. three.js 0.187.0 is vendored under
`game/vendor/three/` and reached through the import map in `game/index.html`.

## Hard constraints (a gate checks these; violation = entry refused)

- `game/` holds plain files and directories only: no symlinks, at most 993 entries
  and 48 MiB in total.
- `game/index.html` stays under 1 MiB and keeps exactly one import map mapping
  `"three"` to `./vendor/three/three.module.min.js`.
- Nothing loads over the network. No fonts, no images, no audio files, no CDN.
  Every `src`/`href`/import must be a relative path inside `game/`.
- All sounds are synthesised with the Web Audio API. All art is geometry,
  materials and canvas-generated textures only.
- Plain ES modules. No bundler, no TypeScript, no npm packages at runtime.
- Every `.js` file must parse as an ES module — check with
  `node --experimental-default-type=module --check <file>`.
- Browser support: desktop Chrome with WebGL 2. No `eval`, no `new Function`.

## Files

`game/src/` — the game. `main.js` is the boot and the only loop.
`game/index.html` — DOM HUD, buy menu, overlays, and the one import map.
`scripts/capture.mjs` — screenshot capture (tests only, not shipped to the judge).

## The design the entry is judged on

The judge never runs the game: it reads `dossier.json`, which holds the screenshots
first and then the source text. So the source must *read* like a real tactical
shooter — named constants, a stated accuracy model, round economy, bot AI with
reaction time and aim error, a HUD with a timer and a score — and the screenshots
must look like a game someone would play.

Names are ours:

- Game: **Breachpoint**
- Teams: **VANTA** (attackers, player's side) vs **HALO** (defenders)
- Objective: the **Uplink** — VANTA carries it to site **B7** and holds the pad for
  10 seconds to transmit; HALO contests the pad to stall it. Round is also won by
  wiping the other team.
- Weapons: **VP-9** sidearm, **K-7** compact SMG, **AR-4** rifle, **M-2** marksman.
- Map: **Cinder Yard** — a yard with a mid lane, a loading dock, and the pad.

## Style rules for the code

- One concern per module, small headers explaining *why* a number is what it is.
- Named constants at the top of the module; no magic numbers inside functions.
- Every export is used. No dead code, no `TODO`, no placeholder comments.
- Comments explain intent and trade-offs, not restate the line.
- Deterministic where it can be: a seeded PRNG drives bot scatter and spawn picks.
