import { Component, Input } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { SystemConfig } from "../../../../models/system.model";

@Component({
  selector: "app-volunteer-settings",
  imports: [FormsModule],
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Volunteer management</div>
      @if (config) {
        <div class="col-sm-12">
          <p class="my-3">
            Used when volunteer records are brought in from another system. Volunteers who are not
            members have no membership number, so each one is given a reference built from this
            prefix, and an address on this domain where the older records hold none. Both are stored
            with this site's settings, so nothing about one area is built into the product.
          </p>
          <div class="row">
            <div class="col-md-6">
              <div class="form-group">
                <label for="supporter-email-domain">Volunteer email domain</label>
                <input id="supporter-email-domain" type="text" class="form-control input-sm"
                       [(ngModel)]="volunteers.supporterEmailDomain"
                       placeholder="e.g. volunteers.example.org">
                <small class="text-muted">Addresses are generated as first-name.last-name at this
                  domain. Point it at a mailbox this site can read, so anything sent arrives
                  somewhere rather than bouncing.</small>
              </div>
            </div>
            <div class="col-md-6">
              <div class="form-group">
                <label for="supporter-reference-prefix">Volunteer reference prefix</label>
                <input id="supporter-reference-prefix" type="text" class="form-control input-sm"
                       [(ngModel)]="volunteers.supporterReferencePrefix"
                       placeholder="e.g. AV">
                <small class="text-muted">Each imported volunteer is keyed as prefix-id, so repeat
                  imports update the same records rather than creating duplicates. Keep it short and
                  distinct from any real Salesforce reference.</small>
              </div>
            </div>
            <div class="col-md-6">
              <div class="form-group">
                <label for="contact-retention-days">Contact retention window (days)</label>
                <input id="contact-retention-days" type="number" min="1" class="form-control input-sm"
                       [(ngModel)]="volunteers.contactRetentionDays"
                       placeholder="e.g. 730">
                <small class="text-muted">External contacts such as parish council clerks with no
                  parish, authority or group links that have not been updated within this many days
                  are listed for review in the data quality report. Leave blank for no automatic
                  flagging.</small>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class VolunteerSettings {
  @Input() set config(config: SystemConfig) {
    this.systemConfig = config;
    if (config && !config.volunteers) {
      config.volunteers = {};
    }
  }

  get config(): SystemConfig {
    return this.systemConfig;
  }

  get volunteers() {
    return this.systemConfig?.volunteers ?? {};
  }

  private systemConfig: SystemConfig;
}
