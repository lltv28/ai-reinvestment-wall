import { createRandom } from "./random";
import { buildLeadIdentities } from "./leads";
import { buildRepLabel, SALES_REPS } from "./salesReps";
import { AI_BRAIN_NODE_ID, AI_TRIAGER_NODE_ID } from "./reinvestment";
import { angleForIndex } from "./wheelLayout";
import type { WheelGraph, WheelLink, WheelNode } from "./types";

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

export const ZONE_COUNT = 6;
export const ICON_PER_ZONE = 11;
export const AI_TRIAGER_AD_COUNT = ICON_PER_ZONE;
export const TOTAL_ICON_COUNT = ZONE_COUNT * ICON_PER_ZONE;
export const AVATAR_COUNT = 96;
export const SATELLITE_PER_ICON = 2;

const ZONE_COLORS = ["#2E7D52", "#597267", "#718079", "#14201B", "#789484", "#426B58"];
const PERSON_COLORS = ["#2E7D52", "#4F6F62", "#719183", "#A47A58", "#355E4C"];

const LEAD_IDENTITIES = buildLeadIdentities(AVATAR_COUNT);

// Tighter, more evenly-graduated ring spacing to match the reference wheel's
// dense, close-packed rings (screenshot showed rings clustered much closer
// together than a wide even spread, with hub sized up relative to the ring
// dots and icon/avatar counts high enough to read as solid packed bands).
const RADIUS_FRACTIONS = {
  center: 0,
  hub: 0.26,
  gray: 0.4,
  gold: 0.5,
  icon: 0.66,
  avatar: 0.86,
} as const;

const NODE_PX_RADIUS = {
  center: 42,
  hub: 20,
  gray: 3,
  gold: 3,
  icon: 6,
  avatar: 6,
  satellite: 2,
} as const;

// Icon/avatar nodes fan out symmetrically around their hub's own spoke angle
// (not across the full zone slice starting at that angle) — the reference
// shows each ring descending along the same direction the hub points in,
// not skewed toward the next zone. FAN_FRACTION < 1 also leaves a visible
// gap between neighboring zones' fans.
const FAN_FRACTION = 0.85;

function angleWithinZone(zoneIndex: number, index: number, count: number): number {
  const zoneCenterAngle = angleForIndex(zoneIndex, ZONE_COUNT);
  const zoneAngleSpan = (Math.PI * 2) / ZONE_COUNT;
  const fanSpan = zoneAngleSpan * FAN_FRACTION;
  const withinFanFraction = (index + 0.5) / count;
  return zoneCenterAngle - fanSpan / 2 + withinFanFraction * fanSpan;
}

// The reference's rings aren't perfect circles — alternating nodes sit
// slightly nearer/farther from center, giving each ring a rough zigzag
// radius instead of a razor-even one.
const RING_JITTER = 0.015;

function jitteredRadiusFraction(base: number, index: number): number {
  return base + (index % 2 === 0 ? RING_JITTER : -RING_JITTER);
}

// Satellites orbit close to their parent icon node (a tiny halo, not another
// full ring), giving each icon a small sub-cluster instead of a flat dot.
const SATELLITE_RADIUS_OFFSET = 0.03;
const SATELLITE_ANGLE_OFFSET = 0.045;

// A sparse set of links between icon/avatar nodes in *different* zones, so
// the wheel reads as one interconnected web instead of six isolated fans.
const CROSS_ZONE_LINK_FRACTION = 0.06;
const CROSS_ZONE_LINK_ATTEMPTS = 40;

// Nodes with more links render slightly bigger, so ring dots aren't all a
// uniform size — capped so a busy node never balloons past 1.6x.
const DEGREE_SIZE_FACTOR = 0.05;
const DEGREE_SIZE_CAP = 0.6;
const DEGREE_SIZE_RINGS = new Set(["icon", "avatar", "satellite", "gray", "gold"]);

export function applyDegreeSizing(nodes: WheelNode[], links: WheelLink[]): void {
  const degree = new Map<string, number>();
  for (const link of links) {
    degree.set(link.sourceId, (degree.get(link.sourceId) ?? 0) + 1);
    degree.set(link.targetId, (degree.get(link.targetId) ?? 0) + 1);
  }
  for (const node of nodes) {
    if (!DEGREE_SIZE_RINGS.has(node.ring)) continue;
    const extra = Math.min(DEGREE_SIZE_CAP, (degree.get(node.id) ?? 0) * DEGREE_SIZE_FACTOR);
    node.radius = node.radius * (1 + extra);
  }
}

export function generateVault(input: {
  nodeCount: number;
  linkDensity: number;
  seed: number;
}): WheelGraph {
  const nodeCount = Math.round(clamp(input.nodeCount, 80, 400));
  const linkDensity = clamp(input.linkDensity, 0.02, 0.3);
  const random = createRandom(input.seed);

  const nodes: WheelNode[] = [];
  const links: WheelLink[] = [];
  const seen = new Set<string>();
  let linkIndex = 0;

  const addLink = (a: string, b: string): boolean => {
    if (a === b) return false;
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (seen.has(key)) return false;
    seen.add(key);
    links.push({ id: `link-${String(linkIndex).padStart(5, "0")}`, sourceId: a, targetId: b });
    linkIndex += 1;
    return true;
  };

  const center: WheelNode = {
    id: AI_BRAIN_NODE_ID,
    ring: "center",
    angle: 0,
    radiusFraction: RADIUS_FRACTIONS.center,
    radius: NODE_PX_RADIUS.center,
    color: "#14201b",
    label: "AI Brain",
  };
  nodes.push(center);

  const hubs: WheelNode[] = [];
  for (let zoneIndex = 0; zoneIndex < ZONE_COUNT; zoneIndex += 1) {
    const repName = SALES_REPS[(input.seed + zoneIndex) % SALES_REPS.length]!;
    const id = `hub-${zoneIndex}`;
    const isAiTriagers = id === AI_TRIAGER_NODE_ID;
    const hub: WheelNode = {
      id,
      ring: "hub",
      zoneIndex,
      angle: angleForIndex(zoneIndex, ZONE_COUNT),
      radiusFraction: RADIUS_FRACTIONS.hub,
      radius: isAiTriagers ? 28 : NODE_PX_RADIUS.hub,
      color: ZONE_COLORS[zoneIndex]!,
      label: isAiTriagers ? "AI Triagers" : buildRepLabel(repName),
    };
    hubs.push(hub);
    nodes.push(hub);
    addLink(center.id, hub.id);
  }

  const iconsByZone: WheelNode[][] = [];
  for (let zoneIndex = 0; zoneIndex < ZONE_COUNT; zoneIndex += 1) {
    const hub = hubs[zoneIndex]!;
    const zoneIcons: WheelNode[] = [];
    const iconCount = zoneIndex === 0 ? AI_TRIAGER_AD_COUNT : ICON_PER_ZONE;
    for (let i = 0; i < iconCount; i += 1) {
      const angle = angleWithinZone(zoneIndex, i, iconCount);
      const icon: WheelNode = {
        id: `icon-${zoneIndex}-${i}`,
        ring: "icon",
        zoneIndex,
        angle,
        radiusFraction: jitteredRadiusFraction(RADIUS_FRACTIONS.icon, i),
        radius: zoneIndex === 0 ? 7.5 : NODE_PX_RADIUS.icon,
        color: ZONE_COLORS[zoneIndex]!,
      };
      nodes.push(icon);
      zoneIcons.push(icon);
      addLink(hub.id, icon.id);

      for (let s = 0; s < SATELLITE_PER_ICON; s += 1) {
        const side = s % 2 === 0 ? 1 : -1;
        const satellite: WheelNode = {
          id: `satellite-${zoneIndex}-${i}-${s}`,
          ring: "satellite",
          zoneIndex,
          angle: icon.angle + side * SATELLITE_ANGLE_OFFSET,
          radiusFraction: icon.radiusFraction + SATELLITE_RADIUS_OFFSET,
          radius: NODE_PX_RADIUS.satellite,
          color: icon.color,
        };
        nodes.push(satellite);
        addLink(icon.id, satellite.id);
      }
    }
    iconsByZone.push(zoneIcons);
  }

  // Avatars cluster within their own hub's angular arc and spoke back to it,
  // same pattern as the icon ring — the reference shows each hub's team
  // photos fanning from that hub, not scattered around a zone-agnostic ring.
  const avatarsPerZone = AVATAR_COUNT / ZONE_COUNT;
  const avatarsByZone: WheelNode[][] = [];
  for (let zoneIndex = 0; zoneIndex < ZONE_COUNT; zoneIndex += 1) {
    const hub = hubs[zoneIndex]!;
    const zoneAvatars: WheelNode[] = [];
    for (let i = 0; i < avatarsPerZone; i += 1) {
      const angle = angleWithinZone(zoneIndex, i, avatarsPerZone);
      const personIndex = zoneIndex * avatarsPerZone + i;
      const identity = LEAD_IDENTITIES[personIndex]!;
      const avatar: WheelNode = {
        id: `avatar-${zoneIndex}-${i}`,
        ring: "avatar",
        zoneIndex,
        angle,
        radiusFraction: jitteredRadiusFraction(RADIUS_FRACTIONS.avatar, i),
        radius: NODE_PX_RADIUS.avatar,
        color: PERSON_COLORS[personIndex % PERSON_COLORS.length]!,
        initials: identity.initials,
        label: `Lead ${identity.leadNo}`,
        leadId: identity.id,
        closed: false,
      };
      nodes.push(avatar);
      zoneAvatars.push(avatar);
      addLink(hub.id, avatar.id);
    }
    avatarsByZone.push(zoneAvatars);
  }

  // Sparse cross-zone links: pick two different zones, one icon/avatar node
  // from each, and connect them, so the wheel reads as one interconnected
  // web instead of six isolated fans.
  const crossZonePool = [...iconsByZone, ...avatarsByZone];
  const crossZoneLinkCount = Math.round(
    (TOTAL_ICON_COUNT + AVATAR_COUNT) * CROSS_ZONE_LINK_FRACTION,
  );
  let crossZoneLinksMade = 0;
  let attempts = 0;
  while (crossZoneLinksMade < crossZoneLinkCount && attempts < crossZoneLinkCount * CROSS_ZONE_LINK_ATTEMPTS) {
    attempts += 1;
    const zoneA = Math.floor(random() * ZONE_COUNT);
    let zoneB = Math.floor(random() * ZONE_COUNT);
    if (zoneB === zoneA) zoneB = (zoneB + 1) % ZONE_COUNT;
    const poolA = crossZonePool[Math.floor(random() * crossZonePool.length)]!;
    const poolB = crossZonePool[Math.floor(random() * crossZonePool.length)]!;
    const nodeA = poolA.filter((node) => node.zoneIndex === zoneA)[Math.floor(random() * poolA.length)];
    const nodeB = poolB.filter((node) => node.zoneIndex === zoneB)[Math.floor(random() * poolB.length)];
    if (nodeA && nodeB && addLink(nodeA.id, nodeB.id)) crossZoneLinksMade += 1;
  }

  const grayCount = Math.ceil(nodeCount / 2);
  const goldCount = Math.floor(nodeCount / 2);
  const grayGoldNodes: WheelNode[] = [];
  for (let i = 0; i < grayCount; i += 1) {
    const node: WheelNode = {
      id: `gray-${i}`,
      ring: "gray",
      angle: angleForIndex(i, grayCount),
      radiusFraction: jitteredRadiusFraction(RADIUS_FRACTIONS.gray, i),
      radius: NODE_PX_RADIUS.gray,
      color: "#8fa098",
    };
    grayGoldNodes.push(node);
    nodes.push(node);
  }
  for (let i = 0; i < goldCount; i += 1) {
    const node: WheelNode = {
      id: `gold-${i}`,
      ring: "gold",
      angle: angleForIndex(i, goldCount),
      radiusFraction: jitteredRadiusFraction(RADIUS_FRACTIONS.gold, i),
      radius: NODE_PX_RADIUS.gold,
      color: "#d9a441",
    };
    grayGoldNodes.push(node);
    nodes.push(node);
  }

  const extra = Math.round((grayCount + goldCount) * linkDensity);
  for (let n = 0; n < extra; n += 1) {
    const a = grayGoldNodes[Math.floor(random() * grayGoldNodes.length)];
    const b = grayGoldNodes[Math.floor(random() * grayGoldNodes.length)];
    if (a && b) addLink(a.id, b.id);
  }

  applyDegreeSizing(nodes, links);

  return { nodes, links };
}
