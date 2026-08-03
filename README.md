# AI Reinvestment Wall

A hands-free 1920×1080 recording demo that combines the dense lead lattice, the AI flywheel, and the profit-to-ads motion loop.

The canvas starts wide, focuses on **AI Triagers**, collects payment particles from its outer lead nodes, routes the pooled profit into the **AI Brain**, reinvests it into **Ads**, and creates four new lead paths. The approved sequence runs for 15 seconds and repeats after a short wide-view hold. Clicking the AI Triagers node restarts it immediately.

## Run it

```bash
npm install
npm run dev -- -p 3010
```

Open `http://localhost:3010/lattice`.

## Motion sequence

1. 0–2s: focus AI Triagers
2. 2–7s: payments stream inward
3. 7–9s: captured profit pools
4. 9–11s: profit moves into the AI Brain
5. 11–13s: the AI Brain reinvests into Ads
6. 13–15s: four new lead paths appear

Timing and value calculations live in `lib/lattice/reinvestment.ts`. Canvas particles and paths live in `lib/lattice/CanvasRenderer.ts`.

## Production preview

```bash
npm run build
npm run start
```

The project statically exports to `out/` and deploys to GitHub Pages from `main`.

## Recording

Record from a visible, focused browser window at 1920×1080. Browser background throttling can pause canvas animation. The screenshot sweep is useful for layout checks, but the final motion should always be reviewed in a visible browser.
