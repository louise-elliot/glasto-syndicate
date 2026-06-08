# Glasto Syndicate — Design Spec

**Date:** 2026-06-08
**Status:** Approved for planning

## 1. Problem & Goal

Glastonbury tickets sell out in minutes. Groups of friends ("syndicates") coordinate
so that whoever gets through to the checkout can buy tickets for the whole group.
Today this is run on spreadsheets and live phone calls. It is error-prone: people get
bought twice, ticket slots get wasted, and nobody has a live view of who is covered.

This app replaces the spreadsheets with a hosted website that does:

- Pre-sale assignment of members into fixed groups of up to 6 — arranged manually to keep
  friends together, or via a one-press randomise.
- Live, concurrency-safe reshuffling on sale day so whoever gets through buys for the
  right people — with **zero double-buys** and **zero wasted ticket slots**.
- Fast copy-paste of each person's registration details at checkout.

Success = on sale day, the syndicate covers as many of its members as the tickets
available allow, with no slot wasted on a double-buy and no manual spreadsheet wrangling.

## 2. How Glastonbury Buying Works (domain context)

- Everyone registers in advance and has a **registration number**, a registered
  **first/last name**, and a **postcode**.
- On sale day tickets sell out in minutes; members hammer the website/queue.
- Whoever reaches the checkout can buy **up to 6 tickets in one transaction**, entering
  each person's registration number + name (+ postcode) into the Glasto form.
- A registration can only appear on one ticket. Glastonbury may limit how often one
  registration acts as lead booker — that is Glasto's rule to enforce, not ours.

## 3. Core Model

### Concepts

- **Syndicate** — a group running a buy. Has a name, a join code/link, a status
  (`setup` → `live` → `closed`), and a group layout that is frozen (along with its derived
  global order) when locked for sale.
- **Member** — a person: first name, last name, **registration number**, **postcode**,
  and a per-device claim token (their no-password identity). Belongs to one syndicate.
- **Unit** — the groupable thing, either:
  - an **individual** (one member, size 1), or
  - a **pair** (two members who must always be in the same group and bought in the same
    transaction, size 2).
  A unit has a `position` (its place in the fixed global order) and a `size` (1 or 2).
- **Coverage state** (per member): `uncovered` → `locked` (claimed by a buyer,
  in-progress) → `covered` (purchased). A lock records which buyer owns it.

### Roles & access

Three tiers:

- **Super admin** — the app owner. Has a **real authenticated login** (email + password).
  Powers:
  - **Gates syndicate creation** — syndicates cannot be created freely. The super admin
    provisions each syndicate and issues its organiser link. Nobody runs a buy without the
    super admin enabling it.
  - **Oversight** — can view any syndicate.
  - **Override** — can override/force-release lock statuses and step in when something is
    stuck (see §5).
- **Organiser** — runs a single syndicate via an organiser link issued by the super admin.
  No password; the link grants organiser rights for that syndicate (name it, manage the
  roster, "Lock for sale"). 
- **Member** — opens the syndicate's join link, enters their details, and the browser
  stores a claim token (their no-password identity). Trust-based, appropriate for a group
  of friends.

## 4. Group Layout & The Fixed Order

Groups are **arranged before the sale** by the **organiser or the super admin**, and once
locked they **stay fixed**. The layout exists primarily to keep groups of friends
together.

### Arranging groups (pre-sale)

- **Manual assignment** — drag members/units into groups of up to 6 and order the groups.
  The UI **keeps pairs together** (a pair always lands in one group as a 2-slot unit) and
  warns if a layout is invalid (group over 6, a pair split).
- **Randomise button** — produces a layout automatically using the agreed algorithm:
  shuffle units, then pack them into groups of up to 6 **without ever splitting a pair**
  (a group may close at **5** if the next unit is a pair that won't fit). Randomise can be
  pressed any number of times before lock; it overwrites the current layout.
- Either approach can be used and then hand-tweaked.

### The fixed order

The chosen layout defines the **fixed global priority order**: group 1's members in order,
then group 2's, and so on. This single ordered list is what the live claim engine walks
for top-ups (§5).

### Locking

When the organiser **locks the syndicate for sale**, the layout and its derived order are
**frozen** and status moves to `live`. Groups are no longer editable. During the live sale
the groups are a fixed planning view; the claim engine works off the frozen flat order,
crossing group boundaries when topping up.

## 5. The Claim Engine (critical, concurrency-safe core)

This is the highest-risk component and is built test-first.

### Claiming ("I'm through — lock my 6")

Runs as a **single Postgres transaction** using row locks (`SELECT … FOR UPDATE`) so two
simultaneous buyers can never grab overlapping people. Steps:

1. Take the buyer's own group's still-**uncovered & unlocked** members first.
2. Top up remaining slots (up to 6 total) by walking the **fixed global order**, taking
   whole **units that fit** the remaining space:
   - an individual fills 1 slot;
   - a pair fills 2 slots — **skip a pair that won't fit** a single leftover slot and
     continue to the next individual that fits (never assign half a pair).
3. Mark the chosen set `locked` to this buyer and return it.

The buyer's **own coverage status is irrelevant** to what they're assigned — an
already-covered member who gets through simply buys for the next uncovered people. There
is **no cap**: a member may claim repeatedly until the whole syndicate is covered.

### Resolving a claim

- **Purchased** → the locked set becomes `covered` (permanent, safe).
- **Rejected** → the lock releases; those people return to `uncovered` at their
  **original position** in the fixed order, keeping their priority. The buyer is part of
  the set, so on Rejected they're released too and may try again.

### Detail exposure (copy safety)

To prevent accidental double-buys, a person's **registration number and postcode are
only exposed and copyable inside the buyer's own active lock** (their checkout copy
block). Everywhere else — the live dashboard, people locked by *other* buyers, and
already-`covered` people — those details are **hidden and non-copyable**. You can see a
person's name and coverage status, but you can never copy the details of someone you are
not currently locked to buy. This makes it impossible to accidentally paste a person who
is already being bought.

### Super-admin override

The super admin can **override lock statuses** on any syndicate: force-release a lock
that is stuck (e.g. the buyer dropped offline without resolving), or otherwise reset a
person's coverage state. Overrides run through the same atomic transaction so state stays
consistent, and are broadcast live like any other change.

### Pairing controls

- A member joins as an **individual** or as a **pair** (links/invites a partner).
- A pair can **unpair at any time** (before or during the sale). The pair-unit splits
  into two individual-units occupying the same two positions in the order; the normal
  "next individual that fits" rule then applies to each independently. Unpairing is the
  escape hatch when a couple would rather split than risk one missing out.

## 6. Real-Time Sync

Every open page subscribes to **Supabase Realtime** on the syndicate's coverage/lock
changes. The live dashboard (who is uncovered / locked / covered, and by whom) updates
instantly for all members. No manual refresh.

## 7. Screens

1. **Super-admin console** (authenticated login) → provision a new syndicate, issue its
   organiser link, view all syndicates, arrange any syndicate's groups, and
   override/force-release locks.
2. **Organiser dashboard** (via organiser link) → name the syndicate, manage the roster,
   share the member join link, **arrange groups** (drag members into groups + **Randomise**
   button, pairs kept together), and **"Lock for sale"** (freezes layout/order → `live`).
3. **Join** → enter first/last name, registration number, postcode; choose **individual**
   or **pair** (pair links a partner). Browser stores claim token.
4. **Pre-sale member dashboard** → roster, your unit, **pair/unpair** control, preview of
   groups.
5. **Live sale page** → prominent **"I'm through — lock my 6"** button. On lock: a fast
   **copy block** for each of the 6 people (registration number, first/last name,
   postcode, each one-tap copyable, plus "copy all") — shown **only for your own locked
   set**. The dashboard shows everyone's name + coverage status but never copyable details
   for people you aren't locked to. **Purchased / Rejected** buttons resolve the lock.
6. **Done state** → everyone covered; syndicate can be `closed`.

## 8. Edge Cases (explicitly handled)

- **Concurrent claims** — atomic transaction guarantees no overlapping assignments.
- **Rejected release** — people return to original priority position.
- **Unpair anytime** — splits into two individuals at the same positions.
- **Leftover single slot vs. a pair** — skip the pair, fill with next fitting individual.
- **Groups smaller than 6** — pairs never split across a group boundary (manual or random).
- **Invalid manual layout** — UI blocks/warns on a group over 6 or a split pair.
- **Layout frozen on lock** — groups become immutable once the sale is live.
- **Member already covered when group-mate buys** — skipped; slot tops up from the order.
- **Repeat buys** — a member may buy multiple sets of 6, unlimited until all covered.
- **Buyer drops offline mid-lock** — manual release by the buyer, or **super-admin
  override** force-releases the stuck lock.
  *(Optional future addition: timed auto-release of stale locks — not in initial scope.)*
- **Detail leakage** — registration number/postcode are never copyable except inside the
  viewer's own active lock; no accidental copying of someone already being bought.
- **Ungated creation** — syndicates can only be created by the super admin; organiser
  links are issued, not self-served.

## 9. Stack

- **Frontend:** Next.js (React), deployed on Vercel.
- **Backend/data:** Supabase (Postgres + Realtime). The claim engine lives in a Postgres
  transaction/function for atomic, concurrency-safe locking. Realtime broadcasts coverage
  changes.
- **Auth:** tiered — **super admin** has a real authenticated login (Supabase Auth);
  **organisers** use an issued organiser link; **members** use the join-link + per-device
  claim token (no password). Detail-exposure rules (§5) are enforced **server-side**, not
  just hidden in the UI, so non-locked details are never sent to a client that shouldn't
  see them.

Rationale: Postgres makes the hardest part (concurrency-safe claiming over an ordered
list) the easiest part, and Supabase Realtime gives live multi-user sync with minimal
custom infrastructure. (Alternatives considered: custom Node + Socket.IO — more ops for
no gain; Firebase/Firestore — awkward for transactional locking across many ordered rows.)

## 10. Testing Strategy

The claim engine is the risk centre and is built **test-first**. Automated tests cover:

- **Concurrency** — many parallel claims produce disjoint assignments, no overlaps.
- **Pair integrity** — a pair is never split; never half a pair assigned.
- **Leftover-slot skip** — a 1-slot remainder skips a pair and takes the next individual.
- **Reject-and-reclaim** — released people return to original position and are re-claimed
  in correct priority order.
- **Repeat buys** — a single buyer can claim multiple sets; unlimited until covered.
- **Termination** — engine reaches "everyone covered" correctly and stops.
- **Grouping** — randomise never straddles a pair across a group boundary; groups may be
  size 5. Manual layout rejects invalid arrangements. Locked layout is immutable.
- **Order derivation** — the frozen global order matches group sequence then within-group
  order, and the engine tops up across group boundaries in that order.
- **Detail exposure** — server only returns copyable reg/postcode for the requester's own
  active lock; never for other people's locks or covered members.
- **Super-admin override** — force-release resets state atomically and broadcasts live.
- **Creation gating** — only an authenticated super admin can provision a syndicate.

## 11. Out of Scope (initial)

- Member/organiser passwords (only the super admin authenticates).
- Payment/money tracking between members (who owes whom).
- Timed auto-release of stale locks (noted as a possible later addition).
- Anything beyond the single sale-day coordination flow.