import { Component, inject, Input, OnInit } from "@angular/core";
import { Image, Organisation } from "../../../models/system.model";
import { UrlService } from "../../../services/url.service";
import { NgStyle } from "@angular/common";
import { cropperTransformStyles } from "../../../functions/image-cropper-styles";

@Component({
    selector: "app-banner-image",
    templateUrl: "./banner-logo.html",
    imports: [NgStyle]
})
export class BannerHeadLogoComponent implements OnInit {
  urlService = inject(UrlService);


  public group: Organisation;

  @Input()
  image: Image;

  imageStyles(): any {
    const styles: any = {"padding.px": this.image?.padding};
    return {...styles, ...cropperTransformStyles(this.image?.cropperPosition || null)};
  }

  ngOnInit(): void {
  }
}
