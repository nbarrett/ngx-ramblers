# Release Notes Automation

Automated generation and publishing of release notes to the CMS committee "How To > Release Notes" page.

## Overview

This automation:
- Inspects conventional commit history to identify changes
- Groups commits by type (feat, fix, refactor, etc.)
- Generates user-friendly release note pages
- Authenticates with the CMS using JWT
- Creates/updates release note pages via the CMS API
- Updates the main release notes index page with links to new entries

## Features

- **CLI Mode**: Run with command-line options for automation
- **Interactive Mode**: Use a TUI to select which release notes to generate
- **Duplicate Detection**: Automatically updates existing release notes via CMS
- **Dry Run**: Preview changes without publishing
- **Flexible Date Grouping**: Groups commits by date for organized release notes
- **Issue Linking**: Automatically extracts and links GitHub issues from commits

## Requirements

- Node.js 22.19.0+
- CMS credentials with `contentAdmin` permission
- Git repository with conventional commit messages

## Usage

### Interactive Mode (Recommended)

```bash
npm run release-notes
```

This launches an interactive main menu with all options:
- **Test authentication** - Verify CMS credentials and permissions
- **Preview missing release notes** - See what would be generated without creating
- **Generate release notes (interactive)** - Select scope and choose which notes to generate
- **Generate latest** - Generate for commits since last tag
- **Generate all missing** - Generate all unprocessed commits
- **Exit** - Quit the tool

Navigation:
- Use arrow keys to select options
- Press Enter to confirm
- Use "← Back" options to navigate to previous menus
- Press Ctrl+C to exit at any time

### Command Line Mode (for automation)

For automation and CI/CD, you can bypass the interactive menu:

Generate for latest commits since last tag:
```bash
tsx lib/release-notes/generate-release-notes.ts --latest
```

Generate all missing release notes:
```bash
tsx lib/release-notes/generate-release-notes.ts --all
```

Generate for a specific commit range:
```bash
tsx lib/release-notes/generate-release-notes.ts --since <commit-hash> --until HEAD
```

Generate for everything on or after a calendar date:
```bash
tsx lib/release-notes/generate-release-notes.ts --since-date 2025-11-19
```
Date inputs accept ISO strings (`2025-11-19`) or readable formats such as `19-Nov-2025`; filtering is inclusive of the day provided.

Preview without publishing (dry run):
```bash
tsx lib/release-notes/generate-release-notes.ts --latest --dry-run
```

Test authentication:
```bash
tsx lib/release-notes/generate-release-notes.ts --test-auth
```

With GitHub Actions build number:
```bash
tsx lib/release-notes/generate-release-notes.ts --latest --build-number ${{ github.run_number }}
```

### CLI Options

```
Options:
  --latest                    Generate release notes for commits since the last tag
  --all                       Generate release notes for all unprocessed commits
  --since <commit>            Generate release notes since this commit/tag
  --since-date <date>         Generate release notes on/after this date (e.g. 2025-11-19 or 19-Nov-2025)
  --until-date <date>         Generate release notes until this calendar date (inclusive)
  --until <commit>            Generate release notes until this commit (default: HEAD)
  --build-number <number>     GitHub Actions build/run number
  --dry-run                   Preview changes without publishing to CMS
  --preview                   Preview missing release notes without generating
  --test-auth                 Test CMS authentication and permissions
  --cms-url <url>             CMS base URL (default: https://www.ngx-ramblers.org.uk)
  --username <username>       CMS username (or set CMS_USERNAME env var)
  --password <password>       CMS password (or set CMS_PASSWORD env var)
  --interactive               Run in interactive mode
  -h, --help                  Display help for command
```

Combine `--since-date` with `--until-date` to constrain release note generation to a specific calendar window; both bounds are inclusive.

### Environment Variables

Configure via environment variables:

```bash
export CMS_URL="https://www.ngx-ramblers.org.uk"
export CMS_USERNAME="your-username"
export CMS_PASSWORD="your-password"
```

Or use a `.env` file in the server directory.

## How It Works

### 1. Commit Parsing

The tool parses git commits using the conventional commit format:

```
type(scope): subject

body

footer
```

Supported types:
- `feat` - New Features
- `fix` - Bug Fixes
- `refactor` - Refactoring
- `perf` - Performance Improvements
- `build` - Build System
- `ci` - Continuous Integration
- `test` - Tests
- `docs` - Documentation
- `style` - Code Style
- `chore` - Chores

Issue references are extracted from:
- `fix: description (ref: #123)` - with colon
- `feat: description (fixes #123)` - action keywords
- `fix #123`, `closes #123`, `resolves #123` - direct references

### 2. Hybrid Grouping by Date and Issue

Commits are intelligently grouped using a hybrid approach:

**Single issue per date:**
- All commits from that date go into one page
- Path: `/how-to/committee/release-notes/2026-01-02`

**Multiple issues on same date:**
- Each significant issue gets its own page
- Path: `/how-to/committee/release-notes/2025-12-02-issue-97`
- Path: `/how-to/committee/release-notes/2025-12-02-issue-93`
- Commits without issues: `/how-to/committee/release-notes/2025-12-02-other`

**Within each page:**
- Commits are grouped by type (feat, fix, etc.)
- Ordered by importance (features first, then fixes, etc.)

### 3. Content Generation

For each release note:
- Extracts primary issue reference (if any)
- Generates a user-friendly title
- Creates markdown with grouped commits
- Formats with links to GitHub issues and commits

### 4. CMS Integration

The tool:
1. Authenticates with the CMS using username/password
2. Gets a JWT token for API requests
3. Creates/updates page content at `/how-to/committee/release-notes/YYYY-MM-DD`
4. Updates the index page at `/how-to/committee/release-notes` with a link to the new entry

### 5. Duplicate Detection

The tool automatically detects existing release notes in the CMS:
- Checks if a page exists for each release note path
- Updates existing pages rather than creating duplicates
- No local state file needed - all state is derived from CMS

If you want to regenerate a release note, simply delete it from the CMS first.

## Release Note Format

Each release note page follows this format:

```markdown
# 01-Dec-2025 — Enhance Walk Import To Support Images [#95](...)

## [Build #361](...) — [commit c8dd64](...)

_____

## New Features

* **walks**: add GPX route upload and selection ([#109](...))
  Additional details from commit body...

## Bug Fixes

* **walks-upload**: prevent unpublish failure when no walks selected ([#112](...))
```

The index page is updated with:
```markdown
- [01-Dec-2025 — #95 — Enhance Walk Import To Support Images](/how-to/committee/release-notes/2025-12-01)

Entries display ISO-derived dates using the `dd-MMM-yyyy` format (for example `11-Nov-2025`) while still being sorted by the underlying ISO date to keep the newest release first.
```

## Integration with CI/CD

### GitHub Actions Integration

Release notes generation is integrated into the main deployment workflow at `.github/workflows/build-push-and-deploy-ngx-ramblers-docker-image.yml`.

The step runs automatically after deployment when:
- Pushing to the `main` branch
- The deployment succeeds

It generates release notes for all commits since the last deployment and includes the GitHub Actions run number as the build number.

**Required Secrets:**
Add these to your GitHub repository secrets:
- `CMS_USERNAME` - Your CMS username with contentAdmin permission
- `CMS_PASSWORD` - Your CMS password

The integration will:
1. Parse commits since the last tag (or last 10 commits if no tag)
2. Group commits by date and issue number (hybrid approach)
3. Create separate pages when multiple issues exist on the same date
4. Authenticate with the CMS and publish the release notes
5. Update the index page with links to new entries

## Troubleshooting

### Testing Authentication

Always test authentication first:
```bash
npm run release-notes:test-auth
```

This will identify issues with:
- CMS URL accessibility
- Username/password correctness
- User permissions (contentAdmin required)
- Network connectivity

### Authentication Failures

If you get authentication errors:
1. Run `npm run release-notes:test-auth` to diagnose
2. Verify your CMS credentials are correct
3. Ensure the user has `contentAdmin` permission
4. Check the CMS URL is correct and accessible

### Missing Commits

If commits aren't appearing:
1. Ensure they follow conventional commit format
2. Check if the release note already exists in the CMS
3. Use the appropriate date range option to include those commits

### Regenerating Release Notes

To regenerate an existing release note:
1. Delete the page from the CMS (or use the delete-pages script)
2. Run the tool again for that date range

The tool will create/update pages based on what exists in the CMS.

### Page Not Found

If the index page isn't found:
1. Verify the page exists at `/how-to/committee/release-notes`
2. Check you have permission to edit it
3. Ensure the CMS is accessible

## Development

### Project Structure

```
server/lib/release-notes/
├── types.ts                    # TypeScript interfaces
├── commit-parser.ts            # Git commit parsing
├── content-generator.ts        # Markdown and page content generation
├── cms-client.ts               # CMS API client with JWT auth
├── generate-release-notes.ts   # Main CLI entry point
└── README.md                   # This file
```

### Adding New Features

To modify the content format:
1. Update `content-generator.ts` functions
2. Adjust `generateMarkdown()` or `generatePageContent()`

To add new CLI options:
1. Update the `program` definition in `generate-release-notes.ts`
2. Add corresponding logic in `commandLineMode()`

### Testing

To test locally without publishing:

```bash
npm run release-notes -- --latest --dry-run
```

This will show what would be generated without making API calls.

## Security

- Credentials are never stored in the repository
- Use environment variables or interactive prompts
- JWT tokens are short-lived (12 hours in production)
- The tool requires `contentAdmin` permission

## Contributing

When making changes:
1. Follow the existing code style
2. Use conventional commits for your changes
3. Test with `--dry-run` first
4. Update this README if adding new features

## License

ISC
