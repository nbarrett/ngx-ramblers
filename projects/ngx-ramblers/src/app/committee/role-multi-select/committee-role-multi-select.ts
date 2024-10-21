import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild
} from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { CommitteeMember, CommitteeRolesChangeEvent } from "../../models/committee.model";
import { DateUtilsService } from "../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { CommitteeDisplayService } from "../../pages/committee/committee-display.service";
import { NumberUtilsService } from "../../services/number-utils.service";


@Component({
  selector: "app-committee-role-multi-select",
  template: `
    <label *ngIf="label" (click)="toggleExpanded()"
           [for]="id">{{ label }}</label>
    <div *ngIf="ready" [id]="id" (click)="toggleExpanded()">
      <div #dropdownMenu class="dropdown b-dropdown btn-group filter-dropdown w-100 dropdown-custom"
           [ngClass]="{'show':expanded}">
        <button aria-haspopup="menu" [attr.aria-expanded]="expanded"
                class="btn dropdown-toggle btn-secondary btn-sm w-100 btn-normal text-truncate">{{ roleSelection() }}
        </button>
        <ul role="menu" tabindex="-1" class="dropdown-menu p-3 w-100"
            [ngClass]="{'show':expanded}">
          <li role="presentation">
            <form tabindex="-1" class="b-dropdown-form">
              <fieldset class="form-group">
                <div class="custom-control custom-checkbox">
                  <input aria-describedby="route-description"
                         type="checkbox"
                         (change)="selectAllRoleToggle()"
                         [checked]="allSelected()"
                         class="custom-control-input"
                         value="true" [id]="stringUtils.kebabCase('select-all', id)">
                  <label class="custom-control-label my-2" [for]="stringUtils.kebabCase('select-all', id)">
                    {{ allSelected() ? "Select None" : "Select All" }}
                  </label>
                </div>
                <div class="custom-control custom-checkbox"
                     *ngFor="let committeeMember of display.committeeReferenceData.committeeMembers(); let roleIndex = index;">
                  <input aria-describedby="route-description"
                         type="checkbox"
                         (change)="selectRole($event, committeeMember)"
                         [checked]="roleSelected(committeeMember)"
                         class="custom-control-input"
                         value="true" [id]="stringUtils.kebabCase('role', roleIndex, id)">
                  <label class="custom-control-label" [for]="stringUtils.kebabCase('role', roleIndex, id)">
                    {{ committeeMember.fullName }}
                    <small class="d-block">
                      {{ committeeMember.description }}<span class="ml-1 colour-disabled"
                                                             *ngIf="committeeMember.email">{{ committeeMember.email }}</span>
                    </small>
                  </label>
                </div>
              </fieldset>
            </form>
          </li>
        </ul>
      </div>
    </div>`,
  styleUrls: ["./committee-role-multi-select.sass"]
})

export class CommitteeRoleMultiSelectComponent implements OnInit, OnDestroy {
  private logger: Logger;
  private subscriptions: Subscription[] = [];
  expanded = false;
  ready = false;
  public roles: string[] = [];

  constructor(
    public display: CommitteeDisplayService,
    public stringUtils: StringUtilsService,
    protected dateUtils: DateUtilsService,
    private numberUtils: NumberUtilsService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("CommitteeRoleMultiSelectComponent", NgxLoggerLevel.OFF);
  }

  @Input() public showRoleSelectionAs: keyof CommitteeMember;
  @Input() public id: string;

  @Input("roles") set rolesValue(roles: string[] | string) {
    this.roles = this.stringUtils.arrayFromDelimitedData(roles);
  }

  @Output() rolesChange: EventEmitter<CommitteeRolesChangeEvent> = new EventEmitter();

  @ViewChild("dropdownMenu") dropdownMenu: ElementRef;
  @Input() label!: string;

  @HostListener("document:click", ["$event"])
  clickout(event) {
    this.logger.off("clickout:event.target:", event.target, "expanded", this.expanded, "eRef nativeElement", this.dropdownMenu.nativeElement, "contains", this.dropdownMenu.nativeElement.contains(event.target));
    if (!this.dropdownMenu.nativeElement.contains(event.target)) {
      this.expanded = false;
    }
  }

  ngOnInit() {
    this.id = this.numberUtils.generateUid();
    this.logger.debug("subscribing to systemConfigService events");
    this.subscriptions.push(this.display.configEvents().subscribe(() => {
      this.ready = true;
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  toggleExpanded(newValue?: boolean) {
    this.expanded = newValue || !this.expanded;
    this.logger.off("expanded:", this.expanded);
  }


  selectAllRoleToggle() {
    if (this.allSelected()) {
      this.roles=[]
    } else {
      this.roles=this.display.committeeReferenceData.committeeMembers().map(item => item.type);
    }
    this.rolesChange.emit({committeeMember: null, roles: this.roles});
  }

  allSelected() {
    return this.roles.length === this.display.committeeReferenceData.committeeMembers().length;
  }

  selectRole($event: Event, committeeMember: CommitteeMember) {
    this.logger.info("selectRole:", $event.target, "committeeMember:", committeeMember);
    if (this.roles.includes(committeeMember.type)) {
      this.rolesChange.emit({committeeMember, roles: this.roles.filter(item => item !== committeeMember.type)});
    } else if (this.roles.length > 0) {
      this.rolesChange.emit({committeeMember, roles: this.roles.concat(committeeMember.type)});
    } else {
      this.rolesChange.emit({committeeMember, roles: [committeeMember.type]});
    }
  }

  roleSelected(committeeMember: CommitteeMember): boolean {
    return this.roles.includes(committeeMember.type);
  }

  roleSelection() {
    return this.display.committeeReferenceData.committeeMembersForRole(this.roles).map(role => role[this.showRoleSelectionAs || "fullName"]).join(", ") || "Select Roles";
  }
}
