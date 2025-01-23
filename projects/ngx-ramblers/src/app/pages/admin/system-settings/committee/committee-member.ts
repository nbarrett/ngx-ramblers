import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { BuiltInRole, CommitteeMember, RoleType } from "../../../../models/committee.model";
import { Member } from "../../../../models/member.model";
import { FullNamePipe } from "../../../../pipes/full-name.pipe";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { enumKeyValues, KeyValue } from "../../../../functions/enums";
import { faRemove } from "@fortawesome/free-solid-svg-icons";
import { CommitteeConfigService } from "../../../../services/committee/commitee-config.service";
import { MemberNamingService } from "projects/ngx-ramblers/src/app/services/member/member-naming.service";
import { UrlService } from "../../../../services/url.service";
import { FormsModule } from "@angular/forms";
import { BadgeButtonComponent } from "../../../../modules/common/badge-button/badge-button";
import { CommitteeMemberLookupComponent } from "./committee-member-lookup";
import { CreateOrAmendSenderComponent } from "../../send-emails/create-or-amend-sender";
import { CopyIconComponent } from "../../../../modules/common/copy-icon/copy-icon";
import { MarkdownComponent } from "ngx-markdown";

@Component({
    selector: "app-committee-member",
    template: `
    @if (committeeMember) {
      <div class="img-thumbnail thumbnail-2">
        <div class="thumbnail-heading">Role {{ index + 1 }} of {{ roles.length }}
          : {{ committeeMember.nameAndDescription }}
        </div>
        <div class="row p-3">
          <div class="col-sm-4">
            <div class="form-group">
              <label for="committee-member-description-{{index}}"
              class="control-label">Role Description</label>
              <input [(ngModel)]="committeeMember.description" (ngModelChange)="changeDescription()"
                id="committee-member-description-{{index}}"
                type="text" class="form-control">
            </div>
          </div>
          <div class="col-sm-3">
            <div class="form-group">
              <label for="member-selection-{{index}}">Role Type</label>
              <select class="form-control input-sm"
                [(ngModel)]="committeeMember.roleType"
                id="member-selection-{{index}}">
                @for (type of roleTypes; track type) {
                  <option
                    [ngValue]="type.value">{{ stringUtils.asTitle(type.value) }}
                  </option>
                }
              </select>
            </div>
          </div>
          <div class="col-sm-3">
            <div class="form-group">
              <label for="member-selection-{{index}}">Maps to Built-in Role</label>
              <select class="form-control input-sm"
                [(ngModel)]="committeeMember.builtInRoleMapping"
                id="member-selection-{{index}}">
                @for (type of builtInRoles; track type) {
                  <option
                    [ngValue]="type.value">{{ stringUtils.asTitle(type.value) }}
                  </option>
                }
              </select>
            </div>
          </div>
          <div class="col-sm-2">
            <div class="form-group">
              <label for="committee-member-vacant-{{index}}" class="control-label">
                Role is vacant
              </label>
              <div class="custom-control custom-checkbox">
                <input type="checkbox" class="custom-control-input"
                  [(ngModel)]="committeeMember.vacant"
                  (ngModelChange)="roleChange()"
                  id="committee-member-vacant-{{index}}">
                <label class="custom-control-label" for="committee-member-vacant-{{index}}">
                  <app-badge-button [icon]="faRemove" (click)="deleteRole()"
                    caption="Delete"/>
                </label>
              </div>
            </div>
          </div>
        </div>
        <div class="row p-3">
          <div class="col-sm-4">
            <app-committee-member-lookup [disabled]="committeeMember.vacant" [committeeMember]="committeeMember"
              (memberChange)="setOtherMemberFields($event)"/>
          </div>
          <div class="col-sm-4">
            <div class="form-group">
              <label for="committee-member-fullName-{{index}}"
              class="control-label">Full Name</label>
              <input [(ngModel)]="committeeMember.fullName" [disabled]="committeeMember.vacant"
                (ngModelChange)="changeNameAndDescription()"
                id="committee-member-fullName-{{index}}"
                type="text" class="form-control">
            </div>
          </div>
          <div class="col-sm-4">
            <div class="form-group">
              <label for="committee-member-email-{{index}}"
              class="control-label">Email Address</label>
              <input [(ngModel)]="committeeMember.email" [disabled]="committeeMember.vacant"
                id="committee-member-email-{{index}}"
                type="text" class="form-control">
            </div>
          </div>
        </div>
        <div class="row">
          <div class="col-sm-12" app-create-or-amend-sender [committeeRoleSender]="committeeMember"></div>
        </div>
        @if (committeeMember.roleType!==RoleType.SYSTEM_ROLE) {
          <div class="row mt-1">
            <div class="col-sm-2 ml-3">Markdown Link</div>
            <div class="col-sm-9"><code class="mr-2">{{ markdownLink(committeeMember) }}</code>
            <app-copy-icon title [value]="markdownLink(committeeMember)"
              elementName="markdown link"/>
          </div>
        </div>
        <div class="row mt-2">
          <div class="col-sm-2 ml-3">Link Preview</div>
          <div class="col-sm-6">
            <span class="as-button" markdown>{{ markdownLink(committeeMember) }}</span>
          </div>
        </div>
      }
    </div>
    }
    `,
    styleUrls: ["./committee-member.sass"],
    imports: [FormsModule, BadgeButtonComponent, CommitteeMemberLookupComponent, CreateOrAmendSenderComponent, CopyIconComponent, MarkdownComponent]
})
export class CommitteeMemberComponent implements OnInit {
  constructor(public stringUtils: StringUtilsService,
              private fullNamePipe: FullNamePipe,
              private urlService: UrlService,
              private memberNamingService: MemberNamingService,
              private committeeConfigService: CommitteeConfigService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(CommitteeMemberComponent, NgxLoggerLevel.ERROR);
  }

  @Input()
  public committeeMember: CommitteeMember;

  private logger: Logger;
  @Input() roles!: CommitteeMember[];
  @Input() index!: number;
  roleTypes: KeyValue<string>[] = enumKeyValues(RoleType);
  builtInRoles: KeyValue<string>[] = enumKeyValues(BuiltInRole);
  protected readonly faRemove = faRemove;
  protected readonly RoleType = RoleType;

  ngOnInit() {
    this.logger.info("ngOnInit", this.committeeMember);
  }

  setOtherMemberFields(member: Member) {
    this.logger.debug("setOtherMemberFields:", member);
    this.committeeMember.fullName = this.fullNamePipe.transform(member);
    this.committeeMember.email = member.email;
    this.changeNameAndDescription()
  }

  roleChange() {
    if (this.committeeMember.vacant) {
      this.committeeMember.memberId = null;
      this.committeeMember.fullName = null;
      this.committeeMember.email = null;
    }
  }

  changeDescription() {
    this.committeeMember.type = this.stringUtils.kebabCase(this.committeeMember.description);
    this.changeNameAndDescription();
  }

  changeNameAndDescription() {
    this.committeeMember.nameAndDescription = this.committeeConfigService.nameAndDescriptionFrom(this.committeeMember);
  }

  deleteRole() {
    this.logger.info("deleteRole:", this.committeeMember);
    this.roles.splice(this.index, 1);
  }

  markdownLink(committeeMember: CommitteeMember) {
    const name = this.memberNamingService.firstAndLastNameFrom(committeeMember?.fullName);
    const path = this.urlService.pathSegments().join("/");
    return name ? "[Contact " + name?.firstName + "](?contact-us&role=" + committeeMember?.type + "&redirect=" + path + ")" : null;
  }
}
