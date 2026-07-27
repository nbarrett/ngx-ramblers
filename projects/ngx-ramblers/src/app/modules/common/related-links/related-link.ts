import { Component, Input } from "@angular/core";

@Component({
    selector: "[app-related-link]",
    template: `
      <div class="related-link-row">
        <div class="related-link-title" [style.min-width.px]="mediaWidth">
          <ng-content select="[title]"/>
        </div>
        <div class="related-link-content">
          <ng-content select="[content]"/>
        </div>
      </div>`,
    styles: [`
      :host
        display: block

      .related-link-row
        display: flex
        align-items: center

      .related-link-title
        flex: 0 0 auto

      .related-link-content
        flex: 1 1 auto
        min-width: 0
        margin-left: 0.5rem
    `]
})
export class RelatedLinkComponent {

  @Input()
  public mediaWidth: number;

}
