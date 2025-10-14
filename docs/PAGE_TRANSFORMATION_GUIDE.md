# Page Transformation Configuration Guide

## Overview

The Page Transformation system provides a flexible, declarative way to configure how scraped HTML pages are transformed into PageContent objects. Instead of hard-coded parsing logic, you can define a sequence of transformation steps that describe exactly how content should be structured.

## Core Concepts

### Transformation Pipeline

A page transformation consists of a series of steps that are executed in order:

1. **Convert to Markdown** - Converts scraped HTML to markdown
2. **Create Page** - Initializes the page content object
3. **Add Row** - Creates a new row with configured columns
4. **Add Column** - Adds a column to an existing row
5. **Add Nested Rows** - Adds nested rows within a column
6. **Content Matchers** - Find and extract specific content (text, images, headings)

### Content Matchers

Content matchers allow you to specify what content should be placed in each column:

#### Text Patterns
- `ALL_TEXT_UNTIL_IMAGE` - All text content before the first image
- `ALL_TEXT_AFTER_HEADING` - Heading and subsequent text until next image
- `REMAINING_TEXT` - All unused text content
- `PARAGRAPH` - Single paragraph/text segment
- `STARTS_WITH_HEADING` - Text starting with a markdown heading (h1-h6)
- `CUSTOM_REGEX` - Match text using custom regular expression (requires `customRegex` field)

#### Image Patterns
- `FIRST_IMAGE` - First unused image (most commonly used)
- `REMAINING_IMAGES` - All unused images (consumes all remaining)
- `ALL_IMAGES` - All images, regardless of whether they've been used
- `FILENAME_PATTERN` - Match images by filename (supports wildcards like `*route*.jpg`, requires `filenamePattern` field)
- `ALT_TEXT_PATTERN` - Match images by alt text (requires `altTextPattern` field)

## Example Configurations

### Example 1: Simple Full-Width Page

This is the simplest configuration - convert everything to markdown and display in a single full-width column:

```json
{
  "name": "Simple Full Width",
  "description": "Basic single-column layout",
  "enabled": true,
  "steps": [
    {
      "type": "convert-to-markdown"
    },
    {
      "type": "create-page"
    },
    {
      "type": "add-row",
      "rowConfig": {
        "type": "TEXT",
        "maxColumns": 1,
        "showSwiper": false,
        "columns": [
          {
            "columns": 12,
            "content": {
              "type": "all"
            }
          }
        ]
      }
    }
  ]
}
```

### Example 2: Two Column with Featured Image

This configuration creates a complex layout:
- Row 1: Full-width text before first image
- Row 2: Two columns
  - Column 1 (8/12 width): Featured image
  - Column 2 (4/12 width): Nested rows with remaining content

```json
{
  "name": "Two Column with Featured Image",
  "description": "Intro text full-width, then two columns with featured image and remaining content",
  "enabled": true,
  "steps": [
    {
      "type": "convert-to-markdown"
    },
    {
      "type": "create-page"
    },
    {
      "type": "add-row",
      "rowConfig": {
        "type": "TEXT",
        "maxColumns": 1,
        "showSwiper": false,
        "description": "Full-width row with heading and initial text",
        "columns": [
          {
            "columns": 12,
            "content": {
              "type": "text",
              "textPattern": "all-text-until-image"
            }
          }
        ]
      }
    },
    {
      "type": "add-row",
      "rowConfig": {
        "type": "TEXT",
        "maxColumns": 2,
        "showSwiper": false,
        "description": "Two-column row: featured image (8 cols) and remaining content (4 cols)",
        "columns": [
          {
            "columns": 8,
            "content": {
              "type": "image",
              "imagePattern": "first-image"
            }
          },
          {
            "columns": 4,
            "nestedRows": []
          }
        ]
      }
    },
    {
      "type": "add-nested-rows",
      "targetRow": 1,
      "targetColumn": 1,
      "contentMatcher": {
        "type": "remaining"
      }
    }
  ]
}
```

### Example 3: Two-Column Layout with Images

Creates a two-column layout with images interspersed with text:

```json
{
  "name": "Two Column with Images",
  "description": "Text on left (8 cols), images on right (4 cols)",
  "enabled": true,
  "steps": [
    {
      "type": "convert-to-markdown"
    },
    {
      "type": "create-page"
    },
    {
      "type": "add-row",
      "rowConfig": {
        "type": "TEXT",
        "maxColumns": 2,
        "showSwiper": false,
        "columns": [
          {
            "columns": 8,
            "content": {
              "type": "text",
              "textPattern": "all-text-until-image"
            }
          },
          {
            "columns": 4,
            "content": {
              "type": "image",
              "imagePattern": "first-image"
            }
          }
        ]
      }
    },
    {
      "type": "add-row",
      "rowConfig": {
        "type": "TEXT",
        "maxColumns": 1,
        "showSwiper": false,
        "columns": [
          {
            "columns": 12,
            "content": {
              "type": "text",
              "textPattern": "remaining-text"
            }
          }
        ]
      }
    }
  ]
}
```

### Example 4: Using Custom Regex for Specific Text

Extract specific sections using custom regex patterns:

```json
{
  "name": "Custom Regex Extraction",
  "description": "Use regex to match specific text patterns",
  "enabled": true,
  "steps": [
    {
      "type": "convert-to-markdown"
    },
    {
      "type": "create-page"
    },
    {
      "type": "add-row",
      "rowConfig": {
        "type": "TEXT",
        "maxColumns": 1,
        "showSwiper": false,
        "description": "Extract heading and intro paragraph",
        "columns": [
          {
            "columns": 12,
            "content": {
              "type": "text",
              "textPattern": "custom-regex",
              "customRegex": "^###\\s+.+[\\s\\S]*?(?=###|$)"
            }
          }
        ]
      }
    },
    {
      "type": "add-row",
      "rowConfig": {
        "type": "TEXT",
        "maxColumns": 1,
        "showSwiper": false,
        "columns": [
          {
            "columns": 12,
            "content": {
              "type": "text",
              "textPattern": "remaining-text"
            }
          }
        ]
      }
    }
  ]
}
```

### Example 5: Filename Pattern for Specific Images

Match specific images by filename pattern:

```json
{
  "name": "Route Map Layout",
  "description": "Show route map image specifically, with remaining images in gallery",
  "enabled": true,
  "steps": [
    {
      "type": "convert-to-markdown"
    },
    {
      "type": "create-page"
    },
    {
      "type": "add-row",
      "rowConfig": {
        "type": "TEXT",
        "maxColumns": 2,
        "showSwiper": false,
        "description": "Route map on left, intro text on right",
        "columns": [
          {
            "columns": 8,
            "content": {
              "type": "image",
              "imagePattern": "filename-pattern",
              "filenamePattern": "*route-map*"
            }
          },
          {
            "columns": 4,
            "content": {
              "type": "text",
              "textPattern": "all-text-until-image"
            }
          }
        ]
      }
    },
    {
      "type": "add-row",
      "rowConfig": {
        "type": "TEXT",
        "maxColumns": 3,
        "showSwiper": false,
        "description": "Remaining images in 3-column gallery",
        "columns": [
          {"columns": 4, "content": {"type": "image", "imagePattern": "remaining-images"}},
          {"columns": 4, "content": {"type": "image", "imagePattern": "remaining-images"}},
          {"columns": 4, "content": {"type": "image", "imagePattern": "remaining-images"}}
        ]
      }
    }
  ]
}
```

### Example 6: Using ALL_IMAGES for Multiple Copies

When you need to show the same images multiple times:

```json
{
  "name": "All Images Layout",
  "description": "Show all images in header, then again in gallery",
  "enabled": true,
  "steps": [
    {
      "type": "convert-to-markdown"
    },
    {
      "type": "create-page"
    },
    {
      "type": "add-row",
      "rowConfig": {
        "type": "TEXT",
        "maxColumns": 1,
        "showSwiper": true,
        "description": "Image carousel at top",
        "columns": [
          {
            "columns": 12,
            "content": {
              "type": "image",
              "imagePattern": "all-images"
            }
          }
        ]
      }
    },
    {
      "type": "add-row",
      "rowConfig": {
        "type": "TEXT",
        "maxColumns": 1,
        "showSwiper": false,
        "columns": [
          {
            "columns": 12,
            "content": {
              "type": "text",
              "textPattern": "remaining-text"
            }
          }
        ]
      }
    }
  ]
}
```

## Using the UI Configuration Tool

### Location
Navigate to: `http://localhost:4200/admin/migration-settings?tab=settings`

### Configuring Transformations

1. **Per-Parent-Page Configuration**: Each parent page can have its own transformation
   - Expand the parent page configuration
   - Click on "Page Transformation Configuration (optional)"
   - Configure transformation steps

2. **Site-Wide Default**: Define a default transformation for all pages in a site
   - Add `defaultPageTransformation` to the site configuration
   - This will be used when no per-page transformation is specified

### Step Editor

The UI provides:
- **Add Step** button to add new transformation steps
- **Step type dropdown** to select action type
- **Visual form controls** for all configuration options
- **Move Up/Down** buttons to reorder steps
- **Delete** button to remove steps
- **Insert Column** button to add columns at specific positions
- **Preset template**: "Load Default" for quick setup

### UI Field Reference

**Step-Level Fields:**
- **Action** dropdown: Select transformation action type (Convert to Markdown, Create Page, Add Row, etc.)
- **Type** dropdown (when Action = Add Row): Select PageContentType (Text or Action Buttons)
- **Max Cols** input (when Type = Action Buttons): Number of button columns (1-12)

**Row-Level Fields:**
- **Description** (optional): Human-readable description of what this row does
- **Show Swiper** checkbox: Enable image carousel/swiper for this row

**Column-Level Fields:**
- **Width** (1-12): Bootstrap column width (12 = full width)
- **Content Type**: What content to match (Text, Image, Heading, All Content, Remaining, None)
- **Text Pattern** (when Content Type = Text): How to match text content
  - Until image, After heading, Remaining, Paragraph, With heading, Custom regex
- **Image Pattern** (when Content Type = Image): How to match images
  - First, Remaining, All, Filename, Alt text
- **Custom Regex Pattern** (when Text Pattern = Custom regex): Your regex pattern
- **Filename Pattern** (when Image Pattern = Filename): Wildcard pattern (e.g., `*route-map*`)
- **Alt Text Pattern** (when Image Pattern = Alt text): Regex pattern for alt text
- **Border Radius** (optional): Image border radius in pixels
- **Alt Text** (optional): Override alt text for image

**Nested Rows:**
- **Target Row** (when Action = Add Nested Rows): Zero-based row index (0 = first row)
- **Target Column** (when Action = Add Nested Rows): Zero-based column index (0 = first column)
- **Content Matcher**: What content to populate nested rows with (typically "remaining")

## Step-by-Step: Creating a Transformation

### 1. Define the Goal
Describe in plain language what you want:
- "I want heading and text in row 1"
- "I want route map on the left, remaining content on the right"
- "Images should be 3 columns wide, text should fill the rest"

### 2. Break Down into Rows
Sketch out the row structure:
```
Row 1: Full width (12 cols)
  - Column 1: All text until first image

Row 2: Two columns
  - Column 1: Route map image (8 cols)
  - Column 2: Nested rows with remaining content (4 cols)
```

### 3. Create Transformation Steps

For each row:
1. Add a "Convert to Markdown" step (once at the start)
2. Add a "Create Page" step (once after convert)
3. Add an "Add Row" step with row configuration
4. If using nested rows, add "Add Nested Rows" step

### 4. Configure Content Matchers

For each column, specify what content to match:
- Use "all-text-until-image" for intro text
- Use "filename-pattern" with wildcards for specific images
- Use "remaining" to consume all unused content

### 5. Test and Refine

1. Save the configuration
2. Run a migration with `persistData: false` (dry run)
3. Check the Activity tab for output
4. Adjust matchers and row configs as needed

## Common Patterns

### Pattern: Hero Section with Image
```json
{
  "type": "add-row",
  "rowConfig": {
    "type": "TEXT",
    "maxColumns": 2,
    "showSwiper": false,
    "columns": [
      {
        "columns": 9,
        "content": {"type": "heading"}
      },
      {
        "columns": 3,
        "content": {
          "type": "image",
          "imagePattern": "first-image"
        }
      }
    ]
  }
}
```

### Pattern: Sidebar Layout
```json
{
  "type": "add-row",
  "rowConfig": {
    "type": "TEXT",
    "maxColumns": 2,
    "showSwiper": false,
    "columns": [
      {
        "columns": 8,
        "content": {"type": "text", "textPattern": "remaining-text"}
      },
      {
        "columns": 4,
        "nestedRows": []
      }
    ]
  }
}
```

### Pattern: Gallery Grid
```json
{
  "type": "add-row",
  "rowConfig": {
    "type": "TEXT",
    "maxColumns": 3,
    "showSwiper": false,
    "columns": [
      {"columns": 4, "content": {"type": "image", "imagePattern": "first-image"}},
      {"columns": 4, "content": {"type": "image", "imagePattern": "first-image"}},
      {"columns": 4, "content": {"type": "image", "imagePattern": "first-image"}}
    ]
  }
}
```

## Troubleshooting

### Issue: Content Not Appearing
**Cause**: Content matcher didn't match anything
**Solution**: Check the Activity log for matcher debug output. Adjust pattern or use "all" to see all content first.

### Issue: Wrong Image Selected
**Cause**: Filename pattern too broad or too narrow
**Solution**: Use more specific patterns. Check image filenames in scraped content. Use exclusion patterns in site config if needed.

### Issue: Nested Rows Not Populating
**Cause**: targetRow or targetColumn index incorrect
**Solution**: Rows and columns are zero-indexed. Row 1 = index 0. First column in row 2 = targetRow: 1, targetColumn: 0.

### Issue: Text Split Incorrectly
**Cause**: Content matcher using wrong pattern
**Solution**: Try different text patterns. "all-text-until-image" stops at first image, "remaining-text" takes everything unused.

### Issue: Custom Regex Not Matching
**Cause**: Regex pattern syntax incorrect or too specific
**Solution**: Test regex patterns using a tool like regex101.com. Remember to escape special characters. Use `[\\s\\S]*?` for multiline matching. Common patterns:
- Match heading + text: `^###\\s+.+[\\s\\S]*?(?=###|$)`
- Match paragraph: `^[^#\\n].+(?:\\n[^#\\n].+)*`
- Match specific word section: `\\b(keyword)[\\s\\S]*?(?=\\b(next-keyword)|$)`

### Issue: Filename Pattern Not Matching Images
**Cause**: Filename pattern doesn't match actual filenames
**Solution**: Check actual filenames in scraped content. Use wildcards correctly:
- `*route*` matches any file containing "route"
- `*map*.jpg` matches JPG files containing "map"
- Case-sensitive by default - use lowercase patterns
- Patterns match against the full URL path, not just filename

### Issue: ALL_IMAGES vs REMAINING_IMAGES Confusion
**Cause**: Not understanding the difference between these patterns
**Solution**:
- `FIRST_IMAGE` - Takes the next unused image (most common)
- `REMAINING_IMAGES` - Takes ALL unused images, marks them as used
- `ALL_IMAGES` - Takes ALL images, doesn't mark as used (for showing images multiple times)
- Use `ALL_IMAGES` when you want to show images in multiple places (e.g., carousel + gallery)

## API Reference

### TransformationActionType Enum

**Currently Implemented:**
- `CONVERT_TO_MARKDOWN` - Convert HTML to markdown using TurndownService
- `CREATE_PAGE` - Initialize page object with empty rows array
- `ADD_ROW` - Add new row to page with specified columns
- `ADD_COLUMN` - Add column to an existing row (typically used for dynamic column addition)
- `ADD_NESTED_ROWS` - Populate a column with nested rows from remaining content

**Reserved for Future Use:**
- `FIND_AND_ADD_TEXT` - Scan content and add text matching criteria (not yet implemented)
- `FIND_AND_ADD_IMAGE` - Scan content and add image matching criteria (not yet implemented)
- `SPLIT_TEXT_BY_IMAGES` - Split text segments at image boundaries (not yet implemented)
- `FILTER_CONTENT` - Apply content filtering rules (not yet implemented)

### ContentMatchType Enum

Specifies what type of content to match in a column:

- `TEXT` - Match text/markdown content (requires `textPattern`)
- `IMAGE` - Match image content (requires `imagePattern`)
- `HEADING` - Match heading elements (h1-h6)
- `ALL` - Match all remaining content (text + images + headings)
- `REMAINING` - Match all unused content (same as ALL but more explicit)

### TextMatchPattern Enum

Defines how to match text content. Used when `ContentMatchType` is `TEXT`:

- `ALL_TEXT_UNTIL_IMAGE` - Extract all text from current position until the first image is encountered. Commonly used for intro paragraphs.
- `ALL_TEXT_AFTER_HEADING` - Extract heading and all following text until the next heading or image. Good for section extraction.
- `REMAINING_TEXT` - Extract all remaining unused text content. Use at end of transformation to capture everything left.
- `PARAGRAPH` - Extract a single paragraph or text segment. Advances to next segment on each use.
- `STARTS_WITH_HEADING` - Extract text that begins with a markdown heading (# through ######).
- `CUSTOM_REGEX` - Match text using a custom regular expression (requires `customRegex` field). Powerful for complex extraction patterns.

### ImageMatchPattern Enum

Defines how to match images. Used when `ContentMatchType` is `IMAGE`:

- `FIRST_IMAGE` - Extract the first unused image. Most commonly used pattern for single image columns.
- `REMAINING_IMAGES` - Extract ALL remaining unused images and mark them as used. Use when you want to consume all remaining images at once.
- `ALL_IMAGES` - Extract ALL images regardless of whether they've been used. Useful when showing images in multiple places (e.g., carousel + gallery).
- `FILENAME_PATTERN` - Match images by filename using wildcards (requires `filenamePattern` field). Example: `*route-map*.jpg`
- `ALT_TEXT_PATTERN` - Match images by alt text using regex (requires `altTextPattern` field). Example: `^Map of.*`

### ContentMatcher Interface

The complete content matcher configuration:

```typescript
interface ContentMatcher {
  type: ContentMatchType;              // Required: type of content to match
  textPattern?: TextMatchPattern;       // Required if type is TEXT
  imagePattern?: ImageMatchPattern;     // Required if type is IMAGE
  customRegex?: string;                 // Required if textPattern is CUSTOM_REGEX
  filenamePattern?: string;             // Required if imagePattern is FILENAME_PATTERN
  altTextPattern?: string;              // Required if imagePattern is ALT_TEXT_PATTERN
  limit?: number;                       // Optional: max items to extract
}
```

**Example: Custom Regex**
```json
{
  "type": "text",
  "textPattern": "custom-regex",
  "customRegex": "^###\\s+Route Details[\\s\\S]*?(?=###|$)"
}
```

**Example: Filename Pattern**
```json
{
  "type": "image",
  "imagePattern": "filename-pattern",
  "filenamePattern": "*route-map*"
}
```

**Example: Alt Text Pattern**
```json
{
  "type": "image",
  "imagePattern": "alt-text-pattern",
  "altTextPattern": "^Map of.*"
}
```

## Pattern Matching Behavior

### Understanding "Used" vs "Unused" Content

The transformation engine tracks which content has been consumed during transformation:

**Text Content:**
- Starts with all markdown text segments marked as "unused"
- When a text pattern matches and extracts content, those segments are marked as "used"
- `REMAINING_TEXT` extracts all segments still marked as "unused"
- Text patterns like `ALL_TEXT_UNTIL_IMAGE` and `PARAGRAPH` mark consumed text as "used"

**Image Content:**
- All scraped images start as "unused"
- `FIRST_IMAGE` extracts the first unused image and marks it as used
- `REMAINING_IMAGES` extracts ALL unused images and marks them all as used
- `ALL_IMAGES` extracts ALL images but does NOT mark them as used (allows reuse)
- `FILENAME_PATTERN` and `ALT_TEXT_PATTERN` search only unused images (unless used with `ALL_IMAGES` logic)

### Best Practices for Content Extraction

**1. Extract in Order of Specificity**
```
Step 1: Extract specific content (e.g., route map by filename)
Step 2: Extract structured content (e.g., intro text until image)
Step 3: Extract remaining content (e.g., remaining-text, remaining-images)
```

**2. Use REMAINING Patterns Last**
Always use `REMAINING_TEXT` or `REMAINING_IMAGES` in your final rows to ensure no content is lost.

**3. Test Custom Regex Incrementally**
Start with simple patterns and add complexity:
- Test: `^###` (just headings)
- Then: `^###\\s+.+` (heading with text)
- Finally: `^###\\s+.+[\\s\\S]*?(?=###|$)` (heading with all text until next heading)

**4. Filename Patterns Are Case-Sensitive**
- Use lowercase patterns: `*route-map*` not `*Route-Map*`
- Check actual filenames in Activity log output
- Wildcards: `*` matches any characters, so `*map*` matches "route-map.jpg", "overview-map.png", etc.

**5. When to Use Each Image Pattern**

| Pattern | Use Case | Marks as Used? |
|---------|----------|----------------|
| `FIRST_IMAGE` | Single hero image, featured image | Yes |
| `REMAINING_IMAGES` | Image gallery consuming all remaining | Yes |
| `ALL_IMAGES` | Show all images in carousel, then detail | No |
| `FILENAME_PATTERN` | Specific image like route map | Yes |
| `ALT_TEXT_PATTERN` | Images with specific alt text | Yes |

**Example: Complex Multi-Step Extraction**
```json
{
  "steps": [
    {"type": "convert-to-markdown"},
    {"type": "create-page"},

    // Step 1: Extract specific route map image
    {
      "type": "add-row",
      "rowConfig": {
        "columns": [{
          "columns": 12,
          "content": {
            "type": "image",
            "imagePattern": "filename-pattern",
            "filenamePattern": "*route-map*"
          }
        }]
      }
    },

    // Step 2: Extract intro text (before other images)
    {
      "type": "add-row",
      "rowConfig": {
        "columns": [{
          "columns": 12,
          "content": {
            "type": "text",
            "textPattern": "all-text-until-image"
          }
        }]
      }
    },

    // Step 3: Extract first remaining image (after route map)
    {
      "type": "add-row",
      "rowConfig": {
        "columns": [{
          "columns": 6,
          "content": {
            "type": "image",
            "imagePattern": "first-image"
          }
        }, {
          "columns": 6,
          "content": {
            "type": "text",
            "textPattern": "paragraph"
          }
        }]
      }
    },

    // Step 4: Consume all remaining content
    {
      "type": "add-row",
      "rowConfig": {
        "columns": [{
          "columns": 12,
          "content": {
            "type": "remaining"
          }
        }]
      }
    }
  ]
}
```

## Advanced Topics

### Custom Row Types
You can use any PageContentType:
- `TEXT` - Standard text/image rows
- `ACTION_BUTTONS` - Button rows (not typically used in transformation)
- `ALBUM` - Photo gallery (handled separately)

### Bootstrap Grid System
Remember the 12-column grid:
- Full width: 12
- Half width: 6
- Two-thirds: 8, one-third: 4
- Three columns: 4, 4, 4

Columns in a row should sum to 12 for best results.

### Image Styling
Images support:
- `imageBorderRadius` - Border radius in pixels (default: 6)
- `alt` - Alt text (auto-populated from scraped alt)

### Content Exclusions
Before transformation, you can filter content using site config:
- `excludeSelectors` - Remove HTML elements before scraping
- `excludeTextPatterns` - Remove text matching regex
- `excludeMarkdownBlocks` - Remove exact markdown blocks
- `excludeImageUrls` - Don't use specific images

## Future Enhancements

Potential features for future development:
- Visual row builder (drag-and-drop)
- Live preview of transformation
- Import/export transformation templates
- Conditional logic (if heading exists, then...)
- Text manipulation (truncate, append, prepend)
- Multi-page transformations (different config per URL pattern)
- Transformation validation and error handling
