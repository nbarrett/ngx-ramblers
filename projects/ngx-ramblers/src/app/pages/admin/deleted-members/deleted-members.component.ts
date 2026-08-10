import { Component, inject, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faDownload, faMagnifyingGlass, faUserXmark } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../models/alert-target.model";
import { DeletedMember } from "../../../models/member.model";
import { memberFullName } from "../../../functions/member-names";
import { sortBy } from "../../../functions/arrays";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { DeletedMemberService } from "../../../services/member/deleted-member.service";
import { PageComponent } from "../../../page/page.component";
import { DisplayDateAndTimePipe } from "../../../pipes/display-date-and-time.pipe";

@Component({
  selector: "app-deleted-members",
  imports: [PageComponent, FormsModule, FontAwesomeModule, DisplayDateAndTimePipe],
  template: `
    <app-page pageTitle="Member deletions">
      <div class="rounded img-thumbnail p-3">
        <div class="alert alert-warning d-flex align-items-start gap-2 mb-3">
          <fa-icon [icon]="faUserXmark" class="mt-1"/>
          <div>
            <strong>Audit of deleted members</strong>
            <div>Every bulk deletion records who removed the member, when, and enough identifying detail to trace the
              person back to the source documents. Membership number alone is no longer a reliable key.</div>
          </div>
        </div>
        <div class="d-flex align-items-center gap-2 mb-3">
          <label class="mb-0 fw-bold" for="deleted-search">Search:</label>
          <div class="position-relative flex-grow-1">
            <fa-icon [icon]="faMagnifyingGlass" class="position-absolute top-50 translate-middle-y ms-2 text-muted"/>
            <input id="deleted-search" class="form-control ps-4" type="text" [(ngModel)]="search"
                   placeholder="Search name, email, membership number, phone or reference">
          </div>
          <span class="text-muted text-nowrap">{{ filtered().length }} of {{ deletedMembers.length }}</span>
        </div>
        <div class="table-responsive">
          <table class="table table-sm table-hover align-middle">
            <thead>
              <tr>
                <th class="pointer text-nowrap" (click)="sortByField('deletedAt')">Deleted</th>
                <th class="pointer text-nowrap" (click)="sortByField('deletedBy')">Deleted by</th>
                <th class="pointer text-nowrap" (click)="sortByField('membershipNumber')">Membership #</th>
                <th class="pointer text-nowrap" (click)="sortByField('lastName')">Name</th>
                <th class="pointer text-nowrap" (click)="sortByField('email')">Email</th>
                <th class="text-nowrap">Mobile</th>
                <th class="text-nowrap">Postcode</th>
                <th class="text-nowrap">Trace references</th>
              </tr>
            </thead>
            <tbody>
              @for (record of filtered(); track record.memberId + record.deletedAt) {
                <tr>
                  <td class="text-nowrap">{{ record.deletedAt | displayDateAndTime }}</td>
                  <td class="text-nowrap">{{ record.deletedBy }}</td>
                  <td class="text-nowrap">{{ record.membershipNumber || "—" }}</td>
                  <td class="text-nowrap">{{ fullName(record) || "—" }}</td>
                  <td>{{ record.email || "—" }}</td>
                  <td class="text-nowrap">{{ record.mobileNumber || "—" }}</td>
                  <td class="text-nowrap">{{ record.postcode || "—" }}</td>
                  <td class="small text-muted">{{ traceReferences(record) || "—" }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8" class="text-center text-muted py-4">No member deletions recorded.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </app-page>
  `
})
export class DeletedMembersComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("DeletedMembersComponent", NgxLoggerLevel.ERROR);
  private notifierService = inject(NotifierService);
  private deletedMemberService = inject(DeletedMemberService);

  protected readonly faUserXmark = faUserXmark;
  protected readonly faMagnifyingGlass = faMagnifyingGlass;
  protected readonly faDownload = faDownload;

  public notifyTarget: AlertTarget = {};
  public notify: AlertInstance;
  public deletedMembers: DeletedMember[] = [];
  public search = "";
  private sortField = "deletedAt";
  private sortReverse = true;

  async ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.deletedMembers = await this.deletedMemberService.all();
    this.logger.info("loaded", this.deletedMembers.length, "deleted member records");
  }

  fullName(record: DeletedMember): string {
    return memberFullName(record);
  }

  traceReferences(record: DeletedMember): string {
    return [
      record.contactId ? `Contact ${record.contactId}` : null,
      record.salesforceMemberRef ? `Ramblers ${record.salesforceMemberRef}` : null,
      record.salesforceId ? `SF ${record.salesforceId}` : null,
      record.brevoContactId ? `Brevo ${record.brevoContactId}` : null,
      record.userName ? `User ${record.userName}` : null
    ].filter(Boolean).join(" · ");
  }

  sortByField(field: string): void {
    this.sortReverse = this.sortField === field ? !this.sortReverse : false;
    this.sortField = field;
  }

  filtered(): DeletedMember[] {
    const term = this.search.trim().toLowerCase();
    const matches = term
      ? this.deletedMembers.filter(record => [
          record.membershipNumber, record.email, record.mobileNumber, record.postcode,
          record.contactId, record.salesforceMemberRef, record.salesforceId, record.userName,
          record.deletedBy, memberFullName(record)
        ].some(value => (value || "").toString().toLowerCase().includes(term)))
      : [...this.deletedMembers];
    const sorted = matches.sort(sortBy(this.sortField));
    return this.sortReverse ? sorted.reverse() : sorted;
  }
}
