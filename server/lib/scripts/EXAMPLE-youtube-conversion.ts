import {
  extractYouTubeId,
  forEachColumn,
  PageContent,
  replaceMarkdownLinks,
  TransformResult,
  updatePages
} from "./cms-update-template";

async function transformPage(pageContent: PageContent): Promise<TransformResult> {
  const changes: string[] = [];
  let modified = false;

  forEachColumn(pageContent, column => {
    if (column.contentText) {
      const {result, replacements} = replaceMarkdownLinks(
        column.contentText,
        (linkText, url) => {
          const youtubeId = extractYouTubeId(url);
          if (youtubeId) {
            column.youtubeId = youtubeId;
            if (!column.alt) {
              column.alt = linkText;
            }
            return {newText: "", transformed: true};
          }
          return {newText: `[${linkText}](${url})`, transformed: false};
        }
      );

      if (replacements > 0) {
        column.contentText = result.trim();
        changes.push(`Converted ${replacements} YouTube link(s): ${column.alt}`);
        modified = true;
      }
    }
  });

  return {modified, changes};
}

updatePages(
  {
    paths: [
      "how-to/committee/editing-content/example-pages/albums/youtube-videos"
    ],
    dryRun: false
  },
  transformPage
);
