import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleExclamation, faLocationDot, faMap, faUsers } from "@fortawesome/free-solid-svg-icons";
import { PageComponent } from "../../../page/page.component";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { VolunteerManagementService } from "../../../services/volunteer-management.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { VolunteerMyInformation, VolunteerMyRole } from "../../../models/volunteer-management.model";
import { DynamicContentComponent } from "../../../modules/common/dynamic-content/dynamic-content";
import { VolunteerViewSwitch } from "./volunteer-view-switch";

@Component({
  selector: "app-my-volunteer-information",
  imports: [PageComponent, FontAwesomeModule, DynamicContentComponent, VolunteerViewSwitch],
  template: `
    <app-page>
      <div class="my-volunteer">
        <div class="my-volunteer-switch"><app-volunteer-view-switch/></div>
        <app-dynamic-content [anchor]="'introduction'" contentPathReadOnly preventRedirect/>
        @if (loading) {
          <p class="text-muted">Loading your volunteer information…</p>
        } @else if (information && information.parishCount === 0) {
          <div class="alert alert-warning d-flex align-items-start" role="alert">
            <fa-icon [icon]="faCircleExclamation" class="me-2 mt-1"/>
            <div>
              <strong>No assignments recorded</strong>
              <div>You don't currently hold any rights-of-way volunteer assignments.</div>
            </div>
          </div>
        } @else if (information) {
          <p class="parish-count">Covering {{ information.parishCount }} parish{{ information.parishCount === 1 ? "" : "es" }}.</p>
          <div class="parish-cards">
            @for (parish of information.parishes; track parish.parishCode) {
              <article class="parish-card">
                <div class="parish-card-heading">
                  <div>
                    <h2><fa-icon [icon]="faLocationDot" class="me-2"/>{{ parish.parishName }}</h2>
                    <div class="parish-meta">
                      <span class="parish-chip">{{ parish.parishCode }}</span>
                      @if (parish.localAuthorityName) {
                        <span class="parish-meta-item">{{ parish.localAuthorityName }}</span>
                      }
                      @if (parish.sectorCode) {
                        <span class="parish-meta-item">Sector {{ parish.sectorCode }}</span>
                      }
                      @if (parish.rightsOfWayGroupCode) {
                        <span class="parish-meta-item">Group {{ parish.rightsOfWayGroupCode }}</span>
                      }
                    </div>
                  </div>
                </div>

                <section class="parish-section">
                  <h3>My roles</h3>
                  <ul class="role-list">
                    @for (role of parish.myRoles; track role.roleLabel + role.coverLabel + role.effectiveFrom) {
                      <li>
                        <strong>{{ role.roleLabel }}</strong>
                        <span class="cover-chip" [class.temporary]="role.coverLabel === 'Temporary'">{{ role.coverLabel }}</span>
                        <span class="text-muted">{{ effectiveDates(role) }}</span>
                      </li>
                    }
                  </ul>
                </section>

                @if (parish.counterparts.length > 0) {
                  <section class="parish-section">
                    <h3><fa-icon [icon]="faUsers" class="me-2"/>Other officers covering this parish</h3>
                    <ul class="person-list">
                      @for (counterpart of parish.counterparts; track counterpart.name + counterpart.roleLabel) {
                        <li>
                          <strong>{{ counterpart.name }}</strong>
                          <span class="text-muted">{{ counterpart.roleLabel }} · {{ counterpart.coverLabel }}</span>
                          @if (counterpart.email) {
                            <a [href]="'mailto:' + counterpart.email">{{ counterpart.email }}</a>
                          }
                        </li>
                      }
                    </ul>
                  </section>
                }

                @if (parish.councilContacts.length > 0) {
                  <section class="parish-section">
                    <h3>Council contacts</h3>
                    <ul class="contact-list">
                      @for (contact of parish.councilContacts; track contact.email || contact.organisationName || contact.contactName) {
                        <li>
                          @if (contact.organisationName) {
                            <strong>{{ contact.organisationName }}</strong>
                          }
                          @if (contact.contactName) {
                            <div>{{ contact.contactName }}@if (contact.roleTitle) {<span class="text-muted"> · {{ contact.roleTitle }}</span>}</div>
                          }
                          @if (contact.telephone) {
                            <div class="text-muted">{{ contact.telephone }}</div>
                          }
                          @if (contact.email) {
                            <div><a [href]="'mailto:' + contact.email">{{ contact.email }}</a></div>
                          }
                          @if (contact.postalAddress) {
                            <div class="text-muted">{{ contact.postalAddress }}</div>
                          }
                        </li>
                      }
                    </ul>
                  </section>
                }
              </article>
            }
          </div>

          <aside class="coverage-map-panel">
            <h3><fa-icon [icon]="faMap" class="me-2"/>Coverage map</h3>
            <p class="text-muted">A visual coverage map for your parishes is available on your group's area map page. The parishes you cover are: {{ parishNames }}.</p>
          </aside>
        }
      </div>
    </app-page>
  `,
  styles: [`
    .my-volunteer
      position: relative
      display: flex
      flex-direction: column
      gap: var(--space-5)
    .my-volunteer-switch
      display: flex
      justify-content: flex-end
    @media (min-width: 768px)
      .my-volunteer-switch
        position: absolute
        top: 0
        right: 0
        z-index: 2
    .parish-count
      margin: 0
      font-weight: 600
    .parish-cards
      display: grid
      gap: var(--space-4)
    .parish-card
      display: flex
      flex-direction: column
      gap: var(--space-4)
      padding: var(--space-5)
      border: 1px solid var(--rsm-border)
      border-left: 8px solid var(--ramblers-colour-sunrise)
      border-radius: var(--rsm-panel-radius)
      background: var(--rsm-panel-bg)
      color: var(--rsm-text)
    .parish-card-heading h2
      margin: 0
      font-size: 1.25rem
    .parish-meta
      display: flex
      flex-wrap: wrap
      align-items: center
      gap: var(--space-2)
      margin-top: var(--space-2)
    .parish-chip
      display: inline-flex
      padding: var(--space-1) var(--space-2)
      border-radius: 999px
      background: #eef1f4
      font-size: .8rem
      font-weight: 700
    .parish-meta-item
      color: var(--rsm-muted)
      font-size: .9rem
    .parish-section
      display: flex
      flex-direction: column
      gap: var(--space-2)
    .parish-section h3
      margin: 0
      font-size: 1rem
    .role-list, .person-list, .contact-list
      list-style: none
      margin: 0
      padding: 0
      display: grid
      gap: var(--space-3)
    .role-list li
      display: flex
      flex-wrap: wrap
      align-items: center
      gap: var(--space-2)
    .person-list li, .contact-list li
      display: flex
      flex-direction: column
      gap: var(--space-1)
      padding-bottom: var(--space-2)
    .person-list li:not(:last-child), .contact-list li:not(:last-child)
      border-bottom: 1px solid var(--rsm-border)
    .cover-chip
      display: inline-flex
      padding: var(--space-1) var(--space-2)
      border-radius: 999px
      background: #eef1f4
      font-size: .8rem
      font-weight: 600
    .cover-chip.temporary
      background: #fde5dc
    .coverage-map-panel
      padding: var(--space-5)
      border: 1px solid var(--rsm-border)
      border-radius: var(--rsm-panel-radius)
      background: var(--rsm-panel-bg)
    .coverage-map-panel h3
      margin: 0 0 var(--space-2)
      font-size: 1rem
    .coverage-map-panel p
      margin: 0
  `]
})
export class MyVolunteerInformationComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("MyVolunteerInformationComponent", NgxLoggerLevel.ERROR);
  private volunteerManagementService = inject(VolunteerManagementService);
  private systemConfigService = inject(SystemConfigService);
  private dateUtils = inject(DateUtilsService);
  private subscriptions: Subscription[] = [];

  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faLocationDot = faLocationDot;
  protected readonly faUsers = faUsers;
  protected readonly faMap = faMap;

  protected loading = true;
  protected information: VolunteerMyInformation | null = null;

  ngOnInit(): void {
    this.subscriptions.push(this.systemConfigService.events().subscribe(systemConfig => {
      const groupCode = systemConfig?.group?.groupCode ?? "";
      this.loadInformation(groupCode);
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  protected get parishNames(): string {
    return (this.information?.parishes ?? []).map(parish => parish.parishName).join(", ");
  }

  protected effectiveDates(role: VolunteerMyRole): string {
    const from = role.effectiveFrom ? this.dateUtils.displayDate(role.effectiveFrom) : "";
    const to = role.effectiveTo ? this.dateUtils.displayDate(role.effectiveTo) : "";
    if (from && to) {
      return `${from} – ${to}`;
    } else if (from) {
      return `From ${from}`;
    } else if (to) {
      return `Until ${to}`;
    } else {
      return "Date not recorded";
    }
  }

  private loadInformation(groupCode: string): void {
    this.subscriptions.push(this.volunteerManagementService.myInformation(groupCode).subscribe({
      next: information => {
        this.information = information;
        this.loading = false;
      },
      error: error => {
        this.logger.error("Failed to load my volunteer information", error);
        this.information = {memberName: "", parishCount: 0, parishes: []};
        this.loading = false;
      }
    }));
  }
}
