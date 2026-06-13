import { Component, inject, Input, OnInit } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faBan, faPlay, faRefresh, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { BrevoCampaignProgress, BrevoCampaignQueueSummary } from "../../../../models/brevo-campaign-queue.model";
import { MailService } from "../../../../services/mail/mail.service";

@Component({
  selector: "app-mail-campaign-queue",
  imports: [FontAwesomeModule],
  template: `
    <div [class.thumbnail-heading-frame]="!embedded" [class.border-top]="embedded" [class.pt-3]="embedded">
      @if (!embedded) {
        <div class="thumbnail-heading">Campaign Daily-Cap Queue</div>
      } @else {
        <h5>Campaign Daily-Cap Queue</h5>
      }
      <p class="text-nowrap">Brevo holds campaign recipients that exceed the daily sending allowance.</p>
      <button type="button" class="btn btn-primary mb-3" [disabled]="busy" (click)="refresh()">
        <fa-icon [icon]="busy ? faSpinner : faRefresh" [animation]="busy ? 'spin' : null"/> Refresh
      </button>
      @if (error) {
        <div class="alert alert-danger">{{ error }}</div>
      }
      @if (summary) {
        <div class="row mb-3">
          <div class="col-md-4"><strong>Emails sent today</strong><div>{{ usageValue(summary.emailsSentToday) }}</div></div>
          <div class="col-md-4"><strong>Remaining allowance today</strong><div>{{ usageValue(summary.remainingAllowanceToday) }}</div></div>
          <div class="col-md-4"><strong>Campaigns pending</strong><div>{{ summary.pendingCampaigns.length }}</div></div>
        </div>
        @if (summary.pendingCampaigns.length === 0) {
          <div class="alert alert-success">No campaigns currently have recipients held by Brevo.</div>
        } @else {
          <h5>Pending Remainders</h5>
          <table class="table table-striped align-middle">
            <thead>
              <tr><th>Campaign</th><th>Sent so far</th><th>Remaining</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              @for (campaign of summary.pendingCampaigns; track campaign.id) {
                <tr>
                  <td><strong>{{ campaign.subject }}</strong><div class="small text-muted">{{ campaign.name }}</div></td>
                  <td>{{ campaign.sent }}</td>
                  <td>{{ campaign.remaining }}</td>
                  <td>{{ campaign.status }}</td>
                  <td class="d-flex gap-2">
                    <button type="button" class="btn btn-primary btn-sm" [disabled]="busy" (click)="release(campaign)">
                      <fa-icon [icon]="faPlay"/> Release now
                    </button>
                    <button type="button" class="btn btn-danger btn-sm" [disabled]="busy" (click)="cancel(campaign)">
                      <fa-icon [icon]="faBan"/> Cancel remainder
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
        <h5 class="mt-4">Completed In The Last 7 Days</h5>
        @if (summary.completedCampaigns.length === 0) {
          <p class="text-muted">No completed NGX campaigns were found in the last 7 days.</p>
        } @else {
          <table class="table table-striped align-middle">
            <thead>
              <tr><th>Campaign</th><th>Sent</th><th>Delivered</th><th>Status</th><th>Completed</th></tr>
            </thead>
            <tbody>
              @for (campaign of summary.completedCampaigns; track campaign.id) {
                <tr>
                  <td><strong>{{ campaign.subject }}</strong><div class="small text-muted">{{ campaign.name }}</div></td>
                  <td>{{ campaign.sent }}</td>
                  <td>{{ campaign.delivered }}</td>
                  <td>{{ campaign.status }}</td>
                  <td>{{ campaign.sentDate || campaign.modifiedAt }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      }
    </div>
  `
})
export class MailCampaignQueueComponent implements OnInit {
  private mailService = inject(MailService);
  @Input() embedded = false;
  protected summary: BrevoCampaignQueueSummary | null = null;
  protected busy = false;
  protected error: string | null = null;
  protected readonly faRefresh = faRefresh;
  protected readonly faSpinner = faSpinner;
  protected readonly faPlay = faPlay;
  protected readonly faBan = faBan;

  ngOnInit(): void {
    void this.refresh();
  }

  protected async refresh(): Promise<void> {
    this.busy = true;
    this.error = null;
    try {
      this.summary = await this.mailService.campaignQueueSummary();
    } catch (error: any) {
      this.error = this.errorMessage(error, "Unable to load campaign queue");
    }
    this.busy = false;
  }

  protected async release(campaign: BrevoCampaignProgress): Promise<void> {
    this.busy = true;
    try {
      this.summary = await this.mailService.releaseCampaign(campaign.id);
      this.error = null;
    } catch (error: any) {
      this.error = this.errorMessage(error, "Unable to release campaign");
    }
    this.busy = false;
  }

  protected async cancel(campaign: BrevoCampaignProgress): Promise<void> {
    this.busy = true;
    try {
      this.summary = await this.mailService.cancelCampaign(campaign.id);
      this.error = null;
    } catch (error: any) {
      this.error = this.errorMessage(error, "Unable to cancel campaign remainder");
    }
    this.busy = false;
  }

  protected usageValue(value: number | null): string {
    return value !== null ? `${value}` : "No daily send limit on this Brevo plan";
  }

  private errorMessage(error: any, fallback: string): string {
    return error?.error?.error?.message
      || error?.error?.error?.body?.message
      || error?.error?.message
      || error?.message
      || fallback;
  }
}
