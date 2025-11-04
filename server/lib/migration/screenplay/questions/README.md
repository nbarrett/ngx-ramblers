# Questions

Questions were initially created for the Screenplay pattern but are not used in the current implementation.

The migration system uses `browser.execute()` directly for data extraction, which provides:
- Better type safety (no type casts needed)
- Simpler code
- More appropriate for non-test scraping scenarios

Questions are typically used in testing scenarios for assertions and checks.
For scraping/migration, direct script execution is more straightforward.

See `screenplay/interactions/execute-page-script.ts` for the current approach.
