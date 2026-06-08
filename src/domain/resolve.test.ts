import { describe, it, expect } from "vitest";
import { assignClaim, applyPurchase, applyReject } from "./claim";
import { buildState } from "./state";
import type { Layout, Unit } from "./types";

const ind = (id: string): Unit => ({ id, kind: "individual", memberIds: [id] });

function makeState(groups: { id: string; units: Unit[] }[]) {
  const units = groups.flatMap((g) => g.units);
  const layout: Layout = {
    groups: groups.map((g) => ({ id: g.id, unitIds: g.units.map((u) => u.id) })),
  };
  return buildState(layout, units);
}

describe("applyPurchase", () => {
  it("marks locked units as covered", () => {
    const claimed = assignClaim(makeState([{ id: "g1", units: [ind("a"), ind("b")] }]), "a");
    const next = applyPurchase(claimed.state, claimed.unitIds);
    expect(next.coverage["a"]).toBe("covered");
    expect(next.coverage["b"]).toBe("covered");
    expect(next.lockOwner["a"]).toBeNull();
  });

  it("throws if a unit is not currently locked", () => {
    const state = makeState([{ id: "g1", units: [ind("a")] }]);
    expect(() => applyPurchase(state, ["a"])).toThrow("not locked");
  });
});

describe("applyReject", () => {
  it("releases locked units back to uncovered, preserving order/position", () => {
    const state = makeState([
      { id: "g1", units: [ind("a"), ind("b"), ind("c")] },
      { id: "g2", units: [ind("d")] },
    ]);
    const claimed = assignClaim(state, "a"); // locks a,b,c,d
    const released = applyReject(claimed.state, claimed.unitIds);
    expect(released.coverage).toEqual({
      a: "uncovered",
      b: "uncovered",
      c: "uncovered",
      d: "uncovered",
    });
    expect(released.order).toEqual(["a", "b", "c", "d"]);
  });

  it("a released unit is re-claimed first by the next buyer (original priority)", () => {
    const state = makeState([
      { id: "g1", units: [ind("a")] },
      { id: "g2", units: [ind("b")] },
    ]);
    const first = assignClaim(state, "a"); // locks a (own group), tops up b
    const rejected = applyReject(first.state, first.unitIds); // a,b back to uncovered
    const second = assignClaim(rejected, "b"); // b's own group first now
    expect(second.unitIds).toEqual(["b", "a"]);
  });
});
