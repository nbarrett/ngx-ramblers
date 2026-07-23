# Ramblers Team Emails 1.0.0 cutover

## Preconditions

- The published API still matches the pinned contract checked by [`@ramblers/sf-contract`](https://github.com/nbarrett/ramblers-salesforce-contract).
- The [live mock](https://github.com/nbarrett/ramblers-salesforce-mock) passes its API, fixture and writeback tests.
- Head Office has supplied a base URL, API key and confirmed team code for the target environment.
- Unsubscribe writeback remains disabled until Head Office confirms which preference it changes and whether that change is team-specific or organisation-wide.

## Rehearsal

1. Keep Ramblers Team Emails disabled in NGX.
2. Import and retain the latest Insight Hub export as the rollback baseline.
3. Configure the live mock URL, a mock API key and the site team code.
4. Enable the integration and test the connection.
5. Run a full supporter snapshot and review the bulk-load audit.
6. Confirm members, affiliated members, volunteers, Wellbeing Walkers and supporters without membership numbers reconcile correctly.
7. Confirm a repeated snapshot is idempotent and that a supporter missing from a later snapshot is retained for review.
8. Confirm protected email audiences fail closed when the signed-in supporter is unmatched or lacks the relevant permission.
9. Trigger hard and soft bounce events and inspect their Ramblers writeback result in the member subscription audit.
10. Disable the integration and prove that the retained Insight Hub workflow remains usable.

## Production cutover

1. Record the current member count and preserve the latest Insight Hub import and audit.
2. Enter the production base URL and API key without copying credentials into source control, logs or support documents.
3. Confirm the configured team code with Head Office.
4. Test the connection before enabling synchronisation.
5. Enable Ramblers Team Emails and run the initial full snapshot.
6. Review new, changed, unchanged and missing-supporter counts before applying the prepared records.
7. Verify the signed-in administrators' `canViewMemberData` and audience permissions before sending email.
8. Monitor synchronisation and bounce writeback audit records after cutover.

## Rollback

1. Disable Ramblers Team Emails in System Settings.
2. Leave unsubscribe writeback disabled.
3. Re-import the retained Insight Hub export if member data must be restored.
4. Review the member bulk-load audit before applying any deletion or account-disable workflow.
5. Preserve failed writeback audit records for later retry; do not infer consent or membership state from an API failure.

## Known Phase One limits

- The API returns full snapshots rather than incremental changes.
- A supporter disappearing from a snapshot has no published removal meaning, so NGX retains the previous record for review.
- Granular group and area consent is not included.
- The scope of `/unsubscribe`, area access, pagination and several identifier/date semantics still require confirmation from Head Office.
- Additional supporter fields required to retire Insight Hub exports remain tracked separately as Phase Two work.
