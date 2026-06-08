import { describe, it, expect } from "vitest";
import { packInOrder, randomiseLayout, validateLayout } from "./layout";
import { MAX_GROUP_SIZE, unitSize, type Unit } from "./types";

const ind = (id: string): Unit => ({ id, kind: "individual", memberIds: [id] });
const pair = (id: string): Unit => ({
  id,
  kind: "pair",
  memberIds: [`${id}a`, `${id}b`],
});

describe("packInOrder", () => {
  it("packs individuals into groups of up to 6, preserving order", () => {
    const units = ["1", "2", "3", "4", "5", "6", "7"].map(ind);
    const layout = packInOrder(units);
    expect(layout.groups[0].unitIds).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(layout.groups[1].unitIds).toEqual(["7"]);
  });

  it("never splits a pair and closes a group at 5 when a pair will not fit", () => {
    const units = [ind("1"), ind("2"), ind("3"), ind("4"), ind("5"), pair("P")];
    const layout = packInOrder(units);
    expect(layout.groups[0].unitIds).toEqual(["1", "2", "3", "4", "5"]);
    expect(layout.groups[1].unitIds).toEqual(["P"]);
  });

  it("keeps a pair together within a group", () => {
    // P(2) + 1 + 2 + 3 + 4 = 6 slots, all one group
    const units = [pair("P"), ind("1"), ind("2"), ind("3"), ind("4")];
    const layout = packInOrder(units);
    expect(layout.groups).toHaveLength(1);
    expect(layout.groups[0].unitIds).toEqual(["P", "1", "2", "3", "4"]);
  });
});

// Deterministic RNG returning values from a fixed sequence (cycled).
function seededRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("validateLayout", () => {
  it("accepts a valid layout", () => {
    const units = [ind("1"), ind("2"), pair("P")];
    const layout = { groups: [{ id: "g1", unitIds: ["1", "2", "P"] }] };
    expect(validateLayout(layout, units)).toEqual([]);
  });

  it("rejects a group exceeding 6 slots", () => {
    const units = [ind("1"), ind("2"), ind("3"), ind("4"), ind("5"), pair("P")];
    const layout = { groups: [{ id: "g1", unitIds: ["1", "2", "3", "4", "5", "P"] }] };
    expect(validateLayout(layout, units)).toContain("group g1 exceeds 6 slots");
  });

  it("rejects a unit placed in no group", () => {
    const units = [ind("1"), ind("2")];
    const layout = { groups: [{ id: "g1", unitIds: ["1"] }] };
    expect(validateLayout(layout, units)).toContain("unit 2 is not assigned to a group");
  });

  it("rejects a unit placed in more than one group", () => {
    const units = [ind("1")];
    const layout = {
      groups: [
        { id: "g1", unitIds: ["1"] },
        { id: "g2", unitIds: ["1"] },
      ],
    };
    expect(validateLayout(layout, units)).toContain("unit 1 is assigned to multiple groups");
  });
});

describe("randomiseLayout", () => {
  it("places every unit exactly once", () => {
    const units = ["1", "2", "3"].map(ind).concat(pair("P"));
    const layout = randomiseLayout(units, seededRng([0.1, 0.7, 0.3, 0.9]));
    const placed = layout.groups.flatMap((g) => g.unitIds).sort();
    expect(placed).toEqual(["1", "2", "3", "P"]);
  });

  it("never exceeds 6 slots per group, whatever the shuffle", () => {
    const units = [pair("P1"), pair("P2"), ind("a"), ind("b"), ind("c"), pair("P3"), ind("d")];
    const layout = randomiseLayout(units, seededRng([0.5, 0.2, 0.8, 0.1, 0.4, 0.6]));
    const byId = new Map(units.map((u) => [u.id, u]));
    for (const g of layout.groups) {
      const slots = g.unitIds.reduce((n, id) => n + unitSize(byId.get(id)!), 0);
      expect(slots).toBeLessThanOrEqual(MAX_GROUP_SIZE);
    }
  });
});
