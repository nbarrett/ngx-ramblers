import { marked } from "marked";
import { resourceAwsImageUrls } from "../../../projects/ngx-ramblers/src/app/functions/aws-image-paths";

export function renderMarkdownToHtml(markdown: string): string {
  if (!markdown) {
    return "";
  }
  return resourceAwsImageUrls(marked.parse(markdown, {async: false}) as string);
}
