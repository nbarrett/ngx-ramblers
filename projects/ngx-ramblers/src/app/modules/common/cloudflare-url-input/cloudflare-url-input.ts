import { Component, EventEmitter, Output } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCheck, faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";

export interface CloudflareUrlParseResult {
  accountId: string;
}

@Component({
  selector: "app-cloudflare-url-input",
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule],
  template: `
    <div class="row mb-2">
      <div class="col-md-8">
        <label for="cloudflare-url">Paste Cloudflare Dashboard URL to extract Account ID</label>
        <input [(ngModel)]="dashboardUrl"
               type="text"
               class="form-control"
               id="cloudflare-url"
               placeholder="https://dash.cloudflare.com/478d03f.../home/domains"
               (paste)="onPaste($event)"
               (ngModelChange)="handleParse()">
      </div>
      <div class="col-md-4 d-flex align-items-end">
        @if (parsed) {
          <span class="text-success mb-2">
            <fa-icon [icon]="faCheck" class="me-1"></fa-icon>
            Account ID extracted
          </span>
        } @else if (dashboardUrl && !parsed) {
          <span class="text-warning mb-2">
            <fa-icon [icon]="faExclamationTriangle" class="me-1"></fa-icon>
            Could not extract Account ID
          </span>
        }
      </div>
    </div>
  `
})
export class CloudflareUrlInputComponent {
  @Output() parsedUrl = new EventEmitter<CloudflareUrlParseResult>();

  dashboardUrl = "";
  parsed = false;

  protected readonly faCheck = faCheck;
  protected readonly faExclamationTriangle = faExclamationTriangle;

  private static ACCOUNT_ID_PATTERN = /^https?:\/\/dash\.cloudflare\.com\/([a-f0-9]{32})\b/;

  onPaste(event: ClipboardEvent) {
    const pastedText = event.clipboardData?.getData("text");
    if (pastedText) {
      this.dashboardUrl = pastedText;
      this.handleParse();
    }
  }

  handleParse() {
    this.parsed = false;
    if (!this.dashboardUrl) {
      return;
    }
    const match = this.dashboardUrl.match(CloudflareUrlInputComponent.ACCOUNT_ID_PATTERN);
    if (match) {
      this.parsed = true;
      this.parsedUrl.emit({accountId: match[1]});
    }
  }
}
