import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleExclamation } from "@fortawesome/free-solid-svg-icons";
import { kebabCase } from "es-toolkit/compat";
import { AdminSettingsPath } from "../../../models/admin-route-paths.model";
import { ExternalSystemsSubTab, SystemSettingsTab } from "../../../models/system.model";
import { StoredValue } from "../../../models/ui-actions";

@Component({
  selector: "app-os-maps-login-required-alert",
  imports: [FontAwesomeModule, RouterLink],
  template: `
    <div class="alert alert-warning d-flex align-items-start gap-2 mb-0" role="alert">
      <fa-icon class="mt-1" [icon]="faCircleExclamation"/>
      <div>
        <strong>OS Maps login is not set up</strong>
        <div>
          Add the OS Maps email and password in
          <a [routerLink]="'/' + settingsPath" [queryParams]="settingsQueryParams">System settings</a>.
        </div>
      </div>
    </div>
  `
})
export class OsMapsLoginRequiredAlertComponent {
  faCircleExclamation = faCircleExclamation;
  settingsPath = AdminSettingsPath.SYSTEM_SETTINGS;
  settingsQueryParams = {
    [StoredValue.TAB]: kebabCase(SystemSettingsTab.EXTERNAL_SYSTEMS),
    [StoredValue.SUB_TAB]: ExternalSystemsSubTab.MAPS
  };
}
