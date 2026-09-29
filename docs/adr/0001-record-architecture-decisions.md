# 0001. Record architecture decisions

Date: 2026-09-24
Status: Accepted
Spec: DESIGN.md

## Context
This project will run across many sessions, some of which start with no prior context. `DESIGN.md` records *what* the game does. It cannot carry *why* a choice was made, or what was ruled out.

## Decision
Record each architectural decision as `docs/adr/NNNN-short-title.md`, following `~/.claude/templates/adr.md`. To change a decision, write a new ADR that supersedes the old one; never edit an accepted decision in place. When code depends on a decision, cite it in a comment such as `// ADR-0003: …`.

## Alternatives Considered
- Decisions recorded inline in DESIGN.md: this mixes the rationale with the spec, and the rejected options get lost.
- A single DECISIONS.md: harder to cite, and harder to supersede cleanly.

## Consequences
There is a small writing overhead for each decision. In return, any session can resume cold and see why the code is shaped the way it is.
