# Ticket Syndicate App

## Overview
Glastonbury tickets, as well as other festivals and concerts, sell out in minutes. Groups of friends ("syndicates") coordinate so that whoever gets through to the checkout can buy tickets for the whole group. Today, this is run on spreadsheets and live phone calls. It is error-prone: people get bought twice, ticket slots get wasted, and nobody has a live view of who is covered.

This app replaces the spreadsheets with a hosted website that handles:
- Pre-sale assignment of members into fixed groups of up to 6 — arranged manually to keep
  friends together, or via a one-press randomise.
- Live, concurrency-safe reshuffling on sale day so whoever gets through buys for the
  right people — with no double buys and minimal wasted slots.
- Fast copy-paste of each person's registration details at checkout.

## Key Documentation References
- Implementation plans:
    - Core domain and claim engine: @docs/superpowers/plans/core-domain-claim-engine.md
- Frontend design system guidelines: TBC
- Coding standards: @docs/superpowers/specs/coding-standards.md
- Test strategy: TBC