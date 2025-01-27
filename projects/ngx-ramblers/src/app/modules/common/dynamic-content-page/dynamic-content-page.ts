import { Component } from "@angular/core";
import { PageComponent } from "../../../page/page.component";
import { DynamicContentComponent } from "../dynamic-content/dynamic-content";

@Component({
    selector: "app-dynamic-content-page",
    templateUrl: "./dynamic-content-page.html",
    styleUrls: ["./dynamic-content-page.sass"],
    imports: [PageComponent, DynamicContentComponent]
})
export class DynamicContentPageComponent {
}
