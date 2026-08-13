import { Component, Input } from "@angular/core";

@Component({
  selector: "app-thumbnail-heading-frame",
  template: `
    <div class="thumbnail-heading-frame" [class.row]="row" [class.thumbnail-heading-frame-compact]="compact">
      @if (heading) {
        <div class="thumbnail-heading">{{ heading }}</div>
      }
      <ng-content/>
    </div>`,
  styles: [`
    :host
      display: block
  `]
})
export class ThumbnailHeadingFrameComponent {
  @Input() heading: string;
  @Input() row = false;
  @Input() compact = false;
}
