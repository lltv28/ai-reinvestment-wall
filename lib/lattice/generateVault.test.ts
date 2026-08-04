import { describe, expect, it } from "vitest";
import {
  applyDegreeSizing,
  AI_TRIAGER_AD_COUNT,
  AVATAR_COUNT,
  generateVault,
  ICON_PER_ZONE,
  SATELLITE_PER_ICON,
  TOTAL_ICON_COUNT,
  ZONE_COUNT,
} from "./generateVault";
import { buildLeadIdentities } from "./leads";
import { AI_BRAIN_NODE_ID, AI_TRIAGER_NODE_ID } from "./reinvestment";
import type { WheelLink, WheelNode } from "./types";

describe("generateVault", () => {
  it("creates a graph with the fixed structural nodes plus nodeCount gray+gold nodes", () => {
    const graph = generateVault({ nodeCount: 150, linkDensity: 0.08, seed: 11 });
    expect(graph.nodes).toHaveLength(
      1 +
        ZONE_COUNT +
        TOTAL_ICON_COUNT * (1 + SATELLITE_PER_ICON) +
        AVATAR_COUNT +
        150,
    );
    const nodeIds = new Set(graph.nodes.map((node) => node.id));
    expect(
      graph.links.every((link) => nodeIds.has(link.sourceId) && nodeIds.has(link.targetId)),
    ).toBe(true);
  });

  it("has exactly one center node", () => {
    const graph = generateVault({ nodeCount: 80, linkDensity: 0.1, seed: 1 });
    expect(graph.nodes.filter((node) => node.ring === "center")).toHaveLength(1);
  });

  it("makes the AI Triagers revenue circle the same size as the AI Brain", () => {
    const graph = generateVault({ nodeCount: 80, linkDensity: 0.1, seed: 1 });
    const brain = graph.nodes.find((node) => node.id === AI_BRAIN_NODE_ID);
    const triagers = graph.nodes.find((node) => node.id === AI_TRIAGER_NODE_ID);

    expect(triagers?.radius).toBe(brain?.radius);
  });

  it("has exactly 6 hub nodes with distinct colors, distinct labels, and zone indexes 0-5", () => {
    const graph = generateVault({ nodeCount: 80, linkDensity: 0.1, seed: 1 });
    const hubs = graph.nodes.filter((node) => node.ring === "hub");
    expect(hubs).toHaveLength(ZONE_COUNT);
    expect(new Set(hubs.map((node) => node.color)).size).toBe(ZONE_COUNT);
    expect(new Set(hubs.map((node) => node.label)).size).toBe(ZONE_COUNT);
    expect(new Set(hubs.map((node) => node.zoneIndex))).toEqual(new Set([0, 1, 2, 3, 4, 5]));
  });

  it("uses exactly 11 square boxes in every zone", () => {
    const graph = generateVault({ nodeCount: 80, linkDensity: 0.1, seed: 1 });
    const hubs = graph.nodes.filter((node) => node.ring === "hub");
    const icons = graph.nodes.filter((node) => node.ring === "icon");
    expect(icons).toHaveLength(TOTAL_ICON_COUNT);
    expect(icons.filter((node) => node.zoneIndex === 0)).toHaveLength(AI_TRIAGER_AD_COUNT);
    for (let zoneIndex = 1; zoneIndex < ZONE_COUNT; zoneIndex += 1) {
      expect(icons.filter((node) => node.zoneIndex === zoneIndex)).toHaveLength(ICON_PER_ZONE);
    }
    for (const icon of icons) {
      const hub = hubs.find((h) => h.zoneIndex === icon.zoneIndex);
      expect(icon.color).toBe(hub?.color);
    }
  });

  it("has exactly AVATAR_COUNT avatar nodes, evenly split per zone, each with initials", () => {
    const graph = generateVault({ nodeCount: 80, linkDensity: 0.1, seed: 1 });
    const avatars = graph.nodes.filter((node) => node.ring === "avatar");
    expect(avatars).toHaveLength(AVATAR_COUNT);
    expect(
      avatars.every((node) => typeof node.initials === "string" && node.initials.length > 0),
    ).toBe(true);
    for (let zoneIndex = 0; zoneIndex < ZONE_COUNT; zoneIndex += 1) {
      expect(avatars.filter((node) => node.zoneIndex === zoneIndex)).toHaveLength(
        AVATAR_COUNT / ZONE_COUNT,
      );
    }
  });

  it("gives every icon node SATELLITE_PER_ICON satellite nodes linked to it, matching its zone color", () => {
    const graph = generateVault({ nodeCount: 80, linkDensity: 0.1, seed: 1 });
    const icons = graph.nodes.filter((node) => node.ring === "icon");
    const satellites = graph.nodes.filter((node) => node.ring === "satellite");
    expect(satellites).toHaveLength(TOTAL_ICON_COUNT * SATELLITE_PER_ICON);

    for (const icon of icons) {
      const satelliteLinks = graph.links.filter(
        (link) => link.sourceId === icon.id || link.targetId === icon.id,
      );
      const linkedSatelliteIds = satelliteLinks
        .map((link) => (link.sourceId === icon.id ? link.targetId : link.sourceId))
        .filter((id) => id.startsWith("satellite-"));
      expect(linkedSatelliteIds).toHaveLength(SATELLITE_PER_ICON);
      for (const satelliteId of linkedSatelliteIds) {
        const satellite = satellites.find((node) => node.id === satelliteId)!;
        expect(satellite.color).toBe(icon.color);
      }
    }
  });

  it("includes some links between icon/avatar nodes in different zones", () => {
    const graph = generateVault({ nodeCount: 80, linkDensity: 0.1, seed: 1 });
    const zoneIndexById = new Map(
      graph.nodes
        .filter((node) => node.zoneIndex !== undefined && (node.ring === "icon" || node.ring === "avatar"))
        .map((node) => [node.id, node.zoneIndex!]),
    );
    const crossZoneLinks = graph.links.filter((link) => {
      const zoneA = zoneIndexById.get(link.sourceId);
      const zoneB = zoneIndexById.get(link.targetId);
      return zoneA !== undefined && zoneB !== undefined && zoneA !== zoneB;
    });
    expect(crossZoneLinks.length).toBeGreaterThan(0);
  });

  it("splits nodeCount between gray and gold rings (gray gets the extra on an odd count)", () => {
    const graph = generateVault({ nodeCount: 151, linkDensity: 0.1, seed: 1 });
    expect(graph.nodes.filter((node) => node.ring === "gray")).toHaveLength(76);
    expect(graph.nodes.filter((node) => node.ring === "gold")).toHaveLength(75);
  });

  it("links the center to every hub, and every hub to its own icon and avatar nodes", () => {
    const graph = generateVault({ nodeCount: 80, linkDensity: 0.1, seed: 1 });
    const centerLinks = graph.links.filter(
      (link) => link.sourceId === "center" || link.targetId === "center",
    );
    expect(centerLinks).toHaveLength(ZONE_COUNT);
    const avatarsPerZone = AVATAR_COUNT / ZONE_COUNT;
    for (let zoneIndex = 0; zoneIndex < ZONE_COUNT; zoneIndex += 1) {
      const hubLinks = graph.links.filter(
        (link) => link.sourceId === `hub-${zoneIndex}` || link.targetId === `hub-${zoneIndex}`,
      );
      // 1 to center + its icon nodes + its avatar nodes
      const iconCount = zoneIndex === 0 ? AI_TRIAGER_AD_COUNT : ICON_PER_ZONE;
      expect(hubLinks).toHaveLength(1 + iconCount + avatarsPerZone);
    }
  });

  it("repeats the same graph for the same seed", () => {
    const first = generateVault({ nodeCount: 80, linkDensity: 0.1, seed: 4 });
    const second = generateVault({ nodeCount: 80, linkDensity: 0.1, seed: 4 });
    expect(second).toEqual(first);
  });

  it("produces a different graph for a different seed", () => {
    const first = generateVault({ nodeCount: 80, linkDensity: 0.1, seed: 4 });
    const second = generateVault({ nodeCount: 80, linkDensity: 0.1, seed: 5 });
    expect(second).not.toEqual(first);
  });

  it("assigns a distinct lead identity to every avatar node", () => {
    const graph = generateVault({ nodeCount: 150, linkDensity: 0.08, seed: 11 });
    const avatars = graph.nodes.filter((node) => node.ring === "avatar");
    const identities = buildLeadIdentities();

    expect(avatars).toHaveLength(identities.length);
    expect(new Set(avatars.map((node) => node.leadId)).size).toBe(identities.length);

    for (const node of avatars) {
      const identity = identities.find((lead) => lead.id === node.leadId);
      expect(identity).toBeDefined();
      expect(node.initials).toBe(identity!.initials);
      expect(node.label).toBe(`Lead ${identity!.leadNo}`);
    }
  });
});

describe("applyDegreeSizing", () => {
  it("grows a node's radius based on how many links touch it", () => {
    const busy: WheelNode = {
      id: "busy",
      ring: "icon",
      angle: 0,
      radiusFraction: 0.5,
      radius: 10,
      color: "#000",
    };
    const quiet: WheelNode = {
      id: "quiet",
      ring: "icon",
      angle: 0,
      radiusFraction: 0.5,
      radius: 10,
      color: "#000",
    };
    const other: WheelNode = {
      id: "other",
      ring: "icon",
      angle: 0,
      radiusFraction: 0.5,
      radius: 10,
      color: "#000",
    };
    const nodes = [busy, quiet, other];
    const links: WheelLink[] = [
      { id: "l0", sourceId: "busy", targetId: "other" },
      { id: "l1", sourceId: "busy", targetId: "quiet" },
    ];

    applyDegreeSizing(nodes, links);

    expect(busy.radius).toBeGreaterThan(quiet.radius);
    expect(quiet.radius).toBeGreaterThan(10);
  });

  it("leaves hub and center nodes untouched (they're sized for hierarchy, not degree)", () => {
    const hub: WheelNode = {
      id: "hub-0",
      ring: "hub",
      zoneIndex: 0,
      angle: 0,
      radiusFraction: 0.26,
      radius: 18,
      color: "#000",
    };
    const nodes = [hub];
    const links: WheelLink[] = Array.from({ length: 10 }, (_, i) => ({
      id: `l${i}`,
      sourceId: "hub-0",
      targetId: `icon-${i}`,
    }));

    applyDegreeSizing(nodes, links);

    expect(hub.radius).toBe(18);
  });

  it("caps the size bonus so a very busy node doesn't balloon past the cap", () => {
    const node: WheelNode = {
      id: "n",
      ring: "gray",
      angle: 0,
      radiusFraction: 0.4,
      radius: 3,
      color: "#000",
    };
    const links: WheelLink[] = Array.from({ length: 200 }, (_, i) => ({
      id: `l${i}`,
      sourceId: "n",
      targetId: `other-${i}`,
    }));

    applyDegreeSizing([node], links);

    expect(node.radius).toBeCloseTo(3 * 1.6);
  });
});
