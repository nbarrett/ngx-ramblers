import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { DisplayedWalk, EventType } from "../../../models/walk.model";
import { FormsModule } from "@angular/forms";
import { WalkDisplayService } from "../walk-display.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { Member } from "../../../models/member.model";
import { WalksReferenceService } from "../../../services/walks/walks-reference-data.service";
import { AlertInstance } from "../../../services/notifier.service";
import { sortBy } from "../../../functions/arrays";
import { WalksAndEventsService } from "../../../services/walks-and-events/walks-and-events.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { JsonPipe, NgClass } from "@angular/common";
import { InputSource } from "../../../models/group-event.model";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons";
import { ALERT_WARNING } from "../../../models/alert-target.model";
import { NgSelectComponent } from "@ng-select/ng-select";
import { memberFullName } from "../../../functions/member-names";
import { firstWalkLeaderName, jointWalkLeaderNames } from "../../../functions/walks/joint-walk-leaders";
import { MemberWithLabel } from "../../../models/member.model";
import { EventDefaultsService } from "../../../services/event-defaults.service";

@Component({
  selector: "app-walk-edit-leader",
    imports: [FormsModule, JsonPipe, NgClass, FontAwesomeModule, NgSelectComponent],
  styles: `
    .button-bottom-aligned
      margin: 34px 0px 0px 0px
  `,
  template: `
    @if (displayedWalk?.walk?.fields) {
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
                       [disabled]="inputDisabled"
                       [checked]="showOnlyWalkLeaders"
                       (change)="onShowOnlyWalkLeadersChange(true)">
                <label class="form-check-label" for="showOnlyWalkLeadersTrue">
                  Show Only Walk Leaders ({{ previousWalkLeaderCount }})</label>
              </div>
              <div class="form-check form-check-inline">
                <input id="showOnlyWalkLeadersFalse" type="radio" class="form-check-input"
                       name="showOnlyWalkLeaders"
                       [disabled]="inputDisabled"
                       [checked]="!showOnlyWalkLeaders"
                       (change)="onShowOnlyWalkLeadersChange(false)">
                <label class="form-check-label" for="showOnlyWalkLeadersFalse">
                  Show All Members ({{ allMembers.length }})</label>
              </div>
            </div>
          </div>
          <div class="col-sm-12">
            <div class="form-group">
              <label for="walk-status">Walk Status</label>
              <select [disabled]="!display.allowAdminEdits() || inputDisabled"
                      [(ngModel)]="displayedWalk.status"
                      (change)="onStatusChange()"
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
              <label for="contact-member">Walk leaders</label>
              @if (allowDetailView) {
                <ng-select
                  id="contact-member"
                  [items]="memberLookupItems"
                  bindLabel="ngSelectAttributes.label"
                  bindValue="id"
                  [multiple]="true"
                  [closeOnSelect]="false"
                  [disabled]="inputDisabled"
                  [searchable]="true"
                  [clearable]="true"
                  placeholder="Select one or more walk leaders - first is primary"
                  [ngModel]="selectedWalkLeaderIds"
                  (ngModelChange)="onWalkLeaderIdsChange($event)">
                </ng-select>
                <small class="text-muted">Choose joint leaders together. The first selected leader is the primary contact for email and phone.</small>
              }
            </div>
          </div>
          <div class="col-sm-2 pe-sm-0">
            <div class="form-group">
              <div class="row g-2">
                <div class="col-6">
                  <input type="submit" [disabled]="inputDisabled || saveInProgress" value="Me" (click)="setWalkLeaderToMe()"
                         class="btn btn-primary button-bottom-aligned w-100">
                </div>
                <div class="col-6">
                  <input type="submit" [disabled]="inputDisabled || saveInProgress || !display.hasWalkLeader(displayedWalk.walk)"
                         value="Clear" (click)="clearWalkLeader()"
                         class="btn btn-primary button-bottom-aligned w-100">
                </div>
              </div>
            </div>
          </div>
        </div>
        @if (hasWalkLeaderContactDetails || rematchPreviewMessage) {
          <div class="row">
            <div class="col-sm-10">
              @if (rematchPreviewMessage) {
                <div class="alert mb-3" [ngClass]="rematchPreviewClass">
                  <fa-icon [icon]="faCircleInfo"></fa-icon>
                  <strong> Leader match: </strong>
                  {{ rematchPreviewMessage }}
                </div>
              }
            </div>
            @if (!isManuallyCreated) {
              <div class="col-sm-2 pe-sm-0">
                <div class="form-group mb-0">
                  <input type="submit" [disabled]="inputDisabled || saveInProgress || !hasWalkLeaderContactDetails"
                         value="Rematch"
                         (click)="rematchWalkLeaderRequest.emit()"
                         class="btn btn-primary w-100">
                </div>
              </div>
            }
          </div>
        }
      }
      <div class="row">
        <div [ngClass]="display.allowAdminEdits() ? 'col-sm-5' : 'col-sm-12'">
          <div class="form-group">
            <label for="display-name">Website display name</label>
            <input [(ngModel)]="displayedWalk.walk.fields.contactDetails.displayName"
                   (blur)="rematchPreviewRequest.emit()"
                   type="text"
                   [disabled]="inputDisabled"
                   class="form-control input-sm" id="display-name"
                   placeholder="Shown on this website only (for example Kerry Example)">
          </div>
        </div>
        @if (display.allowAdminEdits()) {
          <div class="col-sm-5">
            <div class="form-group">
              <label for="walk-leader-contact-id">Walks Manager contact name</label>
              <input [disabled]="inputDisabled"
                     [(ngModel)]="displayedWalk.walk.fields.publishing.ramblers.contactName"
                     (blur)="rematchPreviewRequest.emit()"
                     type="text"
                     class="form-control input-sm flex-grow-1 me-2" id="walk-leader-contact-id"
                     placeholder="Full name as in Walks Manager; used for CSV Walk leaders and volunteer matching">
            </div>
          </div>
          <div class="col-sm-2 pe-sm-0">
            <div class="form-group">
              <input type="submit" [value]="toggleRamblersWalkLeaderContactName"
                     (click)="toggleRamblersWalkLeader()"
                     [disabled]="inputDisabled || saveInProgress"
                     class="btn btn-primary button-bottom-aligned w-100">
            </div>
          </div>
        }
      </div>
      <div class="row">
        <div class="col-sm-12">
          <div class="form-group">
            <label for="contact-phone">Contact Phone</label>
            <input [disabled]="inputDisabled" [(ngModel)]="displayedWalk.walk.fields.contactDetails.phone"
                   (blur)="rematchPreviewRequest.emit()"
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
                     (blur)="rematchPreviewRequest.emit()"
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
    }
  `
})
export class WalkEditLeaderComponent implements OnInit, OnDestroy {
  public displayedWalk!: DisplayedWalk;
  public inputDisabled = false;

  @Input("displayedWalk") set displayedWalkValue(displayedWalk: DisplayedWalk) {
    this.displayedWalk = displayedWalk;
    this.logger.info("displayedWalkValue:displayedWalk:", displayedWalk);
    this.syncSelectedWalkLeaderIdsFromWalk();
    this.rebuildMemberLookupItems();
  }

  @Input("inputDisabled") set inputDisabledValue(inputDisabled: boolean) {
    this.inputDisabled = coerceBooleanProperty(inputDisabled);
  }
  @Input() saveInProgress = false;
  @Input() notify!: AlertInstance;
  @Input() rematchPreviewMessage: string | null = null;
  @Input() rematchPreviewClass = ALERT_WARNING.class;
  @Output() statusChange = new EventEmitter<EventType>();
  @Output() walkLeaderChange = new EventEmitter<void>();
  @Output() clearWalkLeaderRequest = new EventEmitter<void>();
  @Output() rematchWalkLeaderRequest = new EventEmitter<void>();
  @Output() rematchPreviewRequest = new EventEmitter<void>();
  showOnlyWalkLeaders = true;
  previousWalkLeaders: Member[] = [];
  previousWalkLeaderCount = 0;
  allMembers: Member[] = [];
  memberLookupItems: MemberWithLabel[] = [];
  selectedWalkLeaderIds: string[] = [];
  walkStatuses: any[] = [];
  myContactId: string;
  walkLeadContactId: string;
  private subscriptions: Subscription[] = [];
  private applyingWalkLeaders = false;
  protected display = inject(WalkDisplayService);
  private eventDefaultsService = inject(EventDefaultsService);
  private memberLoginService = inject(MemberLoginService);
  private walksAndEventsService = inject(WalksAndEventsService);
  private walksReferenceService = inject(WalksReferenceService);
  private logger: Logger = inject(LoggerFactory).createLogger("WalkEditLeaderComponent", NgxLoggerLevel.ERROR);
  protected readonly faCircleInfo = faCircleInfo;

  async ngOnInit() {
    this.logger.info("ngOnInit:displayedWalk:", this.displayedWalk);
    const previousWalkLeaderIds = await this.walksAndEventsService.queryWalkLeaders();
    this.walkStatuses = this.walksReferenceService.walkEventTypes();
    this.refreshMembers(this.display.members, previousWalkLeaderIds);
    this.subscriptions.push(this.display.memberEvents().subscribe(members => {
      this.refreshMembers(members, previousWalkLeaderIds);
    }));
  }

  private refreshMembers(members: Member[], previousWalkLeaderIds: string[]): void {
    this.allMembers = members.slice().sort(sortBy("firstName", "lastName"));
    this.previousWalkLeaders = this.allMembers
      .filter(member => previousWalkLeaderIds?.includes(member.id));
    this.previousWalkLeaderCount = this.previousWalkLeaders.length;
    this.refreshContactIds();
    this.syncSelectedWalkLeaderIdsFromWalk();
    this.rebuildMemberLookupItems();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  get allowDetailView(): boolean {
    return this.memberLoginService.memberLoggedIn();
  }

  get toggleRamblersWalkLeaderContactName(): string {
    return this.displayedWalk.walk.fields.publishing.ramblers.contactName === this.myContactId ? "Leader" : "Me";
  }

  get hasWalkLeaderContactDetails(): boolean {
    const contactDetails = this.displayedWalk?.walk?.fields?.contactDetails;
    return !!(contactDetails?.displayName || contactDetails?.email || contactDetails?.phone);
  }

  get isManuallyCreated(): boolean {
    return this.displayedWalk?.walk?.fields?.inputSource === InputSource.MANUALLY_CREATED;
  }

  onShowOnlyWalkLeadersChange(showOnly: boolean): void {
    this.showOnlyWalkLeaders = showOnly;
    this.rebuildMemberLookupItems();
  }

  onWalkLeaderIdsChange(ids: string[] | null) {
    if (!this.applyingWalkLeaders) {
      const nextIds = (ids || []).filter(id => !!id);
      if (!this.sameIdSelection(nextIds, this.selectedWalkLeaderIds)) {
        if (nextIds.length === 0) {
          this.selectedWalkLeaderIds = [];
          this.clearWalkLeaderRequest.emit();
        } else {
          const selected = nextIds
            .map(id => this.allMembers.find(member => member.id === id))
            .filter((member): member is Member => !!member);
          this.applyWalkLeaders(selected);
          this.walkLeaderChange.emit();
        }
      }
    }
  }

  clearWalkLeader() {
    if (this.display.hasWalkLeader(this.displayedWalk.walk)) {
      this.logger.info("clearWalkLeader:requested", this.displayedWalk?.walk?.fields?.contactDetails);
      this.selectedWalkLeaderIds = [];
      this.clearWalkLeaderRequest.emit();
    }
  }

  setWalkLeaderToMe() {
    const meId = this.memberLoginService.loggedInMember().memberId;
    const me = this.allMembers.find(member => member.id === meId);
    if (me) {
      const others = this.selectedWalkLeaderIds.filter(id => id !== me.id);
      const selected = [me, ...others.map(id => this.allMembers.find(member => member.id === id)).filter((member): member is Member => !!member)];
      this.applyWalkLeaders(selected);
      this.walkLeaderChange.emit();
    }
  }

  private applyWalkLeaders(selected: Member[]): void {
    this.applyingWalkLeaders = true;
    this.selectedWalkLeaderIds = selected.map(member => member.id);
    this.eventDefaultsService.applyMembersAsWalkLeaders(this.displayedWalk.walk, selected);
    this.rebuildMemberLookupItems();
    this.applyingWalkLeaders = false;
  }

  private syncSelectedWalkLeaderIdsFromWalk(): void {
    if (!this.applyingWalkLeaders && this.displayedWalk?.walk?.fields?.contactDetails) {
      const contactDetails = this.displayedWalk.walk.fields.contactDetails;
      const members = this.allMembers.length > 0 ? this.allMembers : (this.display.members || []);
      const names = jointWalkLeaderNames(contactDetails.displayName || "");
      const matchedByName = names
        .map(name => members.find(member => this.memberMatchesLeaderName(member, name)))
        .filter((member): member is Member => !!member);
      const primary = contactDetails.memberId
        ? members.find(member => member.id === contactDetails.memberId)
        : null;
      const ordered = primary && !matchedByName.some(member => member.id === primary.id)
        ? [primary, ...matchedByName]
        : (matchedByName.length > 0 ? matchedByName : (primary ? [primary] : []));
      const nextIds = ordered.map(member => member.id);
      if (!this.sameIdSelection(nextIds, this.selectedWalkLeaderIds)) {
        this.selectedWalkLeaderIds = nextIds.slice();
      }
    }
  }

  private rebuildMemberLookupItems(): void {
    const base = this.showOnlyWalkLeaders ? this.previousWalkLeaders : this.allMembers;
    const byId = new Map<string, Member>();
    base.forEach(member => byId.set(member.id, member));
    this.selectedWalkLeaderIds.forEach(id => {
      const selected = this.allMembers.find(member => member.id === id) || this.display.members.find(member => member.id === id);
      if (selected) {
        byId.set(selected.id, selected);
      }
    });
    this.memberLookupItems = Array.from(byId.values())
      .sort(sortBy("firstName", "lastName"))
      .map(member => ({
        ...member,
        ngSelectAttributes: { label: member.displayName || memberFullName(member) }
      }));
  }

  private sameIdSelection(left: string[], right: string[]): boolean {
    return left.length === right.length && left.every((id, index) => id === right[index]);
  }

  private memberMatchesLeaderName(member: Member, leaderName: string): boolean {
    const needle = (leaderName || "").trim().toLowerCase();
    const display = (member.displayName || "").trim().toLowerCase();
    const full = memberFullName(member).trim().toLowerCase();
    return !!needle && (display === needle || full === needle || firstWalkLeaderName(display) === needle);
  }

  toggleRamblersWalkLeader() {
    const contactId = this.displayedWalk.walk.fields.publishing.ramblers.contactName === this.myContactId ? this.walkLeadContactId : this.myContactId;
    const targetOverride = this.displayedWalk.walk.fields.publishing.ramblers.contactName === this.myContactId ? "walk leader" : "you";
    this.logger.info("toggleRamblersWalkLeader:current", this.displayedWalk.walk.fields.publishing.ramblers.contactName, "target", contactId, "myContactId", this.myContactId, "walkLeadContactId", this.walkLeadContactId);
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

  onStatusChange() {
    this.logger.info("onStatusChange:selectedStatus", this.displayedWalk?.status, "walkId", this.displayedWalk?.walk?.id);
    this.statusChange.emit(this.displayedWalk.status);
  }
}
