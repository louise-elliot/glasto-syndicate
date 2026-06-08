export type MemberId = string;
export type UnitId = string;
export type GroupId = string;

export interface Member {
  id: MemberId;
  firstName: string;
  lastName: string;
  registrationNumber: string;
  postcode: string;
}

export type UnitKind = "individual" | "pair";

/** A pair is ONE indivisible unit of size 2. Individuals are size 1. */
export interface Unit {
  id: UnitId;
  kind: UnitKind;
  memberIds: MemberId[]; // length 1 (individual) or 2 (pair)
}

export interface Group {
  id: GroupId;
  unitIds: UnitId[]; // ordered
}

export interface Layout {
  groups: Group[]; // ordered; group order defines global priority
}

export type Coverage = "uncovered" | "locked" | "covered";

export interface SyndicateState {
  order: UnitId[]; // fixed global order of unit ids
  units: Record<UnitId, Unit>;
  groupOf: Record<UnitId, GroupId>;
  coverage: Record<UnitId, Coverage>;
  lockOwner: Record<UnitId, MemberId | null>;
}

export const MAX_GROUP_SIZE = 6;

export function unitSize(unit: Unit): number {
  return unit.memberIds.length;
}
