import { AsyncPipe } from "@angular/common";
import { Component, inject } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleExclamation, faRotateRight } from "@fortawesome/free-solid-svg-icons";
import { VersionCheckService } from "../../../services/version-check.service";

@Component({
  selector: "app-new-version-banner",
  imports: [AsyncPipe, FontAwesomeModule],
  template: `
    @if (versionCheck.reloadDeferred$ | async) {
      <div class="alert alert-warning d-flex align-items-start new-version-banner" role="status">
        <fa-icon [icon]="faCircleExclamation" class="me-2 mt-1"/>
        <div class="flex-grow-1">
          <strong>A new version of the site is ready</strong>
          <div>The page has not reloaded because you appear to be in the middle of something. Finish what you are doing, or reload now to pick it up.</div>
        </div>
        <button type="button" class="btn btn-primary ms-3 text-nowrap" (click)="versionCheck.reloadNow()">
          <fa-icon [icon]="faRotateRight" class="me-1"/>Reload now
        </button>
      </div>
    }`,
  styles: [`
    .new-version-banner
      margin-top: var(--space-3)
  `]
})
export class NewVersionBannerComponent {
  protected versionCheck = inject(VersionCheckService);
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faRotateRight = faRotateRight;
}
