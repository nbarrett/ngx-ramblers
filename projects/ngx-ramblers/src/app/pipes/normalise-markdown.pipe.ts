import { Pipe, PipeTransform } from "@angular/core";
import { normaliseMarkdownText } from "../functions/markdown";

@Pipe({ name: "normaliseMarkdown" })
export class NormaliseMarkdownPipe implements PipeTransform {

  transform(value: string) {
    return normaliseMarkdownText(value);
  }

}
