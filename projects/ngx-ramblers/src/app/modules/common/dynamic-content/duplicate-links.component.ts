import { Component, Input } from "@angular/core";
import { ContentTextUsageWarning } from "../../../models/content-text.model";

@Component({
  selector: "app-duplicate-links",
  template: `
    <div>{{ duplicateWarning.message }}:</div>
    @for (link of duplicateWarning.links; track link.href) {
      <a [href]="link.href">{{ link.title }}</a>
    }
  `,
})
export class DuplicateLinksComponent {
  @Input() duplicateWarning: ContentTextUsageWarning;
}
