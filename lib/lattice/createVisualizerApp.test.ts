import { describe, expect, it, vi } from "vitest";
import { nodePixelPosition } from "./CanvasRenderer";
import { createVisualizerApp } from "./createVisualizerApp";
import {
  AVATAR_COUNT,
  ICON_PER_ZONE,
  SATELLITE_PER_ICON,
  ZONE_COUNT,
} from "./generateVault";

describe("createVisualizerApp", () => {
  it("maps recording keyboard shortcuts", () => {
    const root = document.createElement("div");
    const actions: string[] = [];
    const app = createVisualizerApp(root, {
      rendererFactory: () => ({ render: vi.fn(), resize: vi.fn() }),
      onAction: (action) => actions.push(action),
    });

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "h" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "f" }));

    expect(actions).toEqual(["hide", "regenerate", "pause", "fullscreen"]);
    app.destroy();
  });

  it("ignores shortcuts while a control input has focus", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const actions: string[] = [];
    const app = createVisualizerApp(root, {
      rendererFactory: () => ({ render: vi.fn(), resize: vi.fn() }),
      onAction: (action) => actions.push(action),
    });

    const input = document.createElement("input");
    root.append(input);
    input.focus();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));

    expect(actions).toEqual([]);
    app.destroy();
    root.remove();
  });

  it("shows a plain-English message when canvas rendering is unavailable", () => {
    const root = document.createElement("div");
    const app = createVisualizerApp(root, {
      rendererFactory: () => {
        throw new Error(
          "This browser could not create a 2D canvas. Try a current version of Chrome or Edge.",
        );
      },
    });
    expect(root.textContent).toContain("Chrome or Edge");
    app.destroy();
  });

  it("renders the full graph immediately when grow is off", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const renderCalls: number[] = [];
    const app = createVisualizerApp(root, {
      rendererFactory: () => ({
        render: (graph) => renderCalls.push((graph as { nodes: unknown[] }).nodes.length),
        resize: vi.fn(),
      }),
    });

    const iconCount = ZONE_COUNT * ICON_PER_ZONE;
    const satelliteCount = iconCount * SATELLITE_PER_ICON;
    expect(renderCalls[0]).toBeGreaterThanOrEqual(
      1 + ZONE_COUNT + iconCount + satelliteCount + AVATAR_COUNT + 80,
    );
    app.destroy();
    root.remove();
  });

  it("ignores every clicked node except AI Triagers", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const renderCalls: (string | undefined)[] = [];
    const app = createVisualizerApp(root, {
      rendererFactory: () => ({
        render: (_graph, focusedNodeId) => {
          renderCalls.push(focusedNodeId as string | undefined);
        },
        resize: vi.fn(),
      }),
    });

    const canvas = root.querySelector<HTMLCanvasElement>(".visualizer-canvas")!;
    // jsdom's default canvas size is 300x150 (getBoundingClientRect returns
    // an all-zero rect in jsdom, so clientX/clientY map directly onto canvas
    // pixel coordinates). The center node always sits at exactly the canvas
    // center (150,75) regardless of seed, so a click there reliably hits it.
    canvas.dispatchEvent(new MouseEvent("click", { clientX: 150, clientY: 75, bubbles: true }));
    expect(renderCalls[renderCalls.length - 1]).toBeUndefined();

    app.destroy();
    root.remove();
  });

  it("ignores clicks that don't land on any node", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const renderCalls: (string | undefined)[] = [];
    const app = createVisualizerApp(root, {
      rendererFactory: () => ({
        render: (_graph, focusedNodeId) => {
          renderCalls.push(focusedNodeId as string | undefined);
        },
        resize: vi.fn(),
      }),
    });

    const canvas = root.querySelector<HTMLCanvasElement>(".visualizer-canvas")!;
    const callsBefore = renderCalls.length;
    // (299,149) is far outside the wheel entirely, nowhere near a node.
    canvas.dispatchEvent(new MouseEvent("click", { clientX: 299, clientY: 149, bubbles: true }));
    expect(renderCalls.length).toBe(callsBefore);

    app.destroy();
    root.remove();
  });

  it("focuses a node programmatically and reports its screen position", () => {
    const root = document.createElement("div");
    // jsdom has no 2D canvas context in this repo (no "canvas" npm package),
    // so the real CanvasRenderer always throws in tests, same as every other
    // test in this file — stub the renderer like the rest do.
    const app = createVisualizerApp(root, {
      rendererFactory: () => ({ render: vi.fn(), resize: vi.fn() }),
    });

    const leads = app.getLeadNodes();
    expect(leads.length).toBe(96);

    expect(app.getFocusScreenPosition()).toBeUndefined();

    app.focusNode(leads[0]!.id);
    const position = app.getFocusScreenPosition();
    expect(position).toBeDefined();
    expect(Number.isFinite(position!.x)).toBe(true);
    expect(Number.isFinite(position!.y)).toBe(true);

    app.focusNode(undefined);
    expect(app.getFocusScreenPosition()).toBeUndefined();

    app.destroy();
  });

  it("keeps getLeadNodes and getFocusScreenPosition in agreement: every lead node is focusable", () => {
    // Sanity check that every id getLeadNodes() hands back resolves to a
    // defined position once focused.
    //
    // KNOWN LIMITATION — this test cannot fail if getLeadNodes() regresses to
    // reading the unfiltered graph. It runs under the hardcoded VAULT_PRESET,
    // where growEnabled is false, so visibleGraph() returns every node and the
    // filtered and unfiltered reads are identical. The divergence only appears
    // with growEnabled: true, which no test can reach: VAULT_PRESET is applied
    // inside createVisualizerApp and VisualizerDependencies exposes only
    // rendererFactory and onAction, so there is no settings seam.
    //
    // Covering that case would mean adding a settings-injection point to
    // production code for a configuration this project never enables. That was
    // judged not worth it. If growEnabled ever becomes load-bearing, add the
    // seam and a real test with it.
    const root = document.createElement("div");
    const app = createVisualizerApp(root, {
      rendererFactory: () => ({ render: vi.fn(), resize: vi.fn() }),
    });

    const leads = app.getLeadNodes();
    expect(leads.length).toBeGreaterThan(0);
    for (const lead of leads) {
      app.focusNode(lead.id);
      expect(app.getFocusScreenPosition()).toBeDefined();
    }

    app.destroy();
  });

  it("getFocusSide reports undefined when nothing is focused and agrees with the node's world x otherwise", () => {
    // jsdom's default canvas size is 300x150 (see the click test above) since
    // this stub renderer's resize() is a no-op.
    const root = document.createElement("div");
    const app = createVisualizerApp(root, {
      rendererFactory: () => ({ render: vi.fn(), resize: vi.fn() }),
    });

    expect(app.getFocusSide()).toBeUndefined();

    for (const lead of app.getLeadNodes()) {
      app.focusNode(lead.id);
      const position = nodePixelPosition(lead, 300, 150);
      const expectedSide = position.x >= 150 ? "right" : "left";
      expect(app.getFocusSide()).toBe(expectedSide);
    }

    app.focusNode(undefined);
    expect(app.getFocusSide()).toBeUndefined();

    app.destroy();
  });

  it("getFocusedLeadId reports a lead's id, undefined for a focused hub, and undefined when nothing is focused", () => {
    const root = document.createElement("div");
    const app = createVisualizerApp(root, {
      rendererFactory: () => ({ render: vi.fn(), resize: vi.fn() }),
    });

    expect(app.getFocusedLeadId()).toBeUndefined();

    app.focusNode("hub-0");
    expect(app.getFocusedLeadId()).toBeUndefined();

    const lead = app.getLeadNodes()[0]!;
    app.focusNode(lead.id);
    expect(app.getFocusedLeadId()).toBe(lead.leadId);

    app.focusNode(undefined);
    expect(app.getFocusedLeadId()).toBeUndefined();

    app.destroy();
  });

  it("marks a lead node closed", () => {
    const root = document.createElement("div");
    const app = createVisualizerApp(root, {
      rendererFactory: () => ({ render: vi.fn(), resize: vi.fn() }),
    });
    const target = app.getLeadNodes()[3]!;

    expect(target.closed).toBe(false);
    app.markClosed(target.id);
    expect(app.getLeadNodes()[3]!.closed).toBe(true);

    app.destroy();
  });
});
