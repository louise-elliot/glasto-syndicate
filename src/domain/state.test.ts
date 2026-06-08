import { describe, it, expect } from "vitest";
import { buildState } from "./state";
import type { Layout, Unit } from "./types";

const ind = (id: string): Unit => ({ id, kind: "individual", memberIds: [id] });
const pair = (id: string): Unit => ({ id, kind: "pair", memberIds: [`${id}a`, `${id}b`] });

describe("buildState", () => {
  it("derives the global order as group-sequence then within-group order", () => {
    const units = [ind("1"), ind("2"), pair("P"), ind("3")];
    const layout: Layout = {
      groups: [
        { id: "g1", unitIds: ["1", "2"] },
        { id: "g2", unitIds: ["P", "3"] },
      ],
    };
    const state = buildState(layout, units);
    expect(state.order).toEqual(["1", "2", "P", "3"]);
    expect(state.groupOf).toEqual({ "1": "g1", "2": "g1", P: "g2", "3": "g2" });
  });

  it("starts every unit uncovered and unlocked", () => {
    const units = [ind("1"), pair("P")];
    const layout: Layout = { groups: [{ id: "g1", unitIds: ["1", "P"] }] };
    const state = buildState(layout, units);
    expect(state.coverage).toEqual({ "1": "uncovered", P: "uncovered" });
    expect(state.lockOwner).toEqual({ "1": null, P: null });
  });
});
