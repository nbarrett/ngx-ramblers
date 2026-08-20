---
name: salesforce
description: Resume work on the Ramblers Team Emails 1.0.0 integration, Salesforce-backed supporter data, live mock, shared contract, consent and Insight Hub retirement. Use for the Ramblers email rollout, API tickets #327-#334, the contract or mock repositories, or historical #209/#211 questions.
---

# Ramblers Team Emails integration

Work from current evidence. Do not treat historical plans, drafts or issue descriptions as proof of what was delivered or sent.

## Establish current state

Read in-repo docs and GitHub issues first when the task concerns programme status, implementation or correspondence:

- `docs/ramblers-team-emails-cutover.md` when testing, release or cutover is relevant
- The parent ticket and delivery tickets in this repository (#327-#334)

Do not describe the Head office endpoint as currently available, or treat mock conformance as production-endpoint testing, without current evidence.

Then inspect the repositories and GitHub issues:

- This repository: parent #327 and delivery tickets #328-#334
- Contract repository `ramblers-salesforce-contract`, issues #2 and #3
- Live mock repository `ramblers-salesforce-mock`, issues #9 and #10
- Published OpenAPI: use the copy vendored in the contract package, not a personal SwaggerHub URL
- Live mock documentation: `https://salesforce-mock.ngx-ramblers.org.uk/docs`
- Live mock OpenAPI: `https://salesforce-mock.ngx-ramblers.org.uk/api/openapi.json`

Use `gh issue view` with an explicit repository. Check working trees, unpushed commits and workflow results when implementation status matters.

## Current architecture

Treat Ramblers Team Emails 1.0.0 as the Ramblers-published Phase One interface:

- `GET /get_supporters`
- `POST /unsubscribe`
- `POST /bounced_email`
- query credentials `api_key` and `team_code`

The shared `@ramblers/sf-contract` package represents that published interface with types, runtime validation and drift checks. The live mock implements it with realistic fixtures and operator tooling. NGX consumes the same contract. Do not present historical #209 as a competing external API.

The current released contract is v1.0.2. Verify the installed and released version before stating it because releases can move on.

## Ticket model

- #327 coordinates the migration.
- #328 covers the NGX API client.
- #329 covers supporter snapshot mapping and reconciliation.
- #330 covers protected supporter-data and audience permissions.
- #331 covers hard and soft bounce reporting.
- #332 covers unsubscribe writeback and remains dependent on Head Office confirming its meaning.
- #333 covers cross-repository conformance, testing and cutover.
- #334 tracks Phase Two supporter fields needed to retire Insight Hub safely.

#209, #211 and #268 are closed historical specifications. Use them for provenance or delta analysis only. Do not revise or reopen them unless the user explicitly asks. #212 is historical email-composer delivery context, not the active API specification.

## Known unresolved points

Verify whether Head Office has since answered each point before repeating it:

- Which preference `/unsubscribe` changes and whether it is team-specific or organisation-wide.
- Whether `memberRef` is the intended writeback identifier.
- Whether area codes are valid `team_code` values.
- Whether area-sized responses are paged.
- Whether `canViewMemberDate` is intentional or means `canViewMemberData`.
- The distinction between `membershipExpiry` and `membershipEndDate`.
- The meaning of a supporter disappearing from a later full snapshot.
- Which additional supporter fields will be added and when.

Granular group and area consent is outside API 1.0.0 but remains a significant usability and adoption risk. Describe it as an unresolved product gap, not as an implemented or agreed Phase One feature.

Insight Hub remains necessary for data that API 1.0.0 does not provide. #334 tracks the additional fields and the operational data-protection risk caused by continuing to distribute spreadsheet exports. Do not describe every historical Insight Hub field as part of the Phase One API.

## Source documents and correspondence

Keep working notes in a local, gitignored directory. Do not hard-code personal document paths into this skill.

When the user asks for an independent assessment:

1. Read only the source document, published API, contract and relevant tickets.
2. Write the independent assessment before reading the user's earlier analysis or draft.
3. Compare the two only after the independent version exists.
4. State clearly which conclusions came from each source.

When analysing a new Head Office document, compare it with the published API and current contract first. Use #209 only when the user asks for the difference from the original proposal.

When drafting correspondence:

- Read the relevant thread and recent sent messages to the same audience.
- Do not assume that preparatory documents were sent.
- Name the product, not a person: “Ramblers Team Emails 1.0.0” or “the Ramblers-published API”.
- Embed useful URLs and ticket links rather than mentioning products or issue numbers without links.
- Use plain language. Follow `unslop` and `AGENTS.md`.
- Do not use “authoritative” unless quoting a source.
- Do not send correspondence without explicit instruction.

## Verify what was actually sent

The `emailCompositions` collection is the primary record for Email Composer sent and draft status. `inboxMessages` contains imported messages and replies and is not the primary source for composition status.

When the task depends on prior correspondence:

1. Read `.claude/skills/connect-env-db/SKILL.md`.
2. Query **this checkout's** Mongo (see that skill). Do not copy credentials to disk.
3. Check `emailCompositions` status, sent time, subject, recipients and stored body.
4. Use imported copies and replies as corroboration for older compositions whose recipient snapshots are incomplete.
5. Never hardcode sent or draft counts because they change.

## Common workflows

### Review implementation or testing

Inspect the actual diff, focused tests, cutover guide, issue acceptance criteria and CI state. Separate:

- implemented and automatically tested
- implemented but requiring manual or live-mock testing
- partially implemented acceptance criteria
- deliberately blocked work
- Phase Two work

Do not infer that an issue is complete merely because code references it in a commit.

### Update tickets

Keep local issue labels concise, such as `#328`. Use repository-qualified labels only for cross-repository issues. Put tickets on the project board only when requested and preserve the requested priority and status.

### Review contract drift

Compare the resolved SwaggerHub definition, the pinned contract OpenAPI, the contract package version, the live mock OpenAPI and NGX's installed package. Record unknown semantics as questions rather than inventing local behaviour.

### Prepare a Head Office briefing

Use current sent correspondence, open decisions, implementation evidence and the audience's actual prior knowledge. Keep preparatory plans distinct from information already shared.
