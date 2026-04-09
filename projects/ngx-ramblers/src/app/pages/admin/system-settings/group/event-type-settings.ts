import { Component, inject, Input, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgxLoggerLevel } from "ngx-logger";
import { EventLeaderContactMethod, EventPopulation, Organisation, SystemConfig } from "../../../../models/system.model";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { enumKeyValues, KeyValue } from "../../../../functions/enums";
import { RamblersEventType } from "../../../../models/ramblers-walks-manager";
import { CommitteeConfigService } from "../../../../services/committee/commitee-config.service";
import { CommitteeMember } from "../../../../models/committee.model";
import { CommitteeReferenceData } from "../../../../services/committee/committee-reference-data";

interface EventTypeFieldMapping {
  population: keyof Organisation;
  detailsPublic: keyof Organisation;
  showOnRamblersLink: keyof Organisation;
  contactMethod: keyof Organisation;
  contactDirect: keyof Organisation;
  contactRole: keyof Organisation;
  legacyContactMethod: keyof Organisation;
  legacyContactDirect: keyof Organisation;
  legacyContactRole: keyof Organisation;
}

const FIELD_MAPPINGS: Record<string, EventTypeFieldMapping> = {
  [RamblersEventType.GROUP_WALK]: {
    population: "walkPopulation",
    detailsPublic: "walkContactDetailsPublic",
    showOnRamblersLink: "showWalkOnRamblersLink",
    contactMethod: "groupWalkContactMethod",
    contactDirect: "groupWalkContactDirect",
    contactRole: "groupWalkContactRole",
    legacyContactMethod: "walkLeaderContactMethod",
    legacyContactDirect: "walkLeaderContactDirect",
    legacyContactRole: "walkLeaderContactRole",
  },
  [RamblersEventType.GROUP_EVENT]: {
    population: "socialEventPopulation",
    detailsPublic: "socialDetailsPublic",
    showOnRamblersLink: "showSocialOnRamblersLink",
    contactMethod: "groupEventContactMethod",
    contactDirect: "groupEventContactDirect",
    contactRole: "groupEventContactRole",
    legacyContactMethod: "walkLeaderContactMethod",
    legacyContactDirect: "walkLeaderContactDirect",
    legacyContactRole: "walkLeaderContactRole",
  }
};

@Component({
  selector: "app-event-type-settings",
  template: `
    <div class="form-group">
      <label [for]="idFor('population')">{{ eventTypeTitle }} Population</label>
      <select [(ngModel)]="group[fields.population]"
              class="form-control" [id]="idFor('population')">
        @for (method of populationMethods; track method.key) {
          <option [ngValue]="method.value">{{ stringUtils.asTitle(method.value) }}</option>
        }
      </select>
    </div>
    <div class="form-group">
      <div class="form-check">
        <input [(ngModel)]="group[fields.detailsPublic]"
               type="checkbox" class="form-check-input"
               [id]="idFor('details-public')">
        <label class="form-check-label"
               [for]="idFor('details-public')">{{ eventTypeTitle }} Contact Details Public Viewable</label>
      </div>
    </div>
    <div class="form-group">
      <div class="form-check">
        <input [(ngModel)]="group[fields.showOnRamblersLink]"
               type="checkbox" class="form-check-input"
               [id]="idFor('show-on-ramblers')">
        <label class="form-check-label"
               [for]="idFor('show-on-ramblers')">Show "On Ramblers" Link for {{ eventTypeTitle }}s</label>
      </div>
    </div>
    <div class="form-group">
      <label [for]="idFor('contact-method')">{{ eventTypeTitle }} Contact Method</label>
      <select [(ngModel)]="group[fields.contactMethod]"
              class="form-control input-sm" [id]="idFor('contact-method')">
        @for (method of eventLeaderContactMethods; track method.key) {
          <option [ngValue]="method.value">{{ stringUtils.asTitle(method.value) }}</option>
        }
      </select>
    </div>
    @if (group[fields.contactMethod] === contactUsValue) {
      <div class="form-group">
        <div class="form-check">
          <input [(ngModel)]="group[fields.contactDirect]"
                 type="checkbox" class="form-check-input"
                 [id]="idFor('contact-direct')">
          <label class="form-check-label"
                 [for]="idFor('contact-direct')">Contact {{ eventTypeTitle }} Leader Directly (when valid email exists)</label>
        </div>
      </div>
      <div class="form-group">
        <label [for]="idFor('contact-role')">Fallback Committee Role ({{ eventTypeTitle }}s)</label>
        <select [(ngModel)]="group[fields.contactRole]"
                class="form-control" [id]="idFor('contact-role')">
          <option [ngValue]="null">None</option>
          @for (role of committeeRoles; track role.type) {
            <option [ngValue]="role.type">{{ role.description }}</option>
          }
        </select>
      </div>
    }`,
  imports: [FormsModule]
})
export class EventTypeSettingsComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("EventTypeSettingsComponent", NgxLoggerLevel.ERROR);
  private committeeConfig = inject(CommitteeConfigService);
  stringUtils = inject(StringUtilsService);
  populationMethods: KeyValue<string>[] = enumKeyValues(EventPopulation);
  eventLeaderContactMethods: KeyValue<string>[] = enumKeyValues(EventLeaderContactMethod);
  contactUsValue = EventLeaderContactMethod.CONTACT_US;
  committeeRoles: CommitteeMember[] = [];

  @Input() config: SystemConfig;
  @Input() eventType: RamblersEventType;

  fields: EventTypeFieldMapping;
  group: Organisation;
  eventTypeTitle: string;

  ngOnInit() {
    this.fields = FIELD_MAPPINGS[this.eventType];
    this.group = this.config.group;
    this.eventTypeTitle = this.stringUtils.asTitle(this.eventType);
    this.applyDefaults();
    this.committeeConfig.committeeReferenceDataEvents().subscribe((data: CommitteeReferenceData) => {
      this.committeeRoles = data.committeeMembers();
    });
  }

  idFor(suffix: string): string {
    return `${this.eventType}-${suffix}`;
  }

  private applyDefaults() {
    if (!this.group[this.fields.contactMethod]) {
      (this.group as any)[this.fields.contactMethod] = this.group[this.fields.legacyContactMethod] ?? EventLeaderContactMethod.CONTACT_US;
    }
    if (this.group[this.fields.contactDirect] === undefined || this.group[this.fields.contactDirect] === null) {
      (this.group as any)[this.fields.contactDirect] = this.group[this.fields.legacyContactDirect] ?? false;
    }
    if (!this.group[this.fields.contactRole]) {
      (this.group as any)[this.fields.contactRole] = this.group[this.fields.legacyContactRole];
    }
    if (this.group[this.fields.showOnRamblersLink] === null || this.group[this.fields.showOnRamblersLink] === undefined) {
      (this.group as any)[this.fields.showOnRamblersLink] = true;
    }
  }
}
