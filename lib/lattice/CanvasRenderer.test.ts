import { describe, expect, it } from "vitest";
import {
  asideCamera,
  CanvasRenderer,
  identityCamera,
  neighborIds,
  nodeIdAtPoint,
  nodePixelPosition,
  screenToWorld,
  triagerCamera,
  worldToScreen,
  type Camera,
} from "./CanvasRenderer";
import { AI_BRAIN_NODE_ID, AI_TRIAGER_NODE_ID } from "./reinvestment";
import type { WheelGraph, WheelNode } from "./types";

describe("nodePixelPosition", () => {
  it("places a node at its angle/radiusFraction relative to canvas center", () => {
    const node: WheelNode = {
      id: "hub-0",
      ring: "hub",
      zoneIndex: 0,
      angle: 0,
      radiusFraction: 0.22,
      radius: 16,
      color: "#2f6df6",
    };
    const position = nodePixelPosition(node, 800, 600);
    // wheelRadius = 0.42*600 = 252; hub radius-from-center = 0.22*252 = 55.44
    expect(position.x).toBeCloseTo(400 + 55.44, 1);
    expect(position.y).toBeCloseTo(300, 1);
  });
});

describe("neighborIds", () => {
  const center: WheelNode = {
    id: "center",
    ring: "center",
    angle: 0,
    radiusFraction: 0,
    radius: 14,
    color: "#14201b",
  };
  const hub0: WheelNode = {
    id: "hub-0",
    ring: "hub",
    zoneIndex: 0,
    angle: 0,
    radiusFraction: 0.22,
    radius: 16,
    color: "#2f6df6",
  };
  const icon0: WheelNode = {
    id: "icon-0-0",
    ring: "icon",
    zoneIndex: 0,
    angle: 0.1,
    radiusFraction: 0.66,
    radius: 6,
    color: "#2f6df6",
  };
  const hub1: WheelNode = {
    id: "hub-1",
    ring: "hub",
    zoneIndex: 1,
    angle: 1,
    radiusFraction: 0.22,
    radius: 16,
    color: "#1f9d55",
  };
  const graph: WheelGraph = {
    nodes: [center, hub0, icon0, hub1],
    links: [
      { id: "l0", sourceId: "center", targetId: "hub-0" },
      { id: "l1", sourceId: "hub-0", targetId: "icon-0-0" },
      { id: "l2", sourceId: "center", targetId: "hub-1" },
    ],
  };

  it("includes the focused node itself and its direct neighbors, not further nodes", () => {
    const ids = neighborIds(graph, "hub-0");
    expect(ids).toEqual(new Set(["hub-0", "center", "icon-0-0"]));
    expect(ids.has("hub-1")).toBe(false);
  });

  it("finds neighbors regardless of which link direction the focused node is on", () => {
    const ids = neighborIds(graph, "icon-0-0");
    expect(ids).toEqual(new Set(["icon-0-0", "hub-0"]));
  });

  it("keeps a focused avatar's whole zone lit, not just its direct hub link", () => {
    const avatar0a: WheelNode = {
      id: "avatar-0-a",
      ring: "avatar",
      zoneIndex: 0,
      angle: 0.2,
      radiusFraction: 0.9,
      radius: 4,
      color: "#2f6df6",
    };
    const avatar0b: WheelNode = {
      id: "avatar-0-b",
      ring: "avatar",
      zoneIndex: 0,
      angle: 0.3,
      radiusFraction: 0.9,
      radius: 4,
      color: "#2f6df6",
    };
    const avatar1: WheelNode = {
      id: "avatar-1-a",
      ring: "avatar",
      zoneIndex: 1,
      angle: 1.2,
      radiusFraction: 0.9,
      radius: 4,
      color: "#1f9d55",
    };
    const zonedGraph: WheelGraph = {
      nodes: [center, hub0, icon0, hub1, avatar0a, avatar0b, avatar1],
      links: [
        ...graph.links,
        { id: "l3", sourceId: "hub-0", targetId: "avatar-0-a" },
        { id: "l4", sourceId: "hub-0", targetId: "avatar-0-b" },
        { id: "l5", sourceId: "hub-1", targetId: "avatar-1-a" },
      ],
    };

    const ids = neighborIds(zonedGraph, "avatar-0-a");
    // The focused avatar's own hub and every sibling avatar in its zone stay lit...
    expect(ids.has("hub-0")).toBe(true);
    expect(ids.has("avatar-0-b")).toBe(true);
    // ...but nothing from a different rep's zone does.
    expect(ids.has("hub-1")).toBe(false);
    expect(ids.has("avatar-1-a")).toBe(false);
  });

  it("keeps only the AI Triagers slice and AI Brain visible during the drill", () => {
    const otherHub: WheelNode = {
      id: "hub-3",
      ring: "hub",
      zoneIndex: 3,
      angle: Math.PI,
      radiusFraction: 0.26,
      radius: 28,
      color: "#14201b",
    };
    const triagers = { ...hub0, id: AI_TRIAGER_NODE_ID };
    const reinvestmentGraph: WheelGraph = {
      nodes: [center, triagers, otherHub],
      links: [{ id: "loop", sourceId: center.id, targetId: triagers.id }],
    };

    const ids = neighborIds(reinvestmentGraph, AI_TRIAGER_NODE_ID);
    expect(ids.has(AI_BRAIN_NODE_ID)).toBe(true);
    expect(ids.has(otherHub.id)).toBe(false);
  });
});

describe("nodeIdAtPoint", () => {
  const width = 800;
  const height = 600;
  const hub0: WheelNode = {
    id: "hub-0",
    ring: "hub",
    zoneIndex: 0,
    angle: 0,
    radiusFraction: 0.22,
    radius: 16,
    color: "#2f6df6",
  };
  const nodes = [hub0];

  it("returns the node's id when the point lands within its radius plus tolerance", () => {
    const position = nodePixelPosition(hub0, width, height);
    expect(nodeIdAtPoint(position.x, position.y, nodes, width, height)).toBe("hub-0");
    expect(nodeIdAtPoint(position.x + 18, position.y, nodes, width, height)).toBe("hub-0");
  });

  it("returns undefined when the point is far from every node", () => {
    expect(nodeIdAtPoint(0, 0, nodes, width, height)).toBeUndefined();
  });

  it("returns the closest node when candidates overlap", () => {
    const near: WheelNode = { ...hub0, id: "near", radiusFraction: 0.221 };
    const far: WheelNode = { ...hub0, id: "far", radiusFraction: 0.3 };
    const position = nodePixelPosition(near, width, height);
    expect(nodeIdAtPoint(position.x, position.y, [far, near], width, height)).toBe("near");
  });
});

describe("identityCamera / asideCamera", () => {
  it("identityCamera has no zoom and looks at canvas center", () => {
    const camera = identityCamera(800, 600);
    expect(camera.scale).toBeCloseTo(1);
    expect(camera.lookAtX).toBeCloseTo(400);
    expect(camera.lookAtY).toBeCloseTo(300);
  });

  it("asideCamera never zooms, on either side", () => {
    expect(asideCamera(1440, 1000, "right").scale).toBeCloseTo(1);
    expect(asideCamera(1440, 1000, "left").scale).toBeCloseTo(1);
  });

  it("pans the wheel's world center to screen x=500 when the card is on the right", () => {
    const camera = asideCamera(1440, 1000, "right");
    // targetCx = 1440 * (500/1440) = 500; lookAtX = width - targetCx = 940.
    expect(camera.lookAtX).toBeCloseTo(940);
    expect(camera.lookAtY).toBeCloseTo(500);
  });

  it("pans the wheel's world center to screen x=940 when the card is on the left", () => {
    const camera = asideCamera(1440, 1000, "left");
    // targetCx = 1440 * (940/1440) = 940; lookAtX = width - targetCx = 500.
    expect(camera.lookAtX).toBeCloseTo(500);
    expect(camera.lookAtY).toBeCloseTo(500);
  });

  it("expresses its targets as fractions of width, so they hold at other canvas sizes", () => {
    const camera = asideCamera(2880, 2000, "right");
    // targetCx = 2880 * (500/1440) = 1000; lookAtX = 2880 - 1000 = 1880.
    expect(camera.lookAtX).toBeCloseTo(1880);
    expect(camera.lookAtY).toBeCloseTo(1000);
  });

  it("zooms tightly into the AI Triagers slice", () => {
    const camera = triagerCamera(1920, 1080);
    expect(camera.scale).toBeCloseTo(1.45);
    expect(camera.lookAtX).toBeCloseTo(1311.724);
    expect(camera.lookAtY).toBeCloseTo(540);
    expect(worldToScreen({ x: 960, y: 540 }, 1920, 1080, camera).x).toBeCloseTo(450);
  });
});

describe("screenToWorld", () => {
  it("is the identity mapping under identityCamera", () => {
    const camera = identityCamera(800, 600);
    const world = screenToWorld(123, 45, 800, 600, camera);
    expect(world.x).toBeCloseTo(123);
    expect(world.y).toBeCloseTo(45);
  });

  it("maps the screen center back to the camera's look-at point", () => {
    const camera: Camera = { scale: 1.3, lookAtX: 455, lookAtY: 300 };
    const world = screenToWorld(400, 300, 800, 600, camera);
    expect(world.x).toBeCloseTo(455);
    expect(world.y).toBeCloseTo(300);
  });

  it("scales offsets from center by the inverse of the camera's scale", () => {
    const camera: Camera = { scale: 1.3, lookAtX: 0, lookAtY: 0 };
    const world = screenToWorld(400 + 36, 300, 800, 600, camera);
    expect(world.x).toBeCloseTo(36 / 1.3);
  });
});

describe("worldToScreen", () => {
  it("is the exact inverse of screenToWorld", () => {
    const camera: Camera = { scale: 1.3, lookAtX: 400, lookAtY: 250 };
    const world = screenToWorld(120, 340, 1600, 900, camera);
    const back = worldToScreen(world, 1600, 900, camera);
    expect(back.x).toBeCloseTo(120);
    expect(back.y).toBeCloseTo(340);
  });

  it("maps the identity camera look-at point to the canvas center", () => {
    const camera = identityCamera(1600, 900);
    const screen = worldToScreen({ x: 800, y: 450 }, 1600, 900, camera);
    expect(screen.x).toBeCloseTo(800);
    expect(screen.y).toBeCloseTo(450);
  });
});

describe("closed-state fill", () => {
  // Stub 2D context that records the fillStyle in effect at every fill()
  // call, so the tests observe the actual rendered color rather than just
  // asserting on the node object.
  function createFillTrackingContext(): { ctx: CanvasRenderingContext2D; fillCalls: string[] } {
    const fillCalls: string[] = [];
    const ctx = {
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      globalAlpha: 1,
      font: "",
      textAlign: "center",
      textBaseline: "middle",
      save: () => {},
      restore: () => {},
      translate: () => {},
      scale: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      arc: () => {},
      rect: () => {},
      fillRect: () => {},
      fillText: () => {},
      fill: () => {
        fillCalls.push(ctx.fillStyle as string);
      },
    } as unknown as CanvasRenderingContext2D;
    return { ctx, fillCalls };
  }

  function renderWithFillTracking(graph: WheelGraph): string[] {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    const { ctx, fillCalls } = createFillTrackingContext();
    canvas.getContext = (() => ctx) as unknown as typeof canvas.getContext;
    new CanvasRenderer(canvas).render(graph, undefined);
    return fillCalls;
  }

  it("fills a closed avatar (lead) node with the green closed-state color", () => {
    const avatar: WheelNode = {
      id: "avatar-0",
      ring: "avatar",
      angle: 0,
      radiusFraction: 0.8,
      radius: 10,
      color: "#2f6df6",
      closed: true,
    };
    const fillCalls = renderWithFillTracking({ nodes: [avatar], links: [] });
    expect(fillCalls).toEqual(["#1f9d55"]);
  });

  it("does not render a hub node green even when it carries closed: true", () => {
    const hub: WheelNode = {
      id: "hub-0",
      ring: "hub",
      zoneIndex: 0,
      angle: 0,
      radiusFraction: 0.22,
      radius: 16,
      color: "#2f6df6",
      closed: true,
    };
    const fillCalls = renderWithFillTracking({ nodes: [hub], links: [] });
    expect(fillCalls).toEqual(["#2f6df6"]);
  });
});

describe("focus dimming", () => {
  // The dim/highlight crossfade used to derive from how far the camera had
  // zoomed toward the old FOCUS_ZOOM. The drill camera now pans aside at a
  // constant scale of 1 instead of zooming (see asideCamera), so this checks
  // dimming is keyed off focusedNodeId directly and still fires even though
  // the camera passed in never deviates from scale 1.
  function createAlphaTrackingContext(): { ctx: CanvasRenderingContext2D; arcAlphas: number[] } {
    const arcAlphas: number[] = [];
    const ctx = {
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      globalAlpha: 1,
      font: "",
      textAlign: "center",
      textBaseline: "middle",
      save: () => {},
      restore: () => {},
      translate: () => {},
      scale: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      arc: () => {
        arcAlphas.push(ctx.globalAlpha as number);
      },
      rect: () => {},
      fillRect: () => {},
      fillText: () => {},
      fill: () => {},
    } as unknown as CanvasRenderingContext2D;
    return { ctx, arcAlphas };
  }

  it("dims a non-neighbor node to zero alpha once a node is focused, even at scale 1", () => {
    const focused: WheelNode = {
      id: "focused",
      ring: "avatar",
      angle: 0,
      radiusFraction: 0.5,
      radius: 5,
      color: "#2f6df6",
    };
    const other: WheelNode = {
      id: "other",
      ring: "avatar",
      angle: 2,
      radiusFraction: 0.5,
      radius: 5,
      color: "#2f6df6",
    };
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    const { ctx, arcAlphas } = createAlphaTrackingContext();
    canvas.getContext = (() => ctx) as unknown as typeof canvas.getContext;

    // A drill (asideCamera) camera: scale is 1, same as the identity camera.
    new CanvasRenderer(canvas).render(
      { nodes: [focused, other], links: [] },
      "focused",
      { scale: 1, lookAtX: 400, lookAtY: 300 },
    );

    // "other" is not in focused's neighbor set, so its full-detail arc draws
    // at 1 - focusStrength. If dimming still depended on camera.scale (which
    // never leaves 1 for either wide/pullback or a drill now), this would be
    // 1 (never dimmed) instead of 0.
    expect(arcAlphas).toContain(0);
  });

  it("does not dim anything when no node is focused", () => {
    const solo: WheelNode = {
      id: "solo",
      ring: "avatar",
      angle: 0,
      radiusFraction: 0.5,
      radius: 5,
      color: "#2f6df6",
    };
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    const { ctx, arcAlphas } = createAlphaTrackingContext();
    canvas.getContext = (() => ctx) as unknown as typeof canvas.getContext;

    new CanvasRenderer(canvas).render({ nodes: [solo], links: [] }, undefined);

    expect(arcAlphas).toEqual([1]);
  });
});
