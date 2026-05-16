import { Component, inject, OnInit } from "@angular/core";
import { DOCUMENT } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { EnvironmentSetupService } from "../../../services/environment-setup/environment-setup.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { PageComponent } from "../../../page/page.component";
import { LoginRequiredComponent } from "../../../modules/common/login-required/login-required";

function toKebabCase(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

@Component({
  selector: "app-contributor-environment",
  template: `
    <app-page>
      <app-login-required/>
      <div class="row">
        <div class="col-sm-12">
          <h1>Contributor Environment</h1>
          <p>Generate a developer environment bundle so a contributor can run NGX on their
            own machine against this group's environment. The bundle uses this site's MongoDB
            server - you choose the schema, and whether to develop against the current data or
            a clone of it. A fresh AUTH_SECRET is generated for the bundle; no other production
            secrets are included.</p>
          <div class="form-group">
            <label for="environmentName">Environment name</label>
            <input id="environmentName" class="form-control" [ngModel]="environmentName"
                   (ngModelChange)="onEnvironmentNameChange($event)" (blur)="normaliseEnvironmentName()">
            <small class="text-muted">Kebab-case - this is the name used to start the environment
              locally via <code>ngx-cli local dev &lt;environment&gt;</code>.</small>
          </div>
          <div class="form-group">
            <label>Database</label>
            <div class="form-check">
              <input class="form-check-input" type="radio" id="modeCurrent" name="databaseMode"
                     [value]="false" [ngModel]="clone" (ngModelChange)="onCloneChange($event)">
              <label class="form-check-label" for="modeCurrent">
                Develop against the current database@if (currentDatabase) { ({{ currentDatabase }})}
              </label>
            </div>
            <div class="form-check">
              <input class="form-check-input" type="radio" id="modeClone" name="databaseMode"
                     [value]="true" [ngModel]="clone" (ngModelChange)="onCloneChange($event)">
              <label class="form-check-label" for="modeClone">
                Clone the current database into a new schema
              </label>
            </div>
          </div>
          @if (clone) {
            <div class="form-group">
              <label for="schema">Schema</label>
              <input id="schema" class="form-control" [(ngModel)]="schema">
              <small class="text-muted">
                A new schema to create on the same server, populated with a copy of the current data.
              </small>
            </div>
          }
          <button class="btn btn-primary" [disabled]="generating || !environmentName.trim() || !schema.trim()"
                  (click)="generate()">
            {{ generating ? "Generating..." : "Generate developer environment" }}
          </button>
          @if (notifyTarget.showAlert) {
            <div class="mt-3 alert {{ notifyTarget.alert.class }}">
              <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
              @if (notifyTarget.alertTitle) {
                <strong>{{ notifyTarget.alertTitle }}: </strong>
              }
              {{ notifyTarget.alertMessage }}
            </div>
          }
        </div>
      </div>
    </app-page>
  `,
  styleUrls: ["../admin/admin.component.sass"],
  imports: [PageComponent, LoginRequiredComponent, FormsModule, FontAwesomeModule]
})
export class ContributorEnvironmentComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger(ContributorEnvironmentComponent, NgxLoggerLevel.ERROR);
  private environmentSetupService = inject(EnvironmentSetupService);
  private notifierService = inject(NotifierService);
  private document = inject(DOCUMENT);

  environmentName = "";
  currentDatabase = "";
  schema = "";
  clone = false;
  generating = false;
  notifyTarget: AlertTarget = {};
  notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);

  async ngOnInit(): Promise<void> {
    try {
      const defaults = await this.environmentSetupService.defaults();
      if (defaults?.environment) {
        this.environmentName = defaults.environment;
      }
      if (defaults?.database) {
        this.currentDatabase = defaults.database;
      }
    } catch (error) {
      this.logger.error("Could not load environment defaults:", error);
    }
    this.recomputeSchema();
  }

  onEnvironmentNameChange(value: string): void {
    this.environmentName = value;
    this.recomputeSchema();
  }

  normaliseEnvironmentName(): void {
    this.environmentName = toKebabCase(this.environmentName);
    this.recomputeSchema();
  }

  onCloneChange(value: boolean): void {
    this.clone = value;
    this.recomputeSchema();
  }

  recomputeSchema(): void {
    if (this.clone) {
      this.schema = `ngx-ramblers-${toKebabCase(this.environmentName)}`;
    } else {
      this.schema = this.currentDatabase;
    }
  }

  async generate(): Promise<void> {
    const environment = toKebabCase(this.environmentName);
    this.environmentName = environment;
    this.generating = true;
    this.notify.hide();
    try {
      const bundle = await this.environmentSetupService.generateContributorBundle(environment, this.schema.trim(), this.clone);
      this.triggerDownload(bundle, environment);
      this.notify.success({
        title: "Bundle ready",
        message: `Bundle downloaded. Unpack it into an ngx-ramblers checkout and run: ./bin/ngx-cli local dev ${environment} --no-docker-worker`
      });
    } catch (error) {
      this.logger.error("Failed to generate contributor bundle:", error);
      this.notify.error({
        title: "Bundle generation failed",
        message: "Could not generate the bundle - check the details and try again.",
        continue: true
      });
    } finally {
      this.generating = false;
    }
  }

  private triggerDownload(bundle: Blob, environment: string): void {
    const url = URL.createObjectURL(bundle);
    const link = this.document.createElement("a");
    link.href = url;
    link.download = `contributor-environment-${environment}.zip`;
    this.document.body.appendChild(link);
    link.click();
    this.document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
