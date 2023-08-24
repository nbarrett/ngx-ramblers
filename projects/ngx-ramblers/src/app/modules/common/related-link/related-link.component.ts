import { Component, Input, OnInit } from "@angular/core";

@Component({
  selector: "[app-related-link]",
  templateUrl: "./related-link.component.html"
})
export class RelatedLinkComponent implements OnInit {

  @Input()
  public mediaWidth: number;

  constructor() {
  }

  ngOnInit(): void {
  }

}
