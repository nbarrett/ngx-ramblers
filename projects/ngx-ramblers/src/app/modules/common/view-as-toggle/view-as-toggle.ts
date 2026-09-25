import { Component, inject } from "@angular/core";
import { UiSwitchModule } from "ngx-ui-switch";
import { ViewAsService } from "../../../services/member/view-as.service";

@Component({
  selector: "app-view-as-toggle",
  templateUrl: "./view-as-toggle.html",
  styleUrls: ["./view-as-toggle.sass"],
  imports: [UiSwitchModule]
})
export class ViewAsToggle {
  protected viewAs = inject(ViewAsService);

  caption(): string {
    return this.viewAs.optedIn() ? "viewing as" : "view as";
  }

  onChange(on: boolean): void {
    this.viewAs.setOptedIn(on);
  }

  toggle(): void {
    this.onChange(!this.viewAs.optedIn());
  }
}
