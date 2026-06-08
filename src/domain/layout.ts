import { type Group, type Layout, MAX_GROUP_SIZE, type Unit, unitSize } from "./types";

/**
 * Greedily pack units, in the given order, into groups of up to MAX_GROUP_SIZE
 * slots without ever splitting a pair (a pair is a single size-2 unit). A group
 * may close at 5 if the next unit is a pair that won't fit.
 */
export function packInOrder(units: Unit[]): Layout {
  const groups: Group[] = [];
  let current: Unit[] = [];
  let used = 0;

  const flush = () => {
    if (current.length > 0) {
      groups.push({ id: `g${groups.length + 1}`, unitIds: current.map((u) => u.id) });
      current = [];
      used = 0;
    }
  };

  for (const unit of units) {
    const size = unitSize(unit);
    if (used + size > MAX_GROUP_SIZE) flush();
    current.push(unit);
    used += size;
  }
  flush();
  return { groups };
}

/**
 * Returns a list of human-readable errors; an empty array means the layout is
 * valid. Checks that every unit is assigned exactly once and that no group
 * exceeds 6 slots. (Pair integrity is structural - a pair is one unit - so it
 * cannot be split.)
 */
export function validateLayout(layout: Layout, units: Unit[]): string[] {
  const errors: string[] = [];
  const byId = new Map(units.map((u) => [u.id, u]));
  const seen = new Map<string, number>();

  for (const group of layout.groups) {
    let slots = 0;
    for (const unitId of group.unitIds) {
      seen.set(unitId, (seen.get(unitId) ?? 0) + 1);
      slots += byId.get(unitId)?.memberIds.length ?? 1;
    }
    if (slots > MAX_GROUP_SIZE) errors.push(`group ${group.id} exceeds 6 slots`);
  }

  for (const unit of units) {
    const count = seen.get(unit.id) ?? 0;
    if (count === 0) errors.push(`unit ${unit.id} is not assigned to a group`);
    if (count > 1) errors.push(`unit ${unit.id} is assigned to multiple groups`);
  }
  return errors;
}

/** Fisher-Yates shuffle using an injected rng returning [0,1). */
function shuffle<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Shuffle the units, then pack them into groups (see packInOrder). */
export function randomiseLayout(units: Unit[], rng: () => number): Layout {
  return packInOrder(shuffle(units, rng));
}
