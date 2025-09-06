import { Component, Input, OnInit } from "@angular/core";
import { NgStyle } from "@angular/common";

@Component({
    selector: "[app-related-link]",
    template: `
      <div class="d-flex align-items-center">
        <div [ngStyle]="{'min-width.px': mediaWidth}">
          <ng-content select="[title]"/>
        </div>
        <div class="ms-2 flex-grow-1">
          <ng-content select="[content]"/>
        </div>
      </div>`,
    imports: [NgStyle]
})
export class RelatedLinkComponent implements OnInit {

  @Input()
  public mediaWidth: number;

  constructor() {
  }

  ngOnInit(): void {
  }

}
