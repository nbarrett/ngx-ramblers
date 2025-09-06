import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { DisplayedWalk, EventType } from "../../../models/walk.model";
import { FormsModule } from "@angular/forms";
import { WalkDisplayService } from "../walk-display.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { DisplayMember } from "../../../models/member.model";
import { FullNameWithAliasOrMePipe } from "../../../pipes/full-name-with-alias-or-me.pipe";
import { WalksReferenceService } from "../../../services/walks/walks-reference-data.service";
import { AlertInstance } from "../../../services/notifier.service";
import { sortBy } from "../../../functions/arrays";
import { WalksAndEventsService } from "../../../services/walks-and-events/walks-and-events.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { JsonPipe } from "@angular/common";

@Component({
  selector: "app-walk-edit-leader",
  standalone: true,
  imports: [FormsModule, JsonPipe],
  styles: `
    .button-bottom-aligned
      margin: 34px 0px 0px -14px
  `,
  template: `
    <div class="img-thumbnail thumbnail-admin-edit">
      @if (false) {
        <pre>fields:{{ displayedWalk.walk.fields|json }}</pre>
      }
      @if (display.allowAdminEdits()) {
        <div class="row">
          <div class="col-sm-12">
            <div class="form-group">
              <div class="form-check form-check-inline">
                <input id="showOnlyWalkLeadersTrue" type="radio" class="form-check-input"
                       name="showOnlyWalkLeaders"
                       [(ngModel)]="showOnlyWalkLeaders" [value]="true">
                <label class="form-check-label" for="showOnlyWalkLeadersTrue">
                  Show Only Walk Leaders ({{ previousWalkLeadersWithAliasOrMe.length }})</label>
              </div>
              <div class="form-check form-check-inline">
                <input id="showOnlyWalkLeadersFalse" type="radio" class="form-check-input"
                       name="showOnlyWalkLeaders"
                       [(ngModel)]="showOnlyWalkLeaders" [value]="false">
                <label class="form-check-label" for="showOnlyWalkLeadersFalse">
                  Show All Members ({{ membersWithAliasOrMe.length }})</label>
              </div>
            </div>
          </div>
          <div class="col-sm-12">
            <div class="form-group">
              <label for="walk-status">Walk Status</label>
              <select [disabled]="!display.allowAdminEdits()"
                      [(ngModel)]="displayedWalk.status"
                      (change)="statusChange.emit(displayedWalk.status)"
                      class="form-control input-sm" id="walk-status">
                @for (status of walkStatuses; track status.eventType) {
                  <option
                    [ngValue]="status.eventType"
                    [textContent]="status.description">
                  </option>
                }
              </select>
            </div>
          </div>
        </div>
      }
      @if (display.allowAdminEdits()) {
        <div class="row">
          <div class="col-sm-10">
            <div class="form-group">
              <label for="contact-member">Walk Leader</label>
              @if (allowDetailView) {
                <select [disabled]="!display.allowAdminEdits()"
                        (change)="walkLeaderChange.emit()"
                        [(ngModel)]="displayedWalk.walk.fields.contactDetails.memberId"
                        class="form-control" id="contact-member">
                  <option value="">(no walk leader selected)</option>
                  @for (member of memberLookup; track member.memberId) {
                    <option [ngValue]="member.memberId">{{ member.name }}</option>
                  }
                </select>
              }
            </div>
          </div>
          <div class="col-sm-2">
            <div class="form-group">
              <input type="submit" [disabled]="saveInProgress" value="Me" (click)="setWalkLeaderToMe()"
                     class="btn btn-primary button-bottom-aligned w-100">
            </div>
          </div>
        </div>
      }
      @if (display.allowAdminEdits()) {
        <div class="row">
          <div class="col-sm-5">
            <div class="form-group">
              <label for="display-name">Display Name (how it will be published on this walk)</label>
              <input [(ngModel)]="displayedWalk.walk.fields.contactDetails.displayName"
                     type="text"
                     class="form-control input-sm" id="display-name"
                     placeholder="Name as displayed to the public and sent to Ramblers in CSV export file">
            </div>
          </div>
          <div class="col-sm-5">
            <div class="form-group">
              <label for="walk-leader-contact-id">Walks Manager Contact Name</label>
              <input [disabled]="inputDisabled"
                     [(ngModel)]="displayedWalk.walk.fields.publishing.ramblers.contactName"
                     type="text"
                     class="form-control input-sm flex-grow-1 me-2" id="walk-leader-contact-id"
                     placeholder="Name that matches the User Details in Assemble. This will be sent in Ramblers in CSV export file">
            </div>
          </div>
          <div class="col-sm-2">
            <div class="form-group">
              <input type="submit" [value]="toggleRamblersWalkLeaderContactName"
                     (click)="toggleRamblersWalkLeader()"
                     [disabled]="saveInProgress"
                     class="btn btn-primary button-bottom-aligned w-100">
            </div>
          </div>
        </div>
      }
      <div class="row">
        <div class="col-sm-12">
          <div class="form-group">
            <label for="contact-phone">Contact Phone</label>
            <input [disabled]="inputDisabled" [(ngModel)]="displayedWalk.walk.fields.contactDetails.phone"
                   type="text" class="form-control input-sm" id="contact-phone"
                   placeholder="Enter contact phone here">
          </div>
        </div>
      </div>
      <div class="row">
        <div class="col-sm-12">
          <div class="form-group">
            <label for="contact-email">Contact Email</label>
            @if (allowDetailView) {
              <input [disabled]="inputDisabled"
                     [(ngModel)]="displayedWalk.walk.fields.contactDetails.email" type="text"
                     class="form-control input-sm" id="contact-email"
                     placeholder="Enter contact email here">
            }
            @if (!allowDetailView) {
              <input [disabled]="true"
                     value="(login to see this)" type="text"
                     class="form-control input-sm"
                     id="contact-email-hidden">
            }
          </div>
        </div>
      </div>
    </div>
  `
})
export class WalkEditLeaderComponent implements OnInit, OnDestroy {
  public displayedWalk!: DisplayedWalk;
  public inputDisabled = false;

  @Input("displayedWalk") set displayedWalkValue(displayedWalk: DisplayedWalk) {
    this.displayedWalk = displayedWalk;
    this.logger.info("displayedWalkValue:displayedWalk:", displayedWalk);
  }

  @Input("inputDisabled") set inputDisabledValue(inputDisabled: boolean) {
    this.inputDisabled = coerceBooleanProperty(inputDisabled);
  }
  @Input() saveInProgress = false;
  @Input() notify!: AlertInstance;
  @Output() statusChange = new EventEmitter<EventType>();
  @Output() walkLeaderChange = new EventEmitter<void>();
  showOnlyWalkLeaders = true;
  previousWalkLeadersWithAliasOrMe: DisplayMember[] = [];
  membersWithAliasOrMe: DisplayMember[] = [];
  walkStatuses: any[] = [];
  myContactId: string;
  walkLeadContactId: string;
  private subscriptions: Subscription[] = [];
  protected display = inject(WalkDisplayService);
  private memberLoginService = inject(MemberLoginService);
  private walksAndEventsService = inject(WalksAndEventsService);
  private walksReferenceService = inject(WalksReferenceService);
  private fullNameWithAliasOrMePipe = inject(FullNameWithAliasOrMePipe);
  private logger: Logger = inject(LoggerFactory).createLogger("WalkEditLeaderComponent", NgxLoggerLevel.ERROR);

  async ngOnInit() {
    this.logger.info("ngOnInit:displayedWalk:", this.displayedWalk);
    const previousWalkLeaderIds = await this.walksAndEventsService.queryWalkLeaders();
    this.walkStatuses = this.walksReferenceService.walkEventTypes();
    this.membersWithAliasOrMe = this.display.members.sort(sortBy("firstName", "lastName")).map(member => ({
      memberId: member.id,
      name: this.fullNameWithAliasOrMePipe.transform(member),
      contactId: member.contactId,
      displayName: member.displayName,
      firstName: member.firstName,
      lastName: member.lastName,
      membershipNumber: member.membershipNumber
    }));
    this.subscriptions.push(this.display.memberEvents().subscribe(members => {
      this.refreshContactIds();
    }));

    this.previousWalkLeadersWithAliasOrMe = this.membersWithAliasOrMe
      .filter(member => previousWalkLeaderIds?.includes(member.memberId));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  get memberLookup(): DisplayMember[] {
    return this.showOnlyWalkLeaders ? this.previousWalkLeadersWithAliasOrMe : this.membersWithAliasOrMe;
  }

  get allowDetailView(): boolean {
    return this.memberLoginService.memberLoggedIn();
  }

  get toggleRamblersWalkLeaderContactName(): string {
    return this.displayedWalk.walk.fields.publishing.ramblers.contactName === this.myContactId ? "Leader" : "Me";
  }


  setWalkLeaderToMe() {
    this.displayedWalk.walk.fields.contactDetails.memberId = this.memberLoginService.loggedInMember().memberId;
    this.walkLeaderChange.emit();
  }

  toggleRamblersWalkLeader() {
    const contactId = this.displayedWalk.walk.fields.publishing.ramblers.contactName === this.myContactId ? this.walkLeadContactId : this.myContactId;
    const targetOverride = this.displayedWalk.walk.fields.publishing.ramblers.contactName === this.myContactId ? "walk leader" : "you";
    if (contactId) {
      this.displayedWalk.walk.fields.publishing.ramblers.contactName = contactId;
      this.notify.success({
        title: "Walk Leader Overridden",
        message: "Walk Leader will be sent to Ramblers using walk leader as " + contactId
      });
    } else {
      this.notify.warning({
        title: "Walk Leader Override failed",
        message: "Could not Walks Manager Contact Name for " + targetOverride
      });
    }
  }

  private refreshContactIds() {
    this.myContactId = this.display.members.find(member => member.id === this.memberLoginService.loggedInMember().memberId)?.contactId;
    this.walkLeadContactId = this.display.members.find(member => member.id === this.displayedWalk?.walk?.fields?.contactDetails?.memberId)?.contactId;
    this.logger.info("refreshContactIds:myContactId:", this.myContactId, "walkLeadContactId:", this.walkLeadContactId);
  }
}
