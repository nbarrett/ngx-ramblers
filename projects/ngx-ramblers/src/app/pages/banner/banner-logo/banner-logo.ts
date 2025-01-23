import { Component, Input, OnInit } from "@angular/core";
import { Image, Organisation } from "../../../models/system.model";
import { UrlService } from "../../../services/url.service";
import { NgStyle } from "@angular/common";

@Component({
    selector: "app-banner-image",
    templateUrl: "./banner-logo.html",
    imports: [NgStyle]
})
export class BannerHeadLogoComponent implements OnInit {

  public group: Organisation;

  constructor(
    public urlService: UrlService) {
  }

  @Input()
  image: Image;

  ngOnInit(): void {
  }
}
