import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { UnsubscribeService } from "./unsubscribe.service";

type UnsubscribeState = "confirming" | "confirmed" | "feedback-sent" | "error";

@Component({
  selector: "app-unsubscribe",
  standalone: true,
  imports: [FormsModule],
  styles: [`
    .unsubscribe-card
      max-width: 760px
      margin: 60px auto
      padding: 40px
      background-color: #fff
      border: 1px solid #e5e7eb
      border-left: 4px solid #9ca3af
      border-radius: 12px
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08)
      color: inherit

    .unsubscribe-card.success
      background-color: rgba(175, 226, 194, 0.35)
      border-color: rgb(155, 200, 171)
      border-left-color: rgb(99, 134, 110)
      color: rgb(50, 80, 60)

    .unsubscribe-card.error
      background-color: #fef2f2
      border-color: #fecaca
      border-left-color: #dc2626
      color: #7f1d1d

    .unsubscribe-card h1
      margin: 0 0 20px
      font-size: 1.75rem
      font-weight: 700

    .unsubscribe-card .panel-subtitle
      font-weight: 700
      margin: 0 0 8px

    .unsubscribe-card .panel-body
      margin: 0 0 12px

    .unsubscribe-card hr
      margin: 28px 0
      border-color: rgba(0, 0, 0, 0.1)

    .reason-list
      display: flex
      flex-direction: column
      gap: 8px
      margin: 0 0 16px

    .reason-list .form-check
      padding-left: 1.75rem

    .reason-list .form-check-input
      margin-top: 0.25rem

    .reason-list .form-check-label
      cursor: pointer

    .unsubscribe-card textarea.form-control
      min-height: 96px
      margin-bottom: 16px

    .actions
      display: flex
      gap: 12px
      flex-wrap: wrap

    .spinner
      display: inline-block
      width: 16px
      height: 16px
      border: 2px solid currentColor
      border-right-color: transparent
      border-radius: 50%
      animation: spin 0.7s linear infinite
      vertical-align: -3px
      margin-right: 8px

    @keyframes spin
      to
        transform: rotate(360deg)
  `],
  template: `
    <div class="unsubscribe-card" [class.success]="state === 'confirmed' || state === 'feedback-sent'" [class.error]="state === 'error'">
      @switch (state) {
        @case ("confirming") {
          <h1>Unsubscribing</h1>
          <p class="panel-body"><span class="spinner" aria-hidden="true"></span>Removing your email from our mailing list...</p>
        }
        @case ("confirmed") {
          <h1>You've been unsubscribed</h1>
          <p class="panel-body">
            @if (email && listName) {
              We've removed <strong>{{ email }}</strong> from <strong>{{ listName }}</strong>. You won't receive any more emails from this list.
            } @else if (email) {
              We've removed <strong>{{ email }}</strong> from our mailing list. You won't receive any more emails from us.
            } @else if (listName) {
              We've removed your email from <strong>{{ listName }}</strong>. You won't receive any more emails from this list.
            } @else {
              We've removed your email from our mailing list. You won't receive any more emails from us.
            }
          </p>
          <hr>
          <p class="panel-subtitle">Mind sharing why you unsubscribed?</p>
          <p class="panel-body">It's optional, but it helps us improve.</p>
          <div class="reason-list" role="radiogroup" aria-label="Reason for unsubscribing">
            @for (option of reasonOptions; track option.code) {
              <div class="form-check">
                <input class="form-check-input" type="radio" name="reason" [id]="'reason-' + option.code" [value]="option.code" [(ngModel)]="reason">
                <label class="form-check-label" [for]="'reason-' + option.code">{{ option.label }}</label>
              </div>
            }
          </div>
          @if (reason === "other") {
            <label for="comment" class="form-label">Tell us more (optional)</label>
            <textarea id="comment" class="form-control" [(ngModel)]="comment" maxlength="2000" placeholder="What can we do better?"></textarea>
          }
          <div class="actions">
            <button type="button" class="btn btn-primary" [disabled]="!reason || submittingFeedback" (click)="submitFeedback()">
              @if (submittingFeedback) { <span class="spinner" aria-hidden="true"></span> }
              Submit feedback
            </button>
          </div>
        }
        @case ("feedback-sent") {
          <h1>Thanks for your feedback</h1>
          <p class="panel-body">Your response has been recorded. You won't hear from us again.</p>
        }
        @case ("error") {
          <h1>Sorry, we couldn't process your unsubscribe</h1>
          <p class="panel-subtitle">{{ errorMessage }}</p>
          <p class="panel-body">
            Instead, please reply to one of our emails with the word "unsubscribe" in the subject and we'll remove you manually.
          </p>
        }
      }
    </div>
  `
})
export class UnsubscribeComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("UnsubscribeComponent", NgxLoggerLevel.ERROR);
  private route = inject(ActivatedRoute);
  private service = inject(UnsubscribeService);
  private subscriptions: Subscription[] = [];

  protected state: UnsubscribeState = "confirming";
  protected email = "";
  protected listName = "";
  protected reason = "";
  protected comment = "";
  protected errorMessage = "";
  protected submittingFeedback = false;
  private token = "";

  protected reasonOptions: { code: string; label: string }[] = [
    { code: "too-many-emails", label: "I receive too many emails" },
    { code: "not-relevant", label: "The content isn't relevant to me" },
    { code: "no-longer-interested", label: "I'm no longer interested" },
    { code: "moved-away", label: "I've moved away from the area" },
    { code: "never-signed-up", label: "I never signed up for these emails" },
    { code: "other", label: "Other" }
  ];

  ngOnInit(): void {
    this.subscriptions.push(this.route.queryParamMap.subscribe(params => {
      this.token = params.get("t") || "";
      this.confirm();
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private async confirm(): Promise<void> {
    if (!this.token) {
      this.fail("This unsubscribe link is missing its security token.");
      return;
    }
    try {
      const result = await this.service.confirm(this.token);
      this.email = result.email || "";
      this.listName = result.listName || "";
      this.state = "confirmed";
    } catch (error: any) {
      this.logger.error("confirm:failed", error);
      this.fail(this.extractErrorMessage(error) || "This unsubscribe link is invalid or has expired.");
    }
  }

  protected async submitFeedback(): Promise<void> {
    if (!this.reason) return;
    this.submittingFeedback = true;
    try {
      await this.service.submitFeedback(this.token, this.reason, this.comment);
      this.state = "feedback-sent";
    } catch (error: any) {
      this.logger.error("submitFeedback:failed", error);
      this.state = "feedback-sent";
    } finally {
      this.submittingFeedback = false;
    }
  }

  private fail(message: string): void {
    this.state = "error";
    this.errorMessage = message;
  }

  private extractErrorMessage(error: any): string {
    return error?.error?.error || error?.error?.message || error?.message || "";
  }

}
