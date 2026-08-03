import { normalizeSettings, VAULT_PRESET, type VisualSettings } from "./settings";
import { generateVault } from "./generateVault";
import { buildGrowthSchedule, type GrowthBatch } from "./growthSchedule";
import type { WheelGraph, WheelNode } from "./types";
import {
  AI_TRIAGER_NODE_ID,
  IDLE_REINVESTMENT_FRAME,
  REINVESTMENT_TIMING,
  reinvestmentFrame,
  type ReinvestmentFrame,
} from "./reinvestment";
import {
  asideCamera,
  CanvasRenderer,
  identityCamera,
  nodeIdAtPoint,
  nodePixelPosition,
  screenToWorld,
  triagerCamera,
  worldToScreen,
  type Camera,
  type CardSide,
} from "./CanvasRenderer";

export type VaultAction = "regenerate" | "pause" | "fullscreen" | "hide";

export interface VisualizerApp {
  destroy(): void;
  focusNode(nodeId: string | undefined): void;
  getFocusScreenPosition(): { x: number; y: number } | undefined;
  getFocusSide(): CardSide | undefined;
  getFocusedLeadId(): number | undefined;
  getLeadNodes(): WheelNode[];
  markClosed(nodeId: string): void;
  startReinvestment(): void;
  getReinvestmentSnapshot(): ReinvestmentFrame;
}

type Renderer = Pick<CanvasRenderer, "render" | "resize">;

export interface VisualizerDependencies {
  rendererFactory?: (canvas: HTMLCanvasElement) => Renderer;
  onAction?: (action: VaultAction) => void;
  onReinvestmentUpdate?: (frame: ReinvestmentFrame) => void;
}

function randomSeed(): number {
  const buffer = new Uint32Array(1);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(buffer);
    return buffer[0] ?? Date.now();
  }
  return Math.floor(Math.random() * 0xffffffff);
}

export function createVisualizerApp(
  root: HTMLElement,
  dependencies: VisualizerDependencies = {},
): VisualizerApp {
  root.innerHTML = "";

  const shell = document.createElement("div");
  shell.className = "visualizer-shell";
  const canvas = document.createElement("canvas");
  canvas.className = "visualizer-canvas";
  shell.append(canvas);
  root.append(shell);

  const settings: VisualSettings = normalizeSettings(VAULT_PRESET);
  let graph: WheelGraph = { nodes: [], links: [] };
  let revealedIds = new Set<string>();
  let focusedNodeId: string | undefined;
  // Persistent, continuously-eased camera (see frame()). Every frame it eases
  // toward targetCamera() — whatever that currently is — so zooming in,
  // zooming out, and panning directly between two focused nodes are all just
  // "ease toward the current target", with no separate instant-snap cases.
  let camera: Camera = identityCamera(1, 1);

  const initialWidth = root.clientWidth || window.innerWidth;
  const initialHeight = root.clientHeight || window.innerHeight;

  let renderer: Renderer;
  try {
    renderer = dependencies.rendererFactory
      ? dependencies.rendererFactory(canvas)
      : new CanvasRenderer(canvas);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The visualizer could not start.";
    root.innerHTML = `<section class="fatal-message" role="alert"><strong>The visualizer could not start.</strong><span>${message}</span></section>`;
    return {
      destroy(): void {},
      focusNode(): void {},
      getFocusScreenPosition(): undefined {
        return undefined;
      },
      getFocusSide(): undefined {
        return undefined;
      },
      getFocusedLeadId(): undefined {
        return undefined;
      },
      getLeadNodes(): WheelNode[] {
        return [];
      },
      markClosed(): void {},
      startReinvestment(): void {},
      getReinvestmentSnapshot(): ReinvestmentFrame {
        return IDLE_REINVESTMENT_FRAME;
      },
    };
  }
  renderer.resize(initialWidth, initialHeight);
  camera = identityCamera(initialWidth, initialHeight);

  let growthSchedule: GrowthBatch[] | null = null;
  let growthElapsedSeconds = 0;
  let nextGrowthBatchIndex = 0;
  let lastFrameTimeMs = performance.now();
  let paused = false;
  let reinvestmentCycle = 0;
  let reinvestmentStartedAtMs: number | undefined;
  let reinvestmentSnapshot = IDLE_REINVESTMENT_FRAME;
  let nextAutomaticReinvestmentMs = lastFrameTimeMs + 4_000;
  let lastPublishedReinvestmentKey = "";

  function visibleGraph(): WheelGraph {
    if (!growthSchedule) return graph;
    return {
      nodes: graph.nodes.filter((node) => revealedIds.has(node.id)),
      links: graph.links.filter(
        (link) => revealedIds.has(link.sourceId) && revealedIds.has(link.targetId),
      ),
    };
  }

  function findFocusedNode(): WheelNode | undefined {
    return focusedNodeId
      ? visibleGraph().nodes.find((node) => node.id === focusedNodeId)
      : undefined;
  }

  // Which half of the wheel the focused orb sits on, decided from its WORLD
  // position so this has no circular dependency on the camera it in turn
  // decides the target for. The quiz card goes on the same side the wheel is
  // then panned away from (see asideCamera), so the card and the panned-clear
  // space always land on the same side.
  function focusSideFor(node: WheelNode): CardSide {
    const position = nodePixelPosition(node, canvas.width, canvas.height);
    return position.x >= canvas.width / 2 ? "right" : "left";
  }

  function targetCamera(): Camera {
    const focusedNode = findFocusedNode();
    if (focusedNode) {
      if (focusedNode.id === AI_TRIAGER_NODE_ID) {
        return triagerCamera(canvas.width, canvas.height);
      }
      return asideCamera(canvas.width, canvas.height, focusSideFor(focusedNode));
    }
    return identityCamera(canvas.width, canvas.height);
  }

  function renderNow(): void {
    renderer.render(visibleGraph(), focusedNodeId, camera, reinvestmentSnapshot);
  }

  function publishReinvestment(force = false): void {
    const valueBucket = Math.floor(reinvestmentSnapshot.collectedUsd / 50);
    const key = `${reinvestmentSnapshot.phase}:${valueBucket}:${reinvestmentSnapshot.generatedLeads}:${reinvestmentSnapshot.cycle}`;
    if (!force && key === lastPublishedReinvestmentKey) return;
    lastPublishedReinvestmentKey = key;
    dependencies.onReinvestmentUpdate?.(reinvestmentSnapshot);
  }

  function startReinvestment(now = performance.now()): void {
    reinvestmentCycle += 1;
    reinvestmentStartedAtMs = now;
    reinvestmentSnapshot = reinvestmentFrame(0, reinvestmentCycle);
    focusedNodeId = AI_TRIAGER_NODE_ID;
    publishReinvestment(true);
    renderNow();
  }

  function startGraph(): void {
    const seed = randomSeed();
    const targetGraph = generateVault({
      nodeCount: settings.nodeCount,
      linkDensity: settings.linkDensity,
      seed,
    });
    graph = targetGraph;
    focusedNodeId = undefined;
    camera = identityCamera(canvas.width, canvas.height);

    const structuralIds = new Set(
      targetGraph.nodes
        .filter((node) => node.ring !== "gray" && node.ring !== "gold")
        .map((node) => node.id),
    );

    if (!settings.growEnabled) {
      growthSchedule = null;
      revealedIds = new Set(targetGraph.nodes.map((node) => node.id));
    } else {
      const growableNodes = targetGraph.nodes.filter(
        (node) => node.ring === "gray" || node.ring === "gold",
      );
      const growableIds = new Set(growableNodes.map((node) => node.id));
      const growableLinks = targetGraph.links.filter(
        (link) => growableIds.has(link.sourceId) && growableIds.has(link.targetId),
      );
      growthSchedule = buildGrowthSchedule(
        { nodes: growableNodes, links: growableLinks },
        { nodesPerBatch: settings.growNodesPerBatch, intervalSeconds: settings.growIntervalSeconds },
      );
      growthElapsedSeconds = 0;
      nextGrowthBatchIndex = 0;
      revealedIds = new Set(structuralIds);
    }

    renderNow();
  }

  startGraph();

  function handleAction(action: VaultAction): void {
    switch (action) {
      case "regenerate": {
        startGraph();
        break;
      }
      case "pause": {
        paused = !paused;
        break;
      }
      case "hide": {
        root.classList.toggle("recording-mode");
        break;
      }
      case "fullscreen": {
        toggleFullscreen();
        break;
      }
    }
  }

  function handleCanvasClick(event: MouseEvent): void {
    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    // Use whatever camera is actually on screen right now (mid-animation or
    // settled) so hit-testing stays correct even while a transition is
    // still easing.
    const worldPoint = screenToWorld(screenX, screenY, canvas.width, canvas.height, camera);

    const nodes = visibleGraph().nodes;
    const clickedId = nodeIdAtPoint(worldPoint.x, worldPoint.y, nodes, canvas.width, canvas.height);
    if (clickedId === AI_TRIAGER_NODE_ID) {
      startReinvestment();
    }
  }
  canvas.addEventListener("click", handleCanvasClick);

  function showFullscreenHint(): void {
    const hint = document.createElement("div");
    hint.className = "visualizer-hint";
    hint.setAttribute("role", "status");
    hint.textContent = "Fullscreen was blocked. Use your browser's fullscreen shortcut instead.";
    hint.style.position = "fixed";
    hint.style.bottom = "18px";
    hint.style.right = "18px";
    hint.style.zIndex = "30";
    hint.style.padding = "8px 12px";
    hint.style.borderRadius = "8px";
    hint.style.background = "rgba(255, 255, 255, 0.92)";
    hint.style.color = "rgba(20, 32, 27, 0.85)";
    hint.style.fontSize = "13px";
    root.append(hint);
    setTimeout(() => hint.remove(), 4000);
  }

  function toggleFullscreen(): void {
    if (!root.requestFullscreen) {
      showFullscreenHint();
      return;
    }
    root.requestFullscreen().catch(() => showFullscreenHint());
  }

  const KEY_ACTIONS: Record<string, VaultAction> = {
    h: "hide",
    H: "hide",
    r: "regenerate",
    R: "regenerate",
    " ": "pause",
    f: "fullscreen",
    F: "fullscreen",
  };

  function handleKeydown(event: KeyboardEvent): void {
    const target = (document.activeElement ?? event.target) as HTMLElement | null;
    if (target && ["INPUT", "BUTTON", "SELECT"].includes(target.tagName)) return;

    const action = KEY_ACTIONS[event.key];
    if (!action) return;

    handleAction(action);
    dependencies.onAction?.(action);
  }
  window.addEventListener("keydown", handleKeydown);

  let resizeObserver: ResizeObserver | undefined;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => {
      const width = root.clientWidth || window.innerWidth;
      const height = root.clientHeight || window.innerHeight;
      renderer.resize(width, height);
      renderNow();
    });
    resizeObserver.observe(root);
  }

  const CAMERA_EASE_TAU_MS = 160;
  const CAMERA_SETTLE_EPSILON = 0.002;

  let animationFrame = 0;
  function frame(): void {
    const now = performance.now();
    const deltaMs = now - lastFrameTimeMs;
    lastFrameTimeMs = now;

    let changed = false;

    if (reinvestmentStartedAtMs === undefined && now >= nextAutomaticReinvestmentMs) {
      startReinvestment(now);
      changed = true;
    }

    if (reinvestmentStartedAtMs !== undefined) {
      const elapsedMs = now - reinvestmentStartedAtMs;
      reinvestmentSnapshot = reinvestmentFrame(elapsedMs, reinvestmentCycle);
      publishReinvestment();
      changed = true;
      if (elapsedMs >= REINVESTMENT_TIMING.growEnd) {
        reinvestmentSnapshot = reinvestmentFrame(REINVESTMENT_TIMING.growEnd, reinvestmentCycle);
        reinvestmentStartedAtMs = undefined;
        focusedNodeId = AI_TRIAGER_NODE_ID;
        nextAutomaticReinvestmentMs = now + 5_000;
        publishReinvestment(true);
      }
    }

    if (!paused && growthSchedule) {
      growthElapsedSeconds += deltaMs / 1000;
      while (
        nextGrowthBatchIndex < growthSchedule.length &&
        growthSchedule[nextGrowthBatchIndex]!.fireAtSeconds <= growthElapsedSeconds
      ) {
        const batch = growthSchedule[nextGrowthBatchIndex]!;
        for (const node of batch.nodes) revealedIds.add(node.id);
        nextGrowthBatchIndex += 1;
        changed = true;
      }
    }

    const target = targetCamera();
    const remaining =
      Math.abs(target.scale - camera.scale) +
      Math.abs(target.lookAtX - camera.lookAtX) +
      Math.abs(target.lookAtY - camera.lookAtY);
    if (remaining > CAMERA_SETTLE_EPSILON) {
      const ease = 1 - Math.exp(-deltaMs / CAMERA_EASE_TAU_MS);
      camera = {
        scale: camera.scale + (target.scale - camera.scale) * ease,
        lookAtX: camera.lookAtX + (target.lookAtX - camera.lookAtX) * ease,
        lookAtY: camera.lookAtY + (target.lookAtY - camera.lookAtY) * ease,
      };
      changed = true;
    } else if (remaining > 0) {
      camera = target;
      changed = true;
    }

    if (changed) renderNow();
    animationFrame = requestAnimationFrame(frame);
  }
  animationFrame = requestAnimationFrame(frame);

  function focusNode(nodeId: string | undefined): void {
    focusedNodeId = nodeId;
    renderNow();
  }

  function getFocusScreenPosition(): { x: number; y: number } | undefined {
    if (focusedNodeId === undefined) return undefined;
    const node = visibleGraph().nodes.find((candidate) => candidate.id === focusedNodeId);
    if (!node) return undefined;
    const world = nodePixelPosition(node, canvas.width, canvas.height);
    return worldToScreen(world, canvas.width, canvas.height, camera);
  }

  function getFocusSide(): CardSide | undefined {
    const focusedNode = findFocusedNode();
    return focusedNode ? focusSideFor(focusedNode) : undefined;
  }

  function getFocusedLeadId(): number | undefined {
    const focusedNode = findFocusedNode();
    return focusedNode?.ring === "avatar" ? focusedNode.leadId : undefined;
  }

  function getLeadNodes(): WheelNode[] {
    return visibleGraph().nodes.filter((node) => node.ring === "avatar");
  }

  function markClosed(nodeId: string): void {
    const node = graph.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;
    node.closed = true;
    renderNow();
  }

  return {
    destroy(): void {
      cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("keydown", handleKeydown);
      canvas.removeEventListener("click", handleCanvasClick);
    },
    focusNode,
    getFocusScreenPosition,
    getFocusSide,
    getFocusedLeadId,
    getLeadNodes,
    markClosed,
    startReinvestment,
    getReinvestmentSnapshot(): ReinvestmentFrame {
      return reinvestmentSnapshot;
    },
  };
}
