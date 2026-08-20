---
name: unslop
description: >
  Cut AI tells from writing before the user sees it. Apply to chat replies, email drafts,
  release notes, commit bodies, GitHub issue bodies, and any prose that will be sent to
  another human. Use when writing or editing that prose, when the user says unslop,
  tighten, less AI, or "this reads like a model", or when the user runs /unslop.
---

# Unslop

Edit text to remove AI patterns. Follow the prose rules in `AGENTS.md` (and `CLAUDE.md` if the checkout has one). Do not copy banned-word tables into this skill.

## When it applies

- Chat replies in this repo
- Email or notice drafts
- Release notes and commit bodies (`feat` / `fix` / `perf`)
- GitHub issue or project-board text
- CMS how-to copy that members will read

Code, identifiers, and third-party wire names are out of scope except where `AGENTS.md` already says so.

## Process

1. Draft or take the existing text.
2. Apply `AGENTS.md` UK English, no AI attribution, GitHub run-link rules, and any local prose rules the checkout already has.
3. Rewrite. Keep meaning. Complete sentences, no empty cheer, no sycophancy.
4. Self-audit: "What still makes this obviously model-generated?" Fix that. Then stop.

## Extra patterns a word list does not cover

These still need a rewrite even when no banned word is present:

- Puffery and promotional adjectives
- "Not just X, but Y"
- Rule-of-three padding
- Bold-lead bullet lists when a short paragraph would do
- Chatbot closers ("Let me know if you have any questions")
- Saying how the work feels instead of what the reader should do or know
- Implementation internals in a chat report (field names, function names, plumbing). Lead with what changed for the user and where to look.

## Project specifics

- UK English in commits and docs ("centralised", "colour", "behaviour").
- "Head office" for Ramblers' central organisation, never "HQ".
- GitHub Actions: `run 746` in prose, link with `/actions/runs/<databaseId>`, never `#746`.
- Commit bodies keep the three Markdown headings. Do not hard-wrap paragraphs.
- Do not name a specific group or trial site in release notes unless the user asked for that audience.

## Reply

Return the rewritten text. Do not narrate the unslop pass unless the user asked what changed.
