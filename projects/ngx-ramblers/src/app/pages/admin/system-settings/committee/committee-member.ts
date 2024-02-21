import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { CommitteeMember } from "../../../../models/committee.model";
import { Member } from "../../../../models/member.model";
import { FullNamePipe } from "../../../../pipes/full-name.pipe";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { StringUtilsService } from "../../../../services/string-utils.service";

@Component({
  selector: "app-committee-member",
  template: `
    <div *ngIf="committeeMember" class="img-thumbnail thumbnail-2">
      <div class="thumbnail-heading">{{ committeeMember.description }}</div>
      <div class="row p-1">
        <div class="col-sm-12">
          <div class="form-group">
            <label [for]="stringUtils.kebabCase('committee-member-description',committeeMember.memberId)"
                   class="control-label">Role Description</label>
            <div class="form-inline">
              <input [(ngModel)]="committeeMember.description"
                     [id]="stringUtils.kebabCase('committee-member-description',committeeMember.memberId)"
                     name="showDetail" type="text" class="form-control flex-grow-1">
              <div class="custom-control custom-checkbox">
                <input type="checkbox" class="custom-control-input"
                       [(ngModel)]="committeeMember.vacant"
                       (ngModelChange)="roleChange()"
                       [id]="stringUtils.kebabCase(committeeMember.description +'-role-is-vacant')">
                <label class="custom-control-label custom-control-label mx-3"
                       [for]="stringUtils.kebabCase(committeeMember.description +'-role-is-vacant')">
                  Role is vacant</label>
              </div>
            </div>
          </div>
        </div>
        <div class="col-sm-4">
          <app-committee-member-lookup [disabled]="committeeMember.vacant" [committeeMember]="committeeMember"
                                       (memberChange)="setOtherMemberFields($event)">
          </app-committee-member-lookup>
        </div>
        <div class="col-sm-4">
          <div class="form-group">
            <label [for]="stringUtils.kebabCase('committee-member-email',committeeMember.memberId)"
                   class="control-label">Email Address</label>
            <input [(ngModel)]="committeeMember.email" [disabled]="committeeMember.vacant"
                   [id]="stringUtils.kebabCase('committee-member-email',committeeMember.memberId)"
                   name="showDetail" type="text" class="form-control">
          </div>
        </div>
        <div class="col-sm-4">
          <div class="form-group">
            <label [for]="stringUtils.kebabCase('committee-member-fullName',committeeMember.memberId)"
                   class="control-label">Full Name</label>
            <input [(ngModel)]="committeeMember.fullName" [disabled]="committeeMember.vacant"
                   [id]="stringUtils.kebabCase('committee-member-fullName',committeeMember.memberId)"
                   name="showDetail" type="text" class="form-control">
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ["./committee-member.sass"]
})
export class CommitteeMemberComponent implements OnInit {

  @Input()
  public committeeMember: CommitteeMember;

  private logger: Logger;

  constructor(public stringUtils: StringUtilsService,
              private fullNamePipe: FullNamePipe,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(CommitteeMemberComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.info("ngOnInit", this.committeeMember);
  }

  setOtherMemberFields(member: Member) {
    this.logger.debug("setOtherMemberFields:", member);
    this.committeeMember.fullName = this.fullNamePipe.transform(member);
    this.committeeMember.email = member.email;
  }

  roleChange() {
    if (this.committeeMember.vacant) {
      this.committeeMember.memberId = null;
      this.committeeMember.fullName = null;
      this.committeeMember.email = null;
    }
  }
}
