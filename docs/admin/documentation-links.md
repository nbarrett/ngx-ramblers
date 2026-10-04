# Links to the reader’s website

CMS documentation and release notes can link directly to a feature on the reader’s own website. Readers choose **Your website** once. The choice is remembered across documentation pages, and can be changed or cleared in the same selector.

## Try a link

[Open the walks programme on your website](/walks "{{siteUrl}}").

Click the link, choose your website in the dialog and press **Open on this website**. A previous choice is remembered. Clear **Your website** at the top of the page to try the first-visit prompt again.

If you arrive directly from a registered group website, the dialog can suggest that site from the referring page. It cannot read your general browsing history. You can choose a different site.

## Add a link

Use a site-relative destination and put `{{siteUrl}}` in the Markdown link title:

```markdown
[Open Inbox](/admin/inbox "{{siteUrl}}")
[Mailing lists](/admin/mail-settings?tab=lists "{{siteUrl}}")
```

The renderer turns these into ordinary links on the chosen website, keeping query parameters and fragments. Before a website is chosen, clicking the link opens a website selection dialog. Choose your group and press **Open on this website** to continue to the feature you clicked. The path remains a valid fallback on hosts running an earlier renderer.

The older destination form `[Open Inbox]({{siteUrl}}/admin/inbox)` is supported too. Prefer the title form when updating published content because its destination also works before the updated renderer is deployed.

Use normal links for documentation pages, external services, examples of exact configuration URLs and platform administration. A group website does not provide the platform administration tools. Existing sign-in and permissions checks still apply at each destination.

## Sweep existing documentation

From the repository root, run the CMS login helper with the target URL supplied explicitly:

```bash
CMS_URL=https://group.example.org.uk .agents/skills/connect-env-db/scripts/with-cms-login.sh server/node_modules/.bin/tsx server/lib/cli/index.ts documentation-links --url https://group.example.org.uk --report non-vcs/documentation-links-report.json
```

Review the report and the before/after output, then repeat with `--apply`. The command saves the original pages beside the report, checks for concurrent edits before writing each page and verifies the saved content. Only the changed text fields are written, so legacy fields and other page data are preserved. It scans all How-To pages and their referenced shared fragments, including nested content. It does not change images, code fences, exact OAuth examples, external consoles or platform links. Re-running the sweep leaves already converted links unchanged.

Future release notes use the same conversion when they are generated. Menu destinations are taken from the existing route models and CMS menu titles; ambiguous references remain unchanged for review.
