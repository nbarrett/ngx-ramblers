import { Component, Input, OnInit } from "@angular/core";
import { NgStyle } from "@angular/common";

@Component({
    selector: "[app-related-link]",
    templateUrl: "./related-link.component.html",
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
