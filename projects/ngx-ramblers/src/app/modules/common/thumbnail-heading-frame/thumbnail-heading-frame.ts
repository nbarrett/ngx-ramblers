import { booleanAttribute, Component, Input } from "@angular/core";

@Component({
  selector: "app-thumbnail-heading-frame",
  host: {
    "[class.fill]": "fill"
  },
  template: `
    <div class="thumbnail-heading-frame" [class.row]="row" [class.thumbnail-heading-frame-compact]="compact">
      @if (heading) {
        <div class="thumbnail-heading" [class.thumbnail-heading-bar]="headingBar">
          <span>{{ heading }}</span>
          <ng-content select="[headingActions]"/>
        </div>
      }
      <ng-content/>
    </div>`,
  styles: [`
    :host
      display: block
    :host.fill
      display: flex
      flex-direction: column
      min-height: 0
      height: 100%
    :host.fill .thumbnail-heading-frame
      flex: 1 1 auto
      min-height: 0
      display: flex
      flex-direction: column
      margin: 0
      background: #fff
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45)
    :host.fill .thumbnail-heading-frame > :not(.thumbnail-heading)
      flex: 1 1 auto
      min-height: 0
  `]
})
export class ThumbnailHeadingFrameComponent {
  @Input() heading: string;
  @Input() row = false;
  @Input() compact = false;
  @Input({transform: booleanAttribute}) fill = false;
  @Input({transform: booleanAttribute}) headingBar = false;
}
