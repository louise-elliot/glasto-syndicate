import { MAX_GROUP_SIZE, type MemberId, type SyndicateState, type UnitId } from "./types";

export interface ClaimResult {
  unitIds: UnitId[]; // assigned units, now locked
  memberIds: MemberId[]; // flattened member ids, in assignment order
  state: SyndicateState; // new state (input is not mutated)
}

function findBuyerUnit(state: SyndicateState, buyer: MemberId): UnitId {
  for (const unitId of state.order) {
    if (state.units[unitId].memberIds.includes(buyer)) return unitId;
  }
  throw new Error("unknown buyer");
}

/**
 * Assign up to 6 still-uncovered slots to the buyer: the buyer's own group
 * first (in order), then the rest of the syndicate in fixed global order. Whole
 * units only - a pair (size 2) is skipped when only 1 slot remains, and the
 * walk continues to the next unit that fits. The buyer's own coverage status is
 * irrelevant: an already-covered buyer simply tops up others.
 */
export function assignClaim(state: SyndicateState, buyer: MemberId): ClaimResult {
  const buyerUnit = findBuyerUnit(state, buyer);
  const buyerGroup = state.groupOf[buyerUnit];

  const own = state.order.filter((u) => state.groupOf[u] === buyerGroup);
  const rest = state.order.filter((u) => state.groupOf[u] !== buyerGroup);
  const priority = [...own, ...rest];

  const picked: UnitId[] = [];
  let slotsLeft = MAX_GROUP_SIZE;
  for (const unitId of priority) {
    if (slotsLeft === 0) break;
    if (state.coverage[unitId] !== "uncovered") continue;
    const size = state.units[unitId].memberIds.length;
    if (size <= slotsLeft) {
      picked.push(unitId);
      slotsLeft -= size;
    }
  }

  const coverage = { ...state.coverage };
  const lockOwner = { ...state.lockOwner };
  for (const unitId of picked) {
    coverage[unitId] = "locked";
    lockOwner[unitId] = buyer;
  }

  const memberIds = picked.flatMap((u) => state.units[u].memberIds);
  return { unitIds: picked, memberIds, state: { ...state, coverage, lockOwner } };
}

/** Mark the given locked units as permanently covered. */
export function applyPurchase(state: SyndicateState, unitIds: UnitId[]): SyndicateState {
  const coverage = { ...state.coverage };
  const lockOwner = { ...state.lockOwner };
  for (const unitId of unitIds) {
    if (coverage[unitId] !== "locked") throw new Error(`unit ${unitId} is not locked`);
    coverage[unitId] = "covered";
    lockOwner[unitId] = null;
  }
  return { ...state, coverage, lockOwner };
}

/** Release the given units back to uncovered at their original positions. */
export function applyReject(state: SyndicateState, unitIds: UnitId[]): SyndicateState {
  const coverage = { ...state.coverage };
  const lockOwner = { ...state.lockOwner };
  for (const unitId of unitIds) {
    coverage[unitId] = "uncovered";
    lockOwner[unitId] = null;
  }
  return { ...state, coverage, lockOwner };
}
