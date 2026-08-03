import type { WheelGraph, WheelNode } from "./types";
import { polarToCartesian, wheelRadiusFor } from "./wheelLayout";
import {
  AI_BRAIN_NODE_ID,
  AI_TRIAGER_NODE_ID,
  PAYMENT_PARTICLE_COUNT,
  PROFIT_PER_AD_USD,
  REINVESTMENT_TIMING,
  easeInOutCubic,
  triagerRevenueUsd,
  type ReinvestmentFrame,
} from "./reinvestment";

const PALETTE = {
  background: "#f7f8f7",
  edge: "rgba(20, 32, 27, 0.18)",
  centerText: "#f7f8f7",
  personText: "#f7f8f7",
  hubLabelText: "#14201b",
  faded: "rgba(20, 32, 27, 0.5)",
  flow: "#2E7D52",
};

const FADE_ALPHA = 0.12;
const FADE_NODE_RADIUS = 3;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

function interpolate(
  from: { x: number; y: number },
  to: { x: number; y: number },
  progress: number,
): { x: number; y: number } {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}

export interface Camera {
  scale: number;
  lookAtX: number;
  lookAtY: number;
}

// The un-focused view: no zoom, looking at canvas center. createVisualizerApp
// keeps a persistent Camera and eases it toward whichever of these two
// targets is current every frame, so switching *between* two focused nodes
// pans smoothly instead of snapping (there's no separate "just zoomed in"
// vs "just switched" case — it's always "ease the camera toward its
// current target").
export function identityCamera(width: number, height: number): Camera {
  return { scale: 1, lookAtX: width / 2, lookAtY: height / 2 };
}

export type CardSide = "left" | "right";

// The drill camera used to zoom in on the focused node (see git history for
// the old focusedCamera/FOCUS_ZOOM). It now instead pans the wheel aside so a
// quiz card can sit beside it with zero overlap, including the dimmed
// background nodes — the card is the magnifier now, not the camera. Panning
// keeps scale at 1: the target on-screen wheel center is expressed as a
// fraction of `width` (measured against the 1440px-wide reference column),
// then converted to a lookAt via the same width - target relationship
// worldToScreen uses, so it holds at any canvas size.
export function asideCamera(width: number, height: number, cardSide: CardSide): Camera {
  const targetCx = cardSide === "right" ? width * (500 / 1440) : width * (940 / 1440);
  return { scale: 1, lookAtX: width - targetCx, lookAtY: height / 2 };
}

export function triagerCamera(width: number, height: number): Camera {
  const scale = 1.45;
  const targetBrainX = width * (450 / 1920);
  return {
    scale,
    lookAtX: width / 2 + (width / 2 - targetBrainX) / scale,
    lookAtY: height / 2,
  };
}

export function nodePixelPosition(
  node: WheelNode,
  width: number,
  height: number,
): { x: number; y: number } {
  const centerX = width / 2;
  const centerY = height / 2;
  const wheelRadius = wheelRadiusFor(width, height);
  return polarToCartesian(centerX, centerY, node.angle, node.radiusFraction * wheelRadius);
}

// The focused node plus everything directly linked to it stay in full
// detail; everything else fades to a soft, undetailed shape (see
// drawFadedNode) instead of just a lower-opacity copy of itself.
export function neighborIds(graph: WheelGraph, focusedNodeId: string): Set<string> {
  const ids = new Set<string>([focusedNodeId]);
  for (const link of graph.links) {
    if (link.sourceId === focusedNodeId) ids.add(link.targetId);
    if (link.targetId === focusedNodeId) ids.add(link.sourceId);
  }
  // A lead links only to its hub, so direct neighbours alone leave the frame
  // almost empty. Keeping the focused node's whole zone lit is what makes a
  // drill read as "this rep's cluster", which is the point of the shot.
  const focused = graph.nodes.find((node) => node.id === focusedNodeId);
  if (focused?.zoneIndex !== undefined) {
    for (const node of graph.nodes) {
      if (node.zoneIndex === focused.zoneIndex) ids.add(node.id);
    }
  }
  // The AI Triagers drill is a complete loop, so its destination must remain
  // legible while the rest of the lattice fades. Keep Ads and its lead fan
  // lit alongside the focused triage cluster and AI Brain.
  if (focusedNodeId === AI_TRIAGER_NODE_ID) {
    for (const node of graph.nodes) {
      if (node.id === AI_BRAIN_NODE_ID || node.zoneIndex === 0) {
        ids.add(node.id);
      }
    }
  }
  return ids;
}

export function nodeIdAtPoint(
  pointX: number,
  pointY: number,
  nodes: WheelNode[],
  width: number,
  height: number,
  tolerancePx = 4,
): string | undefined {
  let closestId: string | undefined;
  let closestDistance = Infinity;
  for (const node of nodes) {
    const position = nodePixelPosition(node, width, height);
    const distance = Math.hypot(pointX - position.x, pointY - position.y);
    if (distance <= node.radius + tolerancePx && distance < closestDistance) {
      closestDistance = distance;
      closestId = node.id;
    }
  }
  return closestId;
}

// Inverse of the render()-time camera transform: translates a click's raw
// canvas coordinates back into the same space nodePixelPosition works in,
// using whatever camera state is actually on screen right now (not assuming
// fully zoomed), so hit-testing stays correct mid-animation too.
export function screenToWorld(
  screenX: number,
  screenY: number,
  width: number,
  height: number,
  camera: Camera,
): { x: number; y: number } {
  return {
    x: (screenX - width / 2) / camera.scale + camera.lookAtX,
    y: (screenY - height / 2) / camera.scale + camera.lookAtY,
  };
}

// The inverse of screenToWorld. The floating quiz card is a DOM element
// positioned in canvas-screen space, so it needs the focused node's position
// after the camera transform, not its layout position.
export function worldToScreen(
  world: { x: number; y: number },
  width: number,
  height: number,
  camera: Camera,
): { x: number; y: number } {
  return {
    x: (world.x - camera.lookAtX) * camera.scale + width / 2,
    y: (world.y - camera.lookAtY) * camera.scale + height / 2,
  };
}

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(private canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error(
        "This browser could not create a 2D canvas. Try a current version of Chrome or Edge.",
      );
    }
    this.ctx = context;
  }

  render(
    graph: WheelGraph,
    focusedNodeId: string | undefined,
    camera?: Camera,
    reinvestment?: ReinvestmentFrame,
  ): void {
    const { ctx, canvas } = this;
    const width = canvas.width;
    const height = canvas.height;
    const activeCamera = camera ?? identityCamera(width, height);
    // Drives the dim/highlight crossfade. This used to derive from how far
    // the (eased) camera had zoomed toward FOCUS_ZOOM, but the drill camera
    // now pans aside at a constant scale of 1 instead of zooming, so scale no
    // longer carries any focus signal — key it off focusedNodeId directly.
    const focusStrength = focusedNodeId !== undefined ? 1 : 0;

    ctx.fillStyle = PALETTE.background;
    ctx.fillRect(0, 0, width, height);

    const positionById = new Map(
      graph.nodes.map((node) => [node.id, nodePixelPosition(node, width, height)]),
    );
    const focusedIds = focusedNodeId ? neighborIds(graph, focusedNodeId) : undefined;

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(activeCamera.scale, activeCamera.scale);
    ctx.translate(-activeCamera.lookAtX, -activeCamera.lookAtY);

    ctx.lineWidth = 1;
    ctx.strokeStyle = PALETTE.edge;
    for (const link of graph.links) {
      const source = positionById.get(link.sourceId);
      const target = positionById.get(link.targetId);
      if (!source || !target) continue;
      const isNeighborLink = !focusedIds || (focusedIds.has(link.sourceId) && focusedIds.has(link.targetId));
      ctx.globalAlpha = isNeighborLink ? 1 : 1 - focusStrength;
      if (ctx.globalAlpha <= 0) continue;
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
    }

    if (reinvestment && reinvestment.phase !== "idle") {
      this.drawReinvestmentPaths(
        graph,
        positionById,
        reinvestment,
        width,
        height,
        activeCamera,
      );
      this.drawReinvestmentParticles(graph, positionById, width, height, reinvestment);
    }

    for (const node of graph.nodes) {
      const position = positionById.get(node.id);
      if (!position) continue;
      const isNeighbor = !focusedIds || focusedIds.has(node.id);
      if (isNeighbor) {
        ctx.globalAlpha = 1;
        this.drawNode(node, position);
      } else {
        // Crossfade: full detail fades out as the camera zooms in, while
        // the soft faded dot fades in at the same rate.
        ctx.globalAlpha = 1 - focusStrength;
        this.drawNode(node, position);
        this.drawFadedNode(position, focusStrength);
      }
    }
    if (reinvestment && reinvestment.phase !== "idle") {
      this.drawTriagerRevenue(positionById, reinvestment);
      this.drawTriagerLabel(graph, positionById, reinvestment);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawLineProgress(
    from: { x: number; y: number },
    to: { x: number; y: number },
    progress: number,
    alpha = 0.7,
    width = 2,
  ): void {
    const { ctx } = this;
    if (progress <= 0) return;
    const end = interpolate(from, to, clamp01(progress));
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = PALETTE.flow;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private drawReinvestmentPaths(
    graph: WheelGraph,
    positionById: Map<string, { x: number; y: number }>,
    frame: ReinvestmentFrame,
    width: number,
    height: number,
    camera: Camera,
  ): void {
    const triager = positionById.get(AI_TRIAGER_NODE_ID);
    const brain = positionById.get(AI_BRAIN_NODE_ID);
    if (!triager || !brain) return;

    const pairs = this.transactionPairs(graph, positionById);
    pairs.forEach((pair, index) => {
      const saleProgress =
        frame.elapsedMs < REINVESTMENT_TIMING.aggregateEnd
          ? 0
          : frame.elapsedMs >= REINVESTMENT_TIMING.brainEnd
            ? 1
            : clamp01((frame.phaseProgress - index * 0.1) / 0.56);
      const returnProgress =
        frame.elapsedMs < REINVESTMENT_TIMING.brainEnd
          ? 0
          : frame.elapsedMs >= REINVESTMENT_TIMING.adsEnd
            ? 1
            : clamp01((frame.phaseProgress - index * 0.09) / 0.6);
      this.drawLineProgress(pair.lead, pair.ad, easeInOutCubic(saleProgress), 0.34, 1.5);
      this.drawLineProgress(pair.ad, triager, easeInOutCubic(returnProgress), 0.55, 1.8);
    });

    const brainProgress =
      frame.elapsedMs < REINVESTMENT_TIMING.adsEnd
        ? 0
        : frame.elapsedMs >= REINVESTMENT_TIMING.growEnd
          ? 1
          : frame.phaseProgress;
    this.drawLineProgress(triager, brain, easeInOutCubic(brainProgress), 0.9, 3);

    const rlNode = graph.nodes.find(
      (node) => node.ring === "avatar" && node.zoneIndex === 0 && node.initials === "RL",
    );
    const rlPosition = rlNode ? positionById.get(rlNode.id) : undefined;
    const phoneProgress = clamp01(
      (frame.elapsedMs - REINVESTMENT_TIMING.phoneReveal) / 650,
    );
    if (rlPosition && phoneProgress > 0) {
      const rlScreen = worldToScreen(rlPosition, width, height, camera);
      const phoneAnchor = screenToWorld(
        width * (1128 / 1920),
        rlScreen.y,
        width,
        height,
        camera,
      );
      this.drawLineProgress(
        rlPosition,
        phoneAnchor,
        easeInOutCubic(phoneProgress),
        0.58,
        1.7,
      );
    }
  }

  private transactionPairs(
    graph: WheelGraph,
    positionById: Map<string, { x: number; y: number }>,
  ): Array<{ lead: { x: number; y: number }; ad: { x: number; y: number } }> {
    const leads = graph.nodes
      .filter((node) => node.ring === "avatar" && node.zoneIndex === 0)
      .sort((a, b) => a.angle - b.angle);
    const ads = graph.nodes
      .filter((node) => node.ring === "icon" && node.zoneIndex === 0)
      .sort((a, b) => a.angle - b.angle);

    return Array.from({ length: PAYMENT_PARTICLE_COUNT }, (_, index) => {
      const fraction = index / (PAYMENT_PARTICLE_COUNT - 1);
      const lead = leads[Math.round(fraction * (leads.length - 1))];
      const ad = ads[Math.round(fraction * (ads.length - 1))];
      if (!lead || !ad) return undefined;
      const leadPosition = positionById.get(lead.id);
      const adPosition = positionById.get(ad.id);
      return leadPosition && adPosition ? { lead: leadPosition, ad: adPosition } : undefined;
    }).filter(
      (pair): pair is { lead: { x: number; y: number }; ad: { x: number; y: number } } =>
        Boolean(pair),
    );
  }

  private drawParticle(
    from: { x: number; y: number },
    to: { x: number; y: number },
    progress: number,
    radius = 5,
  ): void {
    const { ctx } = this;
    if (progress <= 0 || progress >= 1) return;
    const eased = easeInOutCubic(progress);
    const point = interpolate(from, to, eased);
    const trailStart = interpolate(from, to, Math.max(0, eased - 0.12));

    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = PALETTE.flow;
    ctx.lineWidth = radius;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(trailStart.x, trailStart.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();

    ctx.globalAlpha = 0.1;
    ctx.fillStyle = PALETTE.flow;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius * 1.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawReinvestmentParticles(
    graph: WheelGraph,
    positionById: Map<string, { x: number; y: number }>,
    _width: number,
    _height: number,
    frame: ReinvestmentFrame,
  ): void {
    const { ctx } = this;
    const triager = positionById.get(AI_TRIAGER_NODE_ID);
    const brain = positionById.get(AI_BRAIN_NODE_ID);
    if (!triager || !brain) return;

    const pairs = this.transactionPairs(graph, positionById);
    if (frame.phase === "brain") {
      pairs.forEach((pair, index) => {
        const localProgress = clamp01((frame.phaseProgress - index * 0.1) / 0.56);
        this.drawParticle(pair.lead, pair.ad, localProgress, 4.6);
      });
    }

    if (frame.phase === "ads") {
      pairs.forEach((pair, index) => {
        const localProgress = clamp01((frame.phaseProgress - index * 0.09) / 0.6);
        this.drawParticle(pair.ad, triager, localProgress, 4.8);

        const floatProgress = clamp01((frame.phaseProgress - index * 0.09) / 0.5);
        if (floatProgress <= 0) return;
        const fade = 1 - clamp01((floatProgress - 0.68) / 0.32);
        ctx.globalAlpha = fade;
        ctx.fillStyle = PALETTE.flow;
        ctx.font = "700 14px Instrument Sans, Inter, ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`+$${PROFIT_PER_AD_USD}`, pair.ad.x, pair.ad.y - 20 - floatProgress * 15);
        ctx.globalAlpha = 1;
      });
    }

    if (frame.phase === "ads" || frame.phase === "grow") {
      const pulse = 0.5 + 0.5 * Math.sin(frame.elapsedMs / 160);
      ctx.globalAlpha = 0.08 + pulse * 0.09;
      ctx.fillStyle = PALETTE.flow;
      ctx.beginPath();
      ctx.arc(triager.x, triager.y, 38 + pulse * 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (frame.phase === "grow") {
      this.drawParticle(triager, brain, frame.phaseProgress, 6.5);
    }
  }

  private drawFadedNode(position: { x: number; y: number }, focusStrength: number): void {
    const { ctx } = this;
    ctx.globalAlpha = FADE_ALPHA * focusStrength;
    ctx.fillStyle = PALETTE.faded;
    ctx.beginPath();
    ctx.arc(position.x, position.y, FADE_NODE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private drawTriagerRevenue(
    positionById: Map<string, { x: number; y: number }>,
    frame: ReinvestmentFrame,
  ): void {
    const triager = positionById.get(AI_TRIAGER_NODE_ID);
    if (!triager) return;

    const { ctx } = this;
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 13px Instrument Sans, Inter, ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`$${triagerRevenueUsd(frame)}`, triager.x, triager.y + 0.5);
  }

  private drawTriagerLabel(
    graph: WheelGraph,
    positionById: Map<string, { x: number; y: number }>,
    frame: ReinvestmentFrame,
  ): void {
    const revealProgress = clamp01(
      (frame.elapsedMs - REINVESTMENT_TIMING.phoneReveal) / 450,
    );
    if (revealProgress <= 0) return;

    const triagerPositions = graph.nodes
      .filter((node) => node.ring === "avatar" && node.zoneIndex === 0)
      .map((node) => positionById.get(node.id))
      .filter((position): position is { x: number; y: number } => Boolean(position));
    if (triagerPositions.length === 0) return;

    const labelX =
      triagerPositions.reduce((sum, position) => sum + position.x, 0) /
      triagerPositions.length;
    const labelY = Math.min(...triagerPositions.map((position) => position.y)) - 32;
    const easedProgress = easeInOutCubic(revealProgress);
    const cardWidth = 116;
    const cardHeight = 34;

    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = easedProgress;
    ctx.translate(0, (1 - easedProgress) * 8);
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(20, 32, 27, 0.16)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 4;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(
        labelX - cardWidth / 2,
        labelY - cardHeight / 2,
        cardWidth,
        cardHeight,
        9,
      );
    } else {
      ctx.rect(
        labelX - cardWidth / 2,
        labelY - cardHeight / 2,
        cardWidth,
        cardHeight,
      );
    }
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = PALETTE.hubLabelText;
    ctx.font = "600 14px Instrument Sans, Inter, ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("AI Triagers", labelX, labelY);
    ctx.restore();
  }

  private drawNode(node: WheelNode, position: { x: number; y: number }): void {
    const { ctx } = this;

    if (node.ring === "center") {
      ctx.fillStyle = node.color;
      ctx.beginPath();
      ctx.arc(position.x, position.y, node.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.centerText;
      ctx.font = "600 18px Instrument Sans, Inter, ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("AI", position.x, position.y);
      if (node.label) {
        ctx.fillStyle = PALETTE.hubLabelText;
        ctx.font = "600 13px Instrument Sans, Inter, ui-sans-serif, system-ui, sans-serif";
        ctx.fillText(node.label, position.x, position.y + node.radius + 16);
      }
      return;
    }

    if (node.ring === "icon") {
      const size = node.radius * 2;
      ctx.fillStyle = node.color;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(position.x - node.radius, position.y - node.radius, size, size, 3);
      } else {
        ctx.rect(position.x - node.radius, position.y - node.radius, size, size);
      }
      ctx.fill();
      if (node.zoneIndex === 0) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "700 6px Instrument Sans, Inter, ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("AD", position.x, position.y + 0.5);
      }
      return;
    }

    if (node.ring === "hub" || node.ring === "avatar") {
      // Only lead (avatar) nodes ever turn green when closed — hubs are
      // sales reps, not leads, so this stays scoped to avatars even though
      // `closed` isn't otherwise restricted to that ring.
      const isClosedLead = node.ring === "avatar" && node.closed === true;
      ctx.fillStyle = isClosedLead ? "#1f9d55" : node.color;
      ctx.beginPath();
      ctx.arc(position.x, position.y, node.radius, 0, Math.PI * 2);
      ctx.fill();
      if (node.initials) {
        ctx.fillStyle = PALETTE.personText;
        ctx.font = `${Math.max(6, node.radius)}px Inter, ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(node.initials, position.x, position.y);
      }
      return;
    }

    ctx.fillStyle = node.color;
    ctx.beginPath();
    ctx.arc(position.x, position.y, node.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }
}
