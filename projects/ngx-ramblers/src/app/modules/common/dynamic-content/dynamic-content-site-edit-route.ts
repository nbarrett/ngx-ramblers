import { Component, Input } from "@angular/core";
import { PageContentRow } from "../../../models/content-text.model";
import { RouteDetailsEdit } from "./route-details-edit";

@Component({
  selector: "app-dynamic-content-site-edit-route",
  template: `
    <div class="row mb-3 thumbnail-heading-frame">
      <div class="thumbnail-heading">Route details</div>
      <div class="col-12">
        <app-route-details-edit [row]="row" [id]="id"/>
      </div>
    </div>
  `,
  imports: [RouteDetailsEdit]
})
export class DynamicContentSiteEditRoute {
  @Input() row!: PageContentRow;
  @Input() id = "route-row";
}
