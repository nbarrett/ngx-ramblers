# Content Migration Guide

## Overview

The Content Migration system provides a template-based workflow for migrating pages from external websites into your NGX-Ramblers site structure. Instead of hard-coded parsing logic or abstract transformation steps, you:

1. **Build a visual template** using the page editor
2. **Configure data mappings** for each element (where content comes from)
3. **Apply the template** to migrate multiple pages automatically

### Key Features

- **Visual template creation**: What you build is what migrated pages will look like
- **Declarative mappings**: Configure extraction rules without writing code
- **Dynamic content generation**: Automatically create nested rows from scraped content
- **Reusable templates**: One template can migrate hundreds of pages
- **Parent page support**: Create index pages with action buttons
- **Pattern matching**: Extract specific content using text/image patterns

### Template Types

- **Shared Fragment**: Reusable components (headers, footers, sidebars) inserted into multiple pages
- **User Template**: Custom page layouts for quickly building new pages with consistent structure
- **Migration Template**: Templates with data mappings for migrating content from external sources

## Quick Start

### 1. Create a Migration Template

1. Navigate to a page in site edit mode (e.g., `/routes/example-route`)
2. Build your ideal structure using the page editor:
   - Add rows (Text, Location, Map, Index)
   - Arrange them exactly as you want migrated pages to look
   - Configure row settings (height, columns, visibility)
3. Enable **Template Mode**:
   - Toggle "Template options" switch (top right)
   - Click the **"Migration template"** badge button
4. Enable **Mapping Mode**:
   - Toggle **"Mapping mode"** switch
   - This reveals mapping configuration UI for each row
5. Configure mappings (see sections below)
6. Click **"Create template"** to publish

### 2. Configure Parent Pages

Navigate to **Admin → System Settings → Migration → Settings tab**

1. Add a parent page for your migration
2. Configure the settings (see Parent Page Configuration section)
3. Select your migration template from the "Override Template" dropdown
4. Save configuration

### 3. Run Migration

1. Stay in Migration Settings
2. Configure which pages to migrate
3. Click **Run migration**
4. Monitor progress in the Activity tab

## Parent Page Configuration

Each migration site can have multiple **Parent Pages** - these are index/category pages that contain lists of child pages to migrate.

### Parent Page Settings

For each parent page, configure:

**URL Pattern**: The parent page URL
- Example: `/walks/routes`
- The source page containing links to child pages

**Path Prefix**: Prefix for child page paths
- Example: `walks/routes/`
- Used to construct destination paths for migrated pages

**Link Selector**: CSS selector for child page links (optional)
- Defaults to content area if empty
- Example: `.route-list a` to target specific links

**Max Child Pages**: Limit number of children to migrate (optional)
- Example: `50` to migrate only first 50 pages
- Leave empty to migrate all found pages

### Migrate Parent Page Options

Controls what happens to the parent page itself during migration:

#### Not migrated (default)

- The parent page **itself is skipped**
- Child pages **are still migrated**
- Use when: Parent page doesn't exist or you'll create it manually
- Example: Skip `/walks/routes` but migrate `/walks/routes/wealdway`

#### As-is

- Parent page **is migrated** with its original content
- Content extracted and migrated like any other page
- Use when: Parent page has intro text or useful content to preserve
- Example: `/walks/routes` has introductory text about routes

#### With Links as Action Buttons Row

- Parent page **is migrated** with child page links converted to action buttons
- Creates an **auto-generated index page**
- Use when: You want a navigation/directory page
- Example: `/walks/routes` becomes a page with [Weald Way] [North Downs Way] [Thames Path] buttons

### Override Template (optional)

By default, child pages use the site's default migration template. Use this field to specify a **different template** for children under this parent page.

**Use cases:**
- Different page structures for different sections
  - Routes use "routes-template"
  - Regional routes use "regional-routes-template"
- Special layouts for specific categories
  - Index pages with summaries
  - Detail pages with maps

**How it works:**
- Select a template from the dropdown
- All child pages under this parent use the selected template
- If empty, child pages use the site's default template
- Template selection shows all available migration templates from your `fragments/templates/` folder

**Example configuration:**
```
Parent Page: /walks/routes
├─ Migrate parent page: With Links as Action Buttons Row
├─ Override Template: routes-template
└─ Max child pages: 50

Result:
- /walks/routes → Index page with action buttons
- /walks/routes/wealdway → Uses routes-template
- /walks/routes/north-downs-way → Uses routes-template
```

## Template Creation Workflow

### UI Components

#### Template Options Panel

Located at top of page editor when "Template options" toggle is ON:

```
[Shared fragment][User template][Migration template] [Remove] [Create template] [Mapping mode ☑]
```

- **Type badges**: Select template type
- **Remove**: Clear template configuration
- **Create template**: Publish to fragment library
- **Mapping mode**: Toggle migration mapping UI (migration templates only)

#### Template Library Panel

Shows published templates for reuse:

```
Template library
├─ Dropdown (shows fragment paths)
└─ [Replace] [Append]
```

- **Replace**: Replace current page content with template
- **Append**: Append template to current page

#### Paste Page Content

The page editor includes a **Paste page content** badge next to save/revert buttons. Use this to:

- Clone complex templates between environments
- Try out example content (like `docs/routes-template-page-content.json`)
- Restore earlier snapshots from API explorer

The parser automatically unwraps API response shapes, so you can paste output from `/api/page-content?path=...` directly.

## Data Mapping Configuration

### Row-Level Mappings

When Mapping Mode is enabled, each row shows configuration based on its type.

#### Location Row Mapping

```
Source type: [Extract] [Static] [Metadata]
☑ Extract from content
☑ Hide location row
Default location: [____________]
```

**Extract from content**: Automatically extract location from narrative text
- Looks for postcodes, grid references, place names
- Geocodes to latitude/longitude

**Hide location row**: Make the row invisible
- Row data still available for Map rows via `useLocationFromRow`
- Use when location is only for map positioning, not display

**Default location**: Fallback location if extraction fails
- Example: "Tonbridge, Kent" for Kent-based routes
- Ensures map always has a center point

#### Map Row Mapping

```
☑ Extract GPX from content
GPX file path: [____________]
Use location from row: [0]
```

**Extract GPX from content**: Pull GPX file from source page
- Searches for .gpx file links in source HTML
- Downloads and processes route data

**GPX file path**: Static GPX file path (alternative to extraction)
- Example: `/assets/routes/wealdway.gpx`

**Use location from row**: Row index to get location coordinates from
- Example: `0` references first row (Location row)
- Map centers on this location
- Supports nested row references (e.g., `0.1` = row 0, nested row 1)

#### Metadata Row Mapping

```
Source type: [Metadata ▼]
Field: [Title | Path | Migration note]
Prefix: [Automatically migrated from]
Date format: [yyyy-LL-dd HH:mm]
```

**Field options:**
- `Title`: Page title from scraped metadata
- `Path`: Source page URL/path
- `Migration note`: "Migrated from [URL] on [date]" footer

**Customization:**
- `metadataPrefix`: Custom prefix text (default: "Migrated from")
- `metadataDateFormat`: Luxon format string (default: "yyyy-LL-dd HH:mm")

#### Index Row Mapping

Index rows use existing Index row settings:
- Content types (walks, routes, social events)
- Render modes (carousel, grid, list)
- Map settings (clustering, markers)

No additional mapping configuration required.

### Column-Level Mappings

For rows with columns containing nested rows, column-level mapping configuration appears.

#### Column Mapping UI

```
Column 2 Mapping
─────────────────────────────────────
Source Type: [Extract | Static | Not mapped]
Content Type: [Text | Image | Mixed]

Nested Rows Configuration
─────────────────────────────────────
Content source: [Extract from content ▼]
Packing behavior: [One row per item ▼]
☑ Group text with images

Documentation notes
[Notes about what this mapping does...]
```

#### Content Source Options

**Not mapped**
- Column stays exactly as designed in template
- Use for static content (headers, footers, shared fragments)

**Extract from content**
- Populate from scraped page data
- Requires Content Type and packing configuration

**Static content**
- Use template content as-is
- Allows adding documentation notes

#### Content Type (what to extract)

**Remaining images**
- Images not yet consumed by other mappings
- Recommended for galleries to avoid duplication
- Each column gets unique images

**Remaining text**
- Text segments (paragraphs, headings) still unused
- Recommended catch-all for narrative text
- Prevents double-rendering content

**All content**
- Every text and image segment in source order
- Use when column should mirror original story exactly

**All images**
- Every image, even if already used elsewhere
- Use when multiple galleries need same images

**Pattern match**
- Only segments matching custom pattern
- Supports regex, filename glob, CSS selector
- Pattern input appears when selected

#### Packing Behavior (when extracting)

**One row per item**
- Create separate nested row for each extracted item
- Example: One nested row per image
- Repeats until no matches remain

**All in one row**
- Put all extracted content in single nested row
- Example: All narrative text in one row
- Produces single combined row

**Collect with breaks**
- Group content based on document structure
- Smart breaking on headings, images, paragraphs
- Configurable break points

#### Additional Options

**Group text with images** (`groupTextWithImage`)
- Associates caption text with each image
- Looks for text immediately following image
- Critical for preserving image captions

**Hide row if empty** (`hideIfEmpty`)
- Removes entire row when no content extracted
- Prevents blank placeholders
- Useful for optional sections

**Documentation notes**
- Explain what this mapping does
- Visible in mapping mode
- Example: "Points-of-interest sidebar with remaining images"

### Dynamic Target Rows

When Mapping mode is enabled, you can mark any nested row as a **Dynamic target** using the badge button in the nested row header (stacked-layers icon).

**What it does:**
- Marks which nested row will be cloned and populated with extracted content
- The selected row becomes the template for dynamically generated rows
- Only one nested row can be the dynamic target per column

**How it works:**
1. Content Source specifies **what** to extract and **how** to pack it
2. Dynamic target button specifies **which row structure** to use
3. When migration runs:
   - Extracts content based on Content Type setting
   - Clones the target nested row
   - Fills clone with extracted content
   - Repeats if packing behavior is "one-per-item"
4. Other nested rows (without button) are static and added after dynamic rows

**Example:**

```
Nested Rows Configuration:
├─ Content source: remaining-images
├─ Packing: one-per-item
│
├─ Nested Row 1 (Text) ← "Use as dynamic target" (active)
│  └─ Column: image + caption placeholder
│
└─ Nested Row 2 (Shared Fragment) ← Static row
    └─ Shared fragment reference
```

**Result:**
- Nested row 1 cloned for each remaining image
- Each clone filled with image + caption
- Nested row 2 (shared fragment) added once at end

### Column Processing Order

**Important:** When a row has multiple columns with dynamic collection, order matters:

1. **Columns with `remaining-images`** processed **first**
   - Allows images to capture their caption text
2. **Columns with `remaining-text`** processed **second**
   - Gets narrative text after images claimed captions

This ensures images grab caption text before remaining-text column consumes all text.

**Implementation:** The system automatically sorts column mappings by priority:
1. Pattern-match images (specific content)
2. Remaining-images with `groupTextWithImage: true`
3. Other content types
4. Remaining-images without text grouping

## Content Matchers & Patterns

### Text Patterns

Used when Content Type is `TEXT`:

**ALL_TEXT_UNTIL_IMAGE**
- Extract all text from current position until first image
- Commonly used for intro paragraphs
- Stops at first image boundary

**ALL_TEXT_AFTER_HEADING**
- Extract heading and following text until next heading or image
- Good for section extraction
- Captures semantic blocks

**REMAINING_TEXT**
- Extract all remaining unused text content
- Use at end of transformation to capture everything left
- Ensures no content is lost

**PARAGRAPH**
- Extract single paragraph or text segment
- Advances to next segment on each use
- For granular text extraction

**STARTS_WITH_HEADING**
- Extract text beginning with markdown heading (# through ######)
- Filters to heading-led sections
- Useful for structured content

**CUSTOM_REGEX**
- Match text using custom regular expression
- Requires `customRegex` field
- Powerful for complex extraction patterns
- Test patterns using regex101.com

### Image Patterns

Used when Content Type is `IMAGE`:

**FIRST_IMAGE**
- Extract first unused image
- Most commonly used pattern
- Marks image as used

**REMAINING_IMAGES**
- Extract ALL remaining unused images
- Marks all as used
- Use when consuming all remaining images

**ALL_IMAGES**
- Extract ALL images regardless of used status
- Does NOT mark as used
- Useful for showing images in multiple places (carousel + gallery)

**FILENAME_PATTERN**
- Match images by filename using wildcards
- Requires `filenamePattern` field
- Example: `*route-map*.jpg`
- Case-sensitive matching

**ALT_TEXT_PATTERN**
- Match images by alt text using regex
- Requires `altTextPattern` field
- Example: `^Map of.*`
- Useful for semantic image selection

### Pattern Usage Table

| Pattern | Use Case | Marks as Used? |
|---------|----------|----------------|
| `FIRST_IMAGE` | Single hero image, featured image | Yes |
| `REMAINING_IMAGES` | Gallery consuming all remaining | Yes |
| `ALL_IMAGES` | Show all images in carousel, then detail | No |
| `FILENAME_PATTERN` | Specific image like route map | Yes |
| `ALT_TEXT_PATTERN` | Images with specific alt text | Yes |

### Understanding "Used" vs "Unused" Content

The transformation engine tracks which content has been consumed:

**Text Content:**
- Starts with all markdown text segments marked as "unused"
- When text pattern matches and extracts content, segments marked as "used"
- `REMAINING_TEXT` extracts all segments still marked "unused"

**Image Content:**
- All scraped images start as "unused"
- `FIRST_IMAGE` extracts first unused image and marks it used
- `REMAINING_IMAGES` extracts ALL unused images and marks all used
- `ALL_IMAGES` extracts ALL images but does NOT mark them used (allows reuse)

### Best Practices for Content Extraction

**1. Extract in Order of Specificity**
```
Step 1: Extract specific content (e.g., route map by filename)
Step 2: Extract structured content (e.g., intro text until image)
Step 3: Extract remaining content (e.g., remaining-text, remaining-images)
```

**2. Use REMAINING Patterns Last**
Always use `REMAINING_TEXT` or `REMAINING_IMAGES` in final rows to ensure no content is lost.

**3. Test Custom Regex Incrementally**
Start simple and add complexity:
- Test: `^###` (just headings)
- Then: `^###\\s+.+` (heading with text)
- Finally: `^###\\s+.+[\\s\\S]*?(?=###|$)` (heading with all text until next heading)

**4. Filename Patterns Are Case-Sensitive**
- Use lowercase patterns: `*route-map*` not `*Route-Map*`
- Check actual filenames in Activity log output
- Wildcards: `*` matches any characters

**5. Extract Images Before Text**
When both use `remaining-*` patterns, ensure images process first to capture captions before text consumes them.

## Common Template Patterns

### Pattern: Two-Column Layout with Featured Image

```
Row 1: Full-width intro text
Row 2: Two columns
  ├─ Column 1 (8 cols): Featured image
  └─ Column 2 (4 cols): Remaining content in nested rows
```

**Mapping:**
- Row 1, Column 1: Text pattern = `ALL_TEXT_UNTIL_IMAGE`
- Row 2, Column 1: Image pattern = `FIRST_IMAGE`
- Row 2, Column 2: Content source = `remaining-text`, Packing = `all-in-one`

### Pattern: Route Page with Hidden Location

```
Row 1: Location (hidden)
Row 2: Map (references Row 1)
Row 3: Two columns (narrative + sidebar)
  ├─ Column 1 (8 cols): Main narrative text
  └─ Column 2 (4 cols): Points of interest images
```

**Mapping:**
- Row 1: Extract from content ☑, Hide row ☑
- Row 2: Use location from row = `0`
- Row 3, Column 1: Content source = `remaining-text`, Packing = `all-in-one`
- Row 3, Column 2: Content source = `remaining-images`, Packing = `one-per-item`, Group text with images ☑

### Pattern: Photo Gallery with Map

```
Row 1: Two columns
  ├─ Column 1 (6 cols): Map showing photo locations
  └─ Column 2 (6 cols): Dynamic gallery (one row per photo)
```

**Mapping:**
- Row 1, Column 1: Static (map configured in template)
- Row 1, Column 2: Content source = `remaining-images`, Packing = `one-per-item`

### Pattern: Index Page with Action Buttons

```
Row 1: Intro text
Row 2: Index row (maps + clustering)
Row 3: Action buttons for child pages
```

**Parent Page:**
- Migrate parent page: `With Links as Action Buttons Row`
- This automatically creates Row 3 with buttons

## Advanced Topics

### Nested Row Mappings Data Model

```typescript
interface NestedRowMappingConfig {
  contentSource: 'remaining-images' | 'remaining-text' | 'all-content' | 'all-images' | 'pattern-match';
  packingBehavior: 'one-per-item' | 'all-in-one' | 'collect-with-breaks';
  breakOn?: 'image' | 'heading' | 'paragraph';
  stopOn?: 'image' | 'heading';
  groupTextWithImage?: boolean;
  filenamePattern?: string;
  textPattern?: string;
  imagePattern?: string;
}
```

### Column-Level Mappings Data Model

```typescript
interface ColumnMappingConfig {
  columnIndex: number;
  sourceType?: 'extract' | 'static' | 'metadata';
  contentType?: 'text' | 'image' | 'mixed';
  extractPreset?: string;
  extractPattern?: string;
  nestedRowMapping?: NestedRowMappingConfig;
  notes?: string;
}
```

### Row-Level Mappings Data Model

```typescript
interface MigrationTemplateMapping {
  targetRowIndex: number;
  sourceType?: 'extract' | 'static' | 'metadata';

  // Type-specific mappings
  location?: MigrationTemplateLocationMapping;
  map?: MigrationTemplateMapMapping;
  index?: MigrationTemplateIndexMapping;

  columnMappings?: ColumnMappingConfig[];
  hideIfEmpty?: boolean;
  notes?: string;
}
```

### Bootstrap Grid System

Remember the 12-column grid:
- Full width: 12
- Half width: 6
- Two-thirds: 8, one-third: 4
- Three columns: 4, 4, 4

Columns in a row should sum to 12 for best results.

### Image Styling

Images support:
- `imageBorderRadius`: Border radius in pixels (default: 6)
- `alt`: Alt text (auto-populated from scraped alt)
- `imageSource`: URL to image file

### Content Exclusions

Before transformation, filter content using site config:
- `excludeSelectors`: Remove HTML elements before scraping
- `excludeTextPatterns`: Remove text matching regex
- `excludeMarkdownBlocks`: Remove exact markdown blocks
- `excludeImageUrls`: Don't use specific images

## Troubleshooting

### Template Issues

**Template not appearing in library**
- Check template was published (click "Create template")
- Verify "Template options" toggle is ON
- Check fragment path doesn't conflict with existing content

**Mapping mode not showing**
- Ensure "Migration template" type is selected
- Toggle "Mapping mode" switch

### Content Extraction Issues

**Content not appearing**
- Check Activity log for matcher debug output
- Adjust pattern or use "all" to see all content first
- Verify content source (remaining vs all)

**Wrong image selected**
- Filename pattern too broad or too narrow
- Check image filenames in scraped content
- Use more specific patterns

**Images show placeholder text instead of captions**
- Set `groupTextWithImage: true` in nested row mapping
- Ensure images processed before remaining-text

**Narrative column includes image caption headings**
- System auto-sorts to process images first
- Verify column processing order in mappings

**Nested rows not populating**
- Check targetRow and targetColumn index (zero-based)
- Verify dynamic target row is marked
- Check content source pattern matches content

**Text split incorrectly**
- Try different text patterns
- `ALL_TEXT_UNTIL_IMAGE` stops at first image
- `REMAINING_TEXT` takes everything unused

**Custom regex not matching**
- Test regex using regex101.com
- Escape special characters
- Use `[\\s\\S]*?` for multiline matching
- Common patterns:
  - Match heading + text: `^###\\s+.+[\\s\\S]*?(?=###|$)`
  - Match paragraph: `^[^#\\n].+(?:\\n[^#\\n].+)*`

**Filename pattern not matching images**
- Check actual filenames in scraped content
- Use wildcards correctly: `*route*` matches any file containing "route"
- Case-sensitive by default
- Patterns match against full URL path, not just filename

**No nested rows generated**
- Content type pattern didn't match anything
- Check debug logs in Activity tab
- Verify content source (e.g., "remaining-images" vs "all-images")

**All content in one nested row when expecting multiple**
- Packing behavior set to "all-in-one"
- Change to "one-per-item" for separate rows

### Location & Map Issues

**Location extraction not working**
- Verify narrative contains postcode or grid reference
- Check extraction logs in browser console
- Use default location as fallback

**Map not centering on location**
- Check `useLocationFromRow` index is correct
- Verify location row has valid coordinates
- Review location extraction success in logs

**Blank maps showing**
- No valid location data extracted
- Maps now automatically hidden when no coordinates
- Check location row configuration

## Example Workflows

### Example 1: Migrating Route Pages

**Goal:** Migrate old route pages with location extraction, map display, and narrative content.

**Template Structure:**
```
Row 0: Location (hidden, extracted from content)
Row 1: Map (500px height, uses location from Row 0)
Row 2: Two columns
  ├─ Column 1 (8 cols): Main narrative text
  └─ Column 2 (4 cols): Points of interest images with captions
Row 3: Migration note (metadata)
```

**Mappings:**
1. Row 0 (Location):
   - Extract from content: ☑
   - Hide row: ☑
   - Default location: "Kent, England"

2. Row 1 (Map):
   - Use location from row: `0`
   - Auto-fit bounds: ☑

3. Row 2, Column 1:
   - Source type: Extract
   - Content type: Text
   - Nested rows: Content source = `remaining-text`, Packing = `all-in-one`

4. Row 2, Column 2:
   - Source type: Extract
   - Content type: Mixed
   - Nested rows: Content source = `remaining-images`, Packing = `one-per-item`, Group text ☑
   - Notes: "Points-of-interest sidebar with image captions"

5. Row 3 (Metadata):
   - Source type: Metadata
   - Field: Migration note
   - Prefix: "Migrated from"

**Parent Page Config:**
- URL: `/walks/routes`
- Migrate parent page: `With Links as Action Buttons Row`
- Override template: `routes-template`
- Max children: 100

**Result:** All route pages get consistent structure with extracted locations, centered maps, narrative text, and image galleries with preserved captions.

### Example 2: Photo Gallery Migration

**Goal:** Complex gallery with map showing photo locations and dynamic nested rows.

**Template Structure:**
```
Row 0: Title and description
Row 1: Two columns
  ├─ Column 1 (6 cols):
  │   ├─ Nested Row 0: Description text
  │   ├─ Nested Row 1: Location (hidden)
  │   └─ Nested Row 2: Map (references nested row 1)
  └─ Column 2 (6 cols): Dynamic gallery rows (one per photo)
```

**Mappings:**
1. Row 1, Column 1:
   - Source type: Static
   - Nested rows configured in template

2. Row 1, Column 2:
   - Source type: Extract
   - Content source: `remaining-images`
   - Packing: `one-per-item`
   - Mark Nested Row 0 as dynamic target

**Result:** Gallery page with map on left, dynamically generated photo rows on right (one row per image).

## Implementation Status

### ✅ Completed

- Template type system (Shared/User/Migration)
- Template UI with badge button groups
- Template publishing to fragment library
- Location row mapping UI
- Map row mapping UI
- Metadata row mapping UI
- Column-level mapping UI for nested rows
  - Content source selection
  - Packing behavior configuration
  - Content type selection
  - Pattern matching support
- Dynamic target row selection
- Template descriptions
- Paste page content functionality
- Basic template transformation engine (`transformWithTemplate`)
  - Static row cloning
  - Metadata population
  - Location/Map row handling
- Column mapping data model
- Migration runtime integration
  - Site-level template selection
  - Parent page template override
  - Template priority over legacy transformations
- Dynamic nested row extraction
  - Column mappings drive row generation
  - Shared fragments preserved
  - `hideIfEmpty` support
- Column processing order optimization
  - Images processed before text
  - Caption preservation for image galleries

### 🚧 In Progress

- GPX file extraction from content
- Advanced pattern matching for text extraction
- Enhanced location narrative parsing

### 📋 Planned

- Template preview in migration settings
- Batch migration with templates
- Template validation
- Visual mapping UI with drag-and-drop
- Template marketplace for sharing
- Migration preview/diff view
- Rollback capability
- Template versioning
- Real-time migration progress tracking
- Error recovery and retry logic

## File Locations

### Frontend

**Models:**
- `projects/ngx-ramblers/src/app/models/content-text.model.ts` - Template types, mapping interfaces

**Components:**
- `projects/ngx-ramblers/src/app/modules/common/dynamic-content/dynamic-content-site-edit.ts` - Template UI, mapping mode
- `projects/ngx-ramblers/src/app/modules/common/dynamic-content/dynamic-content-site-edit-text-row.ts` - Column mapping UI
- `projects/ngx-ramblers/src/app/pages/admin/system-settings/migration/migration-settings.ts` - Parent page configuration

**Services:**
- `projects/ngx-ramblers/src/app/pages/admin/data-population.service.ts` - Template descriptions

### Backend

**Migration Engine:**
- `server/lib/migration/page-transformation-engine.ts` - Template transformation engine
  - `transformWithTemplate()` method (line ~1600)
  - Column mapping processing (line ~1750)
  - Content extraction and nested row generation

**Migrations:**
- `server/lib/mongo/migrations/database/20251121090000-rename-fragment-index-to-content-templates.ts` - Template library setup

**Migration Service:**
- `server/lib/migration/migrate-static-site-engine.ts` - Site migration orchestration
  - Template loading and caching
  - Parent page template override logic

## Routes Template Example

The repository includes `docs/routes-template-page-content.json` as a reference implementation containing:

- Full `fragments/templates/routes-template` structure
- Populated rows based on example walk
- Mapping definitions for title, location, map, narrative, and sidebar
- Clean markdown with helper text removed

**To use:**
1. Open `/admin/page-content/fragments/templates/routes-template`
2. Click **Paste page content**
3. Paste JSON from `docs/routes-template-page-content.json`
4. Click **Apply pasted content**
5. Save template

This gives you a working baseline to experiment with mappings and configurations.

## Related Documentation

- **Database Migrations**: See `docs/admin/MIGRATIONS.md` for MongoDB schema migrations (different topic)
- **Phase 7 Overview**: Historical context in `docs/MIGRATION_PHASE_7.md` (superseded by this guide)
