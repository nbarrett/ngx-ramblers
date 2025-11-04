# Page Elements

This directory contains page element locators for the migration system.

**Note**: The current migration implementation uses ExecuteScript directly for scraping
as it's more straightforward than using PageElement locators. The migration-page.ts file
is kept for reference but is not currently used in the implementation.

For the current implementation, see:
- `screenplay/tasks/` - For navigation and actions
- `screenplay/questions/` - For extracting data using ExecuteScript

If you need to use PageElement locators in the future, refer to Serenity/JS documentation:
https://serenity-js.org/api/web/
