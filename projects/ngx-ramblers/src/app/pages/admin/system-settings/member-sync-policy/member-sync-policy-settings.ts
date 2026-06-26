import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AUDIT_FIELDS } from "../../../../models/ramblers-insight-hub";
import {
  DEFAULT_MEMBER_SYNC_POLICY,
  MemberSyncPolicy,
  MemberSyncPolicyMode
} from "../../../../models/member-sync-policy.model";
import { MemberSyncPolicyService } from "../../../../services/member/member-sync-policy.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";

interface PolicyModeOption {
  value: MemberSyncPolicyMode;
  label: string;
}

@Component({
  selector: "app-member-sync-policy-settings",
  imports: [FormsModule],
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Member sync policy</div>
      <div class="col-sm-12">
        <p class="form-text text-muted mb-3">
          Controls, field by field, how inbound member data from Head Office (Insight Hub xlsx upload or the Salesforce
          member API) is applied to the local member record. Changes here are saved with the rest of the System Settings
          when you click <em>Save</em>.
        </p>
        <ul class="form-text text-muted mb-3">
          <li><strong>Use legacy rules</strong> — apply today's per-field write rule. May write or skip depending on the rule.</li>
          <li><strong>Always apply Head Office</strong> — write the incoming value unconditionally. The field becomes
            read-only on <code>/admin/contact-details</code>.</li>
          <li><strong>Skip</strong> — ignore the incoming value for this field entirely. The local value is preserved and
            stays editable.</li>
        </ul>
        <div class="row mb-3">
          <div class="col-md-6">
            <label for="member-sync-default-mode">Default mode for unlisted fields</label>
            <select id="member-sync-default-mode"
                    class="form-control input-sm"
                    [ngModel]="policy.defaultMode"
                    (ngModelChange)="setDefaultMode($event)">
              @for (option of modeOptions; track option.value) {
                <option [ngValue]="option.value">{{ option.label }}</option>
              }
            </select>
          </div>
        </div>
        <table class="table table-sm align-middle">
          <thead>
            <tr>
              <th>Field</th>
              <th>Today's legacy rule</th>
              <th>Mode</th>
            </tr>
          </thead>
          <tbody>
            @for (field of auditFields; track field.fieldName) {
              <tr>
                <td><code>{{ field.fieldName }}</code></td>
                <td>{{ field.writeDataIf }}</td>
                <td>
                  <select class="form-control input-sm"
                          [ngModel]="overrideFor(field.fieldName)"
                          (ngModelChange)="setOverride(field.fieldName, $event)">
                    <option [ngValue]="''">(use default)</option>
                    @for (option of modeOptions; track option.value) {
                      <option [ngValue]="option.value">{{ option.label }}</option>
                    }
                  </select>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class MemberSyncPolicySettings implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("MemberSyncPolicySettings", NgxLoggerLevel.ERROR);
  private memberSyncPolicyService = inject(MemberSyncPolicyService);

  protected readonly auditFields = AUDIT_FIELDS;
  policy: MemberSyncPolicy = {defaultMode: DEFAULT_MEMBER_SYNC_POLICY.defaultMode, overrides: {}};
  modeOptions: PolicyModeOption[] = [
    {value: MemberSyncPolicyMode.USE_LEGACY_RULES, label: "Use legacy rules"},
    {value: MemberSyncPolicyMode.ALWAYS_APPLY_HEAD_OFFICE, label: "Always apply Head Office"},
    {value: MemberSyncPolicyMode.SKIP, label: "Skip (keep local)"}
  ];

  private subscriptions: Subscription[] = [];

  async ngOnInit() {
    await this.memberSyncPolicyService.refresh();
    this.subscriptions.push(this.memberSyncPolicyService.events().subscribe(value => {
      this.policy = {defaultMode: value?.defaultMode ?? DEFAULT_MEMBER_SYNC_POLICY.defaultMode, overrides: {...(value?.overrides ?? {})}};
      this.logger.info("policy received", this.policy);
    }));
  }

  setDefaultMode(value: MemberSyncPolicyMode): void {
    this.policy = {...this.policy, defaultMode: value};
    this.pushLocal();
  }

  overrideFor(fieldName: string): MemberSyncPolicyMode | "" {
    return this.policy.overrides?.[fieldName] ?? "";
  }

  setOverride(fieldName: string, value: MemberSyncPolicyMode | ""): void {
    const overrides = {...(this.policy.overrides ?? {})};
    if (value === "" || value === null || value === undefined) {
      delete overrides[fieldName];
    } else {
      overrides[fieldName] = value;
    }
    this.policy = {...this.policy, overrides};
    this.pushLocal();
  }

  pushLocal(): void {
    this.memberSyncPolicyService.setLocal(this.policy);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}
