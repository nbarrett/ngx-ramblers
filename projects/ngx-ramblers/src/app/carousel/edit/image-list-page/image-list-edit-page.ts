import { Component, Input, OnInit } from "@angular/core";
import { UrlService } from "../../../services/url.service";

@Component({
  selector: "app-list-edit-page",
  templateUrl: "./image-list-edit-page.html"
})
export class ImageListEditPageComponent implements OnInit {
  public editing = this.urlService.lastPathSegment() !== "carousel-editor";

  constructor(private urlService: UrlService) {
  }

  @Input()
  name: string;

  ngOnInit() {
  }

  backToEditorHome() {
    this.urlService.navigateTo("admin", "carousel-editor");
  }
}
