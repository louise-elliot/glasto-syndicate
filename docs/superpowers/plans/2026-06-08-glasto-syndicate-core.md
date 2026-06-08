# Glasto Syndicate — Plan 1: Core Domain & Claim Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, fully-tested domain core — units, group layout, the fixed global order, and the claim engine (assign / purchase / reject) — with zero infrastructure, so the highest-risk logic is correct before any database or UI exists.

**Architecture:** A pure TypeScript domain module operating on plain in-memory data structures. No I/O, no randomness except via an injected RNG. The *selection algorithm* lives here and is exhaustively unit-tested; later plans wrap it in a serialized Postgres transaction to provide atomicity. A **pair is a single indivisible `Unit` of size 2**, so pair-integrity is structural — a pair can never be split because it is never two things.

**Tech Stack:** Next.js (App Router) + TypeScript, Vitest for unit tests. This plan only touches `src/domain/**` and test/config files; Next.js is scaffolded now so later plans build on it.

**Reference spec:** `docs/superpowers/specs/2026-06-08-glasto-syndicate-design.md`

---

### Task 1: Scaffold the Next.js + TypeScript project

**Files:**
- Create: project scaffold (`package.json`, `tsconfig.json`, `next.config.*`, `app/**`, etc.)

- [ ] **Step 1: Scaffold into the current directory**

The repo root is empty except for `docs/` and `.git/`. Run create-next-app non-interactively into the current directory (the `.` target):

Run:
```bash
npx create-next-app@latest . --typescript --app --eslint --src-dir --import-alias "@/*" --no-tailwind --use-npm --yes
```
Expected: scaffold completes; `src/app/page.tsx`, `package.json`, `tsconfig.json` exist. If it refuses because `docs/` exists, re-run with the same command — create-next-app permits a non-empty dir containing only `docs`/`.git`; if it still refuses, move `docs` aside, scaffold, then move it back.

- [ ] **Step 2: Verify the app builds**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js TypeScript app"
```

---

### Task 2: Add Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Install Vitest**

Run:
```bash
npm install -D vitest
```
Expected: `vitest` appears in `devDependencies`.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 3: Add a `test` script to `package.json`**

Add to the `"scripts"` object:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Add a smoke test**

Create `src/domain/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("vitest wiring", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run the test to verify wiring**

Run: `npm test`
Expected: 1 passing test.

- [ ] **Step 6: Delete the smoke test and commit**

```bash
rm src/domain/smoke.test.ts
git add -A
git commit -m "chore: add Vitest test runner"
```

---

### Task 3: Domain types

**Files:**
- Create: `src/domain/types.ts`

- [ ] **Step 1: Write the types**

```ts
// src/domain/types.ts
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/domain/types.ts
git commit -m "feat(domain): add core types"
```

---

### Task 4: Randomise layout (pair-aware packing)

**Files:**
- Create: `src/domain/layout.ts`
- Test: `src/domain/layout.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/domain/layout.test.ts
import { describe, it, expect } from "vitest";
import { randomiseLayout } from "./layout";
import type { Unit } from "./types";

// Deterministic RNG: returns values from a fixed sequence (cycled).
function seededRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

const ind = (id: string): Unit => ({ id, kind: "individual", memberIds: [id] });
const pair = (id: string): Unit => ({
  id,
  kind: "pair",
  memberIds: [`${id}a`, `${id}b`],
});

describe("randomiseLayout", () => {
  it("packs individuals into groups of up to 6", () => {
    const units = ["1", "2", "3", "4", "5", "6", "7"].map(ind);
    // rng=0 => no shuffle movement (Fisher-Yates with floor(0*..)=0 swaps element with itself)
    const layout = randomiseLayout(units, seededRng([0]));
    expect(layout.groups).toHaveLength(2);
    expect(layout.groups[0].unitIds).toHaveLength(6);
    expect(layout.groups[1].unitIds).toHaveLength(1);
  });

  it("never splits a pair and may close a group at 5", () => {
    // 5 individuals then a pair: the pair cannot fit slot 6, so group closes at 5.
    const units = [ind("1"), ind("2"), ind("3"), ind("4"), ind("5"), pair("P")];
    const layout = randomiseLayout(units, seededRng([0]));
    expect(layout.groups[0].unitIds).toEqual(["1", "2", "3", "4", "5"]);
    expect(layout.groups[1].unitIds).toEqual(["P"]);
  });

  it("assigns every unit exactly once", () => {
    const units = ["1", "2", "3"].map(ind).concat(pair("P"));
    const layout = randomiseLayout(units, seededRng([0]));
    const placed = layout.groups.flatMap((g) => g.unitIds).sort();
    expect(placed).toEqual(["1", "2", "3", "P"]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- layout`
Expected: FAIL — `randomiseLayout` not found.

- [ ] **Step 3: Implement `randomiseLayout`**

```ts
// src/domain/layout.ts
import { type Group, type Layout, MAX_GROUP_SIZE, type Unit, unitSize } from "./types";

/** Fisher-Yates shuffle using an injected rng returning [0,1). */
function shuffle<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Shuffle units, then greedily pack into groups of up to MAX_GROUP_SIZE slots
 * without ever splitting a pair (a pair is a single size-2 unit). A group may
 * close at 5 if the next unit is a pair that won't fit.
 */
export function randomiseLayout(units: Unit[], rng: () => number): Layout {
  const shuffled = shuffle(units, rng);
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

  for (const unit of shuffled) {
    const size = unitSize(unit);
    if (used + size > MAX_GROUP_SIZE) flush();
    current.push(unit);
    used += size;
  }
  flush();
  return { groups };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- layout`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/layout.ts src/domain/layout.test.ts
git commit -m "feat(domain): randomise layout with pair-aware packing"
```

---

### Task 5: Validate layout

**Files:**
- Modify: `src/domain/layout.ts`
- Modify: `src/domain/layout.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/domain/layout.test.ts`:
```ts
import { validateLayout } from "./layout";

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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- layout`
Expected: FAIL — `validateLayout` not found.

- [ ] **Step 3: Implement `validateLayout`**

Append to `src/domain/layout.ts`:
```ts
/**
 * Returns a list of human-readable errors; empty array means valid.
 * Checks: every unit assigned exactly once, and no group exceeds 6 slots.
 * (Pair integrity is structural — a pair is one unit — so it cannot be "split".)
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- layout`
Expected: PASS (all layout tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/layout.ts src/domain/layout.test.ts
git commit -m "feat(domain): validate layout capacity and completeness"
```

---

### Task 6: Build syndicate state from a layout

**Files:**
- Create: `src/domain/state.ts`
- Test: `src/domain/state.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/state.test.ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- state`
Expected: FAIL — `buildState` not found.

- [ ] **Step 3: Implement `buildState`**

```ts
// src/domain/state.ts
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- state`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/state.ts src/domain/state.test.ts
git commit -m "feat(domain): build syndicate state from layout"
```

---

### Task 7: Claim engine — own group first

**Files:**
- Create: `src/domain/claim.ts`
- Test: `src/domain/claim.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/claim.test.ts
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

describe("assignClaim — own group first", () => {
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

  it("locks the assigned units in the returned state", () => {
    const state = makeState([{ id: "g1", units: [ind("a"), ind("b")] }]);
    const result = assignClaim(state, "a");
    expect(result.state.coverage["a"]).toBe("locked");
    expect(result.state.coverage["b"]).toBe("locked");
    expect(result.state.lockOwner["a"]).toBe("a");
    // original state is not mutated
    expect(state.coverage["a"]).toBe("uncovered");
  });

  it("throws for an unknown buyer", () => {
    const state = makeState([{ id: "g1", units: [ind("a")] }]);
    expect(() => assignClaim(state, "zzz")).toThrow("unknown buyer");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- claim`
Expected: FAIL — `assignClaim` not found.

- [ ] **Step 3: Implement `assignClaim`**

```ts
// src/domain/claim.ts
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
 * Assign up to 6 still-uncovered slots to the buyer: the buyer's own group first
 * (in order), then the rest of the syndicate in fixed global order. Whole units
 * only — a pair (size 2) is skipped when only 1 slot remains, and the walk
 * continues to the next unit that fits. The buyer's own coverage status is
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- claim`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/claim.ts src/domain/claim.test.ts
git commit -m "feat(domain): claim engine assigns own group first then top-up"
```

---

### Task 8: Claim engine — pair integrity & leftover-slot skip

**Files:**
- Modify: `src/domain/claim.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/domain/claim.test.ts`:
```ts
describe("assignClaim — pairs and leftover slots", () => {
  it("assigns a pair as a single unit (both members together)", () => {
    const state = makeState([{ id: "g1", units: [ind("a"), pair("P")] }]);
    const result = assignClaim(state, "a");
    expect(result.unitIds).toEqual(["a", "P"]);
    expect(result.memberIds).toEqual(["a", "Pa", "Pb"]);
  });

  it("skips a pair when only one slot remains and takes the next individual", () => {
    // g1: 5 individuals (fills slots 1-5). Next in order is a pair (needs 2)
    // which will NOT fit the single remaining slot, so it is skipped; the
    // following individual fills slot 6.
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
```

- [ ] **Step 2: Run to verify failure, then pass**

Run: `npm test -- claim`
Expected: PASS — the Task 7 implementation already satisfies these (they lock in the behaviour). If any fail, fix `assignClaim` until all pass.

- [ ] **Step 3: Commit**

```bash
git add src/domain/claim.test.ts
git commit -m "test(domain): lock in pair integrity and leftover-slot skip"
```

---

### Task 9: Resolve a claim — purchase and reject

**Files:**
- Modify: `src/domain/claim.ts`
- Test: `src/domain/resolve.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/domain/resolve.test.ts
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
    // order array is untouched, so released people keep their original priority
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- resolve`
Expected: FAIL — `applyPurchase` / `applyReject` not found.

- [ ] **Step 3: Implement the resolvers**

Append to `src/domain/claim.ts`:
```ts
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- resolve`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/claim.ts src/domain/resolve.test.ts
git commit -m "feat(domain): purchase and reject claim resolution"
```

---

### Task 10: Repeat buys, termination, and concurrency simulation

**Files:**
- Test: `src/domain/scenarios.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/domain/scenarios.test.ts
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

describe("concurrency (serialized) — no overlapping assignments", () => {
  it("two buyers applied in sequence never share a unit", () => {
    const state = makeState([
      { id: "g1", units: ["a", "b", "c", "d", "e", "f", "g"].map(ind) },
      { id: "g2", units: ["h", "i", "j"].map(ind) },
    ]);
    // Buyer 'a' claims first (serialized by the transaction in Plan 2).
    const first = assignClaim(state, "a");
    // Buyer 'h' claims from the resulting state.
    const second = assignClaim(first.state, "h");
    const overlap = first.unitIds.filter((u) => second.unitIds.includes(u));
    expect(overlap).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify pass**

Run: `npm test -- scenarios`
Expected: PASS (3 tests) — these exercise existing functions end-to-end and document the guarantees. Fix any failures in the underlying functions.

- [ ] **Step 3: Run the whole suite**

Run: `npm test`
Expected: ALL domain tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/domain/scenarios.test.ts
git commit -m "test(domain): repeat buys, termination, concurrency guarantees"
```

---

### Task 11: Domain barrel export

**Files:**
- Create: `src/domain/index.ts`

- [ ] **Step 1: Write the barrel**

```ts
// src/domain/index.ts
export * from "./types";
export * from "./layout";
export * from "./state";
export * from "./claim";
```

- [ ] **Step 2: Verify it compiles and tests still pass**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/domain/index.ts
git commit -m "chore(domain): add barrel export"
```

---

## Self-Review (completed)

**Spec coverage (Plan 1's slice):**
- Units/pairs as indivisible size-2 unit — Task 3 ✓
- Randomise with pair-aware packing, groups up to 6, may close at 5 — Task 4 ✓
- Manual-layout validation (capacity/completeness) — Task 5 ✓
- Fixed global order = group sequence then within-group — Task 6 ✓
- Claim: own group first, fixed-order top-up, whole units, leftover-slot skip — Tasks 7–8 ✓
- Buyer coverage irrelevant / repeat buys unlimited — Tasks 7, 10 ✓
- Purchase → covered; Reject → uncovered at original position — Task 9 ✓
- Concurrency guarantee (selection produces disjoint sets when serialized) — Task 10 ✓
- Termination — Task 10 ✓

**Deferred to later plans (correctly out of Plan 1 scope):** Postgres persistence + the serialized transaction that provides real atomicity (Plan 2), super-admin auth & syndicate provisioning (Plan 2), realtime broadcast (Plan 2), server-side detail-exposure enforcement (Plan 2), all UI (Plan 3). The pure `assignClaim`/`applyReject`/`applyPurchase` are the exact functions Plan 2 will call inside `SELECT … FOR UPDATE`.

**Placeholder scan:** none.

**Type consistency:** `assignClaim`, `applyPurchase`, `applyReject`, `buildState`, `randomiseLayout`, `validateLayout`, `unitSize`, `ClaimResult`, `SyndicateState` are used identically across tasks.
