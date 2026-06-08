import { describe, it, expect } from "vitest";
import { assignClaim } from "./claim";
import { buildState } from "./state";
import type { Layout, Unit } from "./types";

const ind = (id: string): Unit => ({ id, kind: "individual", memberIds: [id] });
const pair = (id: string): Unit => ({ id, kind: "pair", memberIds: [`${id}a`, `${id}b`] });

function makeState(groups: { id: string; units: Unit[] }[]) {
  const units = groups.flatMap((g) => g.units);
  const layout: Layout = {
    groups: groups.map((g) => ({ id: g.id, unitIds: g.units.map((u) => u.id) })),
  };
  return buildState(layout, units);
}

describe("assignClaim - own group first", () => {
  it("assigns the buyer's own group before anyone else", () => {
    const state = makeState([
      { id: "g1", units: [ind("a"), ind("b"), ind("c")] },
      { id: "g2", units: [ind("d"), ind("e"), ind("f")] },
    ]);
    const result = assignClaim(state, "a");
    // g1 has only 3 members; top-up pulls from g2 in order until 6 slots filled.
    expect(result.unitIds).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(result.memberIds).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("locks the assigned units in the returned state without mutating the input", () => {
    const state = makeState([{ id: "g1", units: [ind("a"), ind("b")] }]);
    const result = assignClaim(state, "a");
    expect(result.state.coverage["a"]).toBe("locked");
    expect(result.state.coverage["b"]).toBe("locked");
    expect(result.state.lockOwner["a"]).toBe("a");
    expect(state.coverage["a"]).toBe("uncovered");
  });

  it("throws for an unknown buyer", () => {
    const state = makeState([{ id: "g1", units: [ind("a")] }]);
    expect(() => assignClaim(state, "zzz")).toThrow("unknown buyer");
  });
});

describe("assignClaim - pairs and leftover slots", () => {
  it("assigns a pair as a single unit (both members together)", () => {
    const state = makeState([{ id: "g1", units: [ind("a"), pair("P")] }]);
    const result = assignClaim(state, "a");
    expect(result.unitIds).toEqual(["a", "P"]);
    expect(result.memberIds).toEqual(["a", "Pa", "Pb"]);
  });

  it("skips a pair when only one slot remains and takes the next individual", () => {
    const state = makeState([
      { id: "g1", units: [ind("a"), ind("b"), ind("c"), ind("d"), ind("e")] },
      { id: "g2", units: [pair("P"), ind("z")] },
    ]);
    const result = assignClaim(state, "a");
    expect(result.unitIds).toEqual(["a", "b", "c", "d", "e", "z"]);
    expect(result.state.coverage["P"]).toBe("uncovered"); // pair untouched
  });

  it("skips covered and locked units", () => {
    const state = makeState([{ id: "g1", units: [ind("a"), ind("b"), ind("c")] }]);
    state.coverage["b"] = "covered";
    state.coverage["c"] = "locked";
    const result = assignClaim(state, "a");
    expect(result.unitIds).toEqual(["a"]);
  });
});
