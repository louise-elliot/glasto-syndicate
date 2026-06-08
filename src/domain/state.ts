import type { Coverage, Layout, MemberId, SyndicateState, Unit, UnitId } from "./types";

export function buildState(layout: Layout, units: Unit[]): SyndicateState {
  const unitMap: Record<UnitId, Unit> = {};
  for (const u of units) unitMap[u.id] = u;

  const order: UnitId[] = [];
  const groupOf: Record<UnitId, string> = {};
  const coverage: Record<UnitId, Coverage> = {};
  const lockOwner: Record<UnitId, MemberId | null> = {};

  for (const group of layout.groups) {
    for (const unitId of group.unitIds) {
      order.push(unitId);
      groupOf[unitId] = group.id;
      coverage[unitId] = "uncovered";
      lockOwner[unitId] = null;
    }
  }
  return { order, units: unitMap, groupOf, coverage, lockOwner };
}
