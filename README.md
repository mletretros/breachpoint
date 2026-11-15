# Breachpoint — VANTA vs HALO on Cinder Yard

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/mletretros/breachpoint/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/mletretros/breachpoint/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

A round-based tactical first-person shooter built with three.js 0.187.0, entered in
[make.fun's "Make the best three.js tactical FPS" bounty](https://make.fun/bounty/threejs-fps-02).
A short attacking side, VANTA, tries to plant a breach charge on site B7; a defending side,
HALO, holds the lane and the site. Buy phase, then six rounds, first to four.

Everything is procedural: geometry, materials, canvas textures and Web Audio voices. The game
loads nothing over the network — no CDN, no fonts, no image or audio files.

## Run it

```bash
node serve.ts            # static server on http://127.0.0.1:8080
```

Then open `http://127.0.0.1:8080/game/`. Any static server works, e.g.
`python3 -m http.server 8080 --directory game`.

Package the entry the way the grader does:

```bash
MAKEFUN_OUTPUT_DIR=out node main.ts
```

That copies `game/` and `screenshots/` into `out/` and writes `out/dossier.json`, refusing to
package a build that breaks any of the caps: file count and bytes under `game/`, the single
import map in `game/index.html`, and no off-disk reference in any shipped source file.

## Controls

| Key | Action |
| --- | --- |
| `W A S D` | move |
| mouse | look |
| left click | fire |
| `R` | reload |
| `Shift` | walk (quiet) |
| `Space` | jump |
| `E` | plant / defuse at site B7 |
| `Tab` | scoreboard |
| `Esc` | pause |

## Layout

- `game/index.html` — the single import map and the canvas host.
- `game/src/` — the simulation: world, player, weapon, bots, match rules, HUD, audio, effects.
- `game/vendor/three/` — three.js 0.187.0, vendored byte for byte.
- `screenshots/` — the four captured frames the judge reads, in filename order.
- `main.ts` — the entrypoint that packages the entry.
- `scripts/` — capture and inspection helpers used while building.

## License

MIT. See [LICENSE](LICENSE).
