import { Component, EventEmitter, inject, OnInit, Output } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { CommitteeRoleMissingMember, UnassignedCommitteeRole } from "../../../../models/committee.model";
import { Member } from "../../../../models/member.model";
import { LoggerFactory } from "../../../../services/logger-factory.service";
import { InboxService } from "../../../../services/inbox/inbox.service";
import { CommitteeConfigService } from "../../../../services/committee/commitee-config.service";
import { MemberService } from "../../../../services/member/member.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { MemberSelector } from "../../../../shared/components/member-selector";
import { memberFullName } from "../../../../functions/member-names";

@Component({
  selector: "app-committee-unassigned-roles",
  imports: [FontAwesomeModule, MemberSelector],
  template: `
    @if (unassignedRoles.length > 0) {
      <div class="alert alert-warning unassigned-roles">
        <div class="d-flex align-items-start unassigned-title">
          <fa-icon [icon]="faTriangleExclamation" class="mt-1 me-2"/>
          <div>
            <strong>{{ stringUtils.pluraliseWithCount(unassignedRoles.length, "committee role") }} {{ unassignedRoles.length === 1 ? 'points' : 'point' }} at a member who no longer exists -</strong>
            <span class="ms-1">the member record was deleted, so nobody holds the role and its inbox cannot be seen. Pick the member who now holds each role and reassign it. The role's mailbox and settings are kept.</span>
          </div>
        </div>
        <div class="unassigned-body">
          @for (item of unassignedRoles; track item.role.type) {
            <div class="unassigned-row">
              <span class="unassigned-desc">
                <strong>{{ roleLabel(item) }}</strong>
                <span class="d-block small">{{ missingMembersDescription(item) }}</span>
              </span>
              <div class="unassigned-target">
                <app-member-selector [members]="members" placeholder="Reassign to…"
                                     [selectedMember]="selectedMembers[item.role.type] ?? null"
                                     (selectedMemberChange)="selectMember(item, $event)" [disabled]="busy"/>
              </div>
              <button type="button" class="btn btn-sm btn-primary unassigned-action"
                      [disabled]="busy || !selectedMembers[item.role.type]" (click)="reassign(item)">
                Reassign
              </button>
            </div>
          }
          @if (statusMessage) {
            <div class="unassigned-status">{{ statusMessage }}</div>
          }
        </div>
      </div>
    }`,
  styles: [`
    .unassigned-title
      margin-bottom: 1rem
    .unassigned-body
      padding: 0 1rem 0.75rem 1rem
    .unassigned-status
      font-size: 0.875rem
      font-style: italic
    .unassigned-row
      display: flex
      align-items: center
      gap: 0.75rem
      margin-bottom: 0.75rem
      flex-wrap: wrap
    .unassigned-row:last-child
      margin-bottom: 0
    .unassigned-desc
      flex: 1 1 16rem
      min-width: 12rem
    .unassigned-target
      flex: 0 0 auto
      width: 18rem
    .unassigned-action
      flex: 0 0 auto
      min-width: 7rem
  `]
})
export class CommitteeUnassignedRolesComponent implements OnInit {

  @Output() reassigned = new EventEmitter<void>();

  protected readonly faTriangleExclamation = faTriangleExclamation;
  protected unassignedRoles: UnassignedCommitteeRole[] = [];
  protected members: Member[] = [];
  protected selectedMembers: Record<string, Member | null> = {};
  protected busy = false;
  protected statusMessage: string | null = null;

  protected stringUtils = inject(StringUtilsService);
  private dateUtils = inject(DateUtilsService);
  private inboxService = inject(InboxService);
  private committeeConfigService = inject(CommitteeConfigService);
  private memberService = inject(MemberService);
  private logger = inject(LoggerFactory).createLogger("CommitteeUnassignedRolesComponent", NgxLoggerLevel.ERROR);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    try {
      const response = await this.inboxService.unassignedCommitteeRoles();
      this.unassignedRoles = response.unassignedRoles;
      if (this.unassignedRoles.length > 0 && this.members.length === 0) {
        this.members = (await this.memberService.all()).filter(this.memberService.filterFor.COMMITTEE_MEMBERS);
      }
    } catch (error) {
      this.logger.info("unassigned-roles unavailable (likely not a member administrator):", error);
      this.unassignedRoles = [];
    }
  }

  roleLabel(item: UnassignedCommitteeRole): string {
    return item.role.description || this.stringUtils.asTitle(item.role.type);
  }

  missingMembersDescription(item: UnassignedCommitteeRole): string {
    return item.missingMembers.map(missing => this.missingMemberDescription(missing)).join("; ");
  }

  private missingMemberDescription(missing: CommitteeRoleMissingMember): string {
    const who = missing.fullName ? `${missing.fullName}` : "a member record that no longer exists";
    const when = missing.deletedAt ? ` (deleted ${this.dateUtils.displayDateAndTime(missing.deletedAt)})` : "";
    const how = missing.primary ? "Assigned to" : "Also notifies";
    return `${how} ${who}${when}`;
  }

  selectMember(item: UnassignedCommitteeRole, member: Member | null): void {
    this.selectedMembers = {...this.selectedMembers, [item.role.type]: member};
  }

  async reassign(item: UnassignedCommitteeRole): Promise<void> {
    const member = this.selectedMembers[item.role.type] ?? null;
    if (member) {
      this.busy = true;
      this.statusMessage = null;
      try {
        await this.committeeConfigService.reassignRoleMember(item.role.type, item.missingMembers.map(missing => missing.memberId), member);
        this.statusMessage = `Reassigned ${this.roleLabel(item)} to ${memberFullName(member)}.`;
        await this.load();
        this.reassigned.emit();
      } catch (error) {
        this.statusMessage = `Could not reassign: ${(error as Error)?.message ?? error}`;
        this.logger.error("reassign failed:", error);
      } finally {
        this.busy = false;
      }
    }
  }
}
