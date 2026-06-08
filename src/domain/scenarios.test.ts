import { describe, it, expect } from "vitest";
import { assignClaim, applyPurchase } from "./claim";
import { buildState } from "./state";
import type { Layout, SyndicateState, Unit } from "./types";

const ind = (id: string): Unit => ({ id, kind: "individual", memberIds: [id] });

function makeState(groups: { id: string; units: Unit[] }[]) {
  const units = groups.flatMap((g) => g.units);
  const layout: Layout = {
    groups: groups.map((g) => ({ id: g.id, unitIds: g.units.map((u) => u.id) })),
  };
  return buildState(layout, units);
}

function allCovered(state: SyndicateState): boolean {
  return Object.values(state.coverage).every((c) => c === "covered");
}

describe("repeat buys", () => {
  it("one buyer can cover the whole syndicate six at a time", () => {
    // 8 individuals across 2 groups; buyer 'a' is the only one who ever gets through.
    let state = makeState([
      { id: "g1", units: ["a", "b", "c", "d", "e", "f"].map(ind) },
      { id: "g2", units: ["g", "h"].map(ind) },
    ]);
    const first = assignClaim(state, "a");
    state = applyPurchase(first.state, first.unitIds); // covers a..f
    const second = assignClaim(state, "a"); // already covered, tops up g,h
    state = applyPurchase(second.state, second.unitIds);
    expect(allCovered(state)).toBe(true);
    expect(second.unitIds).toEqual(["g", "h"]);
  });
});

describe("termination", () => {
  it("returns an empty assignment when everyone is covered", () => {
    let state = makeState([{ id: "g1", units: [ind("a"), ind("b")] }]);
    const claim = assignClaim(state, "a");
    state = applyPurchase(claim.state, claim.unitIds);
    const again = assignClaim(state, "a");
    expect(again.unitIds).toEqual([]);
    expect(again.memberIds).toEqual([]);
  });
});

describe("concurrency (serialized) - no overlapping assignments", () => {
  it("two buyers applied in sequence never share a unit", () => {
    const state = makeState([
      { id: "g1", units: ["a", "b", "c", "d", "e", "f", "g"].map(ind) },
      { id: "g2", units: ["h", "i", "j"].map(ind) },
    ]);
    const first = assignClaim(state, "a");
    const second = assignClaim(first.state, "h");
    const overlap = first.unitIds.filter((u) => second.unitIds.includes(u));
    expect(overlap).toEqual([]);
  });
});
