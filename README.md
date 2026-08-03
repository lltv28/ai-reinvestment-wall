# AI Reinvestment Wall

A hands-free 1920×1080 recording demo that combines the dense lead lattice, the AI flywheel, and the profit-to-ads motion loop.

The canvas starts wide, then tightly focuses on **AI Triagers**. A phone walks through the $17 assessment, personalized plan, and checkout. Each purchase lands on a square ad block, triggers a floating **+$8**, returns through **AI Triagers**, and finishes in the **AI Brain**. The approved sequence runs for 15 seconds and repeats after a short hold. Clicking the AI Triagers node restarts it immediately. Every other lattice node is locked during the demo.

## Run it

```bash
npm install
npm run dev -- -p 3010
```

Open `http://localhost:3010/lattice`.

## Motion sequence

1. 0–2s: focus AI Triagers and reveal the assessment
2. 2–7s: answer the assessment and generate a personalized plan
3. 7–9s: show the $17 checkout
4. 9–11s: five purchases reach their ad blocks
5. 11–13s: each ad block shows +$8 and returns it to AI Triagers
6. 13–15s: the combined value flows into the AI Brain

Timing and value calculations live in `lib/lattice/reinvestment.ts`. Canvas particles and paths live in `lib/lattice/CanvasRenderer.ts`.

## Production preview

```bash
npm run build
npm run start
```

The project statically exports to `out/` and deploys to GitHub Pages from `main`.

## Recording

Record from a visible, focused browser window at 1920×1080. Browser background throttling can pause canvas animation. The screenshot sweep is useful for layout checks, but the final motion should always be reviewed in a visible browser.
