import { HttpClient } from "@angular/common/http";
import { Component, inject, Input } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleCheck, faCircleExclamation } from "@fortawesome/free-solid-svg-icons";
import { firstValueFrom } from "rxjs";
import { serenityReportUrl } from "../../../functions/serenity-report";
import { RamblersUploadAudit } from "../../../models/ramblers-upload-audit.model";
import { UrlService } from "../../../services/url.service";
import { ButtonWrapper } from "../third-parties/button-wrapper";

@Component({
  selector: "app-serenity-report-button",
  imports: [ButtonWrapper, FontAwesomeModule],
  template: `
    <button type="button" class="btn btn-primary d-inline-flex align-items-center gap-2 text-nowrap" [disabled]="loading" [attr.aria-busy]="loading" (click)="openReport($event)">
      <app-button-wrapper [loading]="loading" [iconOnly]="true">
        <fa-icon [icon]="faCircleCheck"/>
      </app-button-wrapper>
      <span>{{ loading ? 'Loading report…' : 'View report' }}</span>
    </button>
    @if (errorMessage) {
      <div class="alert alert-danger d-flex align-items-start mt-2">
        <fa-icon [icon]="faCircleExclamation" class="me-2"/>
        <div><strong class="d-block">Could not load report</strong>{{ errorMessage }}</div>
      </div>
    }
  `
})
export class SerenityReportButtonComponent {
  private http = inject(HttpClient);
  private urlService = inject(UrlService);
  @Input({required: true}) audit: RamblersUploadAudit;
  loading = false;
  errorMessage = "";
  protected readonly faCircleCheck = faCircleCheck;
  protected readonly faCircleExclamation = faCircleExclamation;

  async openReport(event: MouseEvent): Promise<void> {
    const url = serenityReportUrl(this.audit);
    if (url && !this.loading) {
      const reportWindow = event.ctrlKey || event.metaKey ? window.open("", "_blank") : null;
      this.loading = true;
      this.errorMessage = "";
      try {
        await firstValueFrom(this.http.get(url, {responseType: "text"}));
        if (reportWindow) {
          reportWindow.location.href = url;
        } else {
          this.urlService.navigateToUrl(url, event);
        }
      } catch {
        reportWindow?.close();
        this.errorMessage = "The report could not be downloaded. Try again.";
      } finally {
        this.loading = false;
      }
    }
  }
}
