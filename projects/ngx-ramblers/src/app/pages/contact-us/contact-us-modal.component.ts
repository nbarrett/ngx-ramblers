import { AfterViewInit, Component, ElementRef, inject, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { BsModalRef } from "ngx-bootstrap/modal";
import { LoggerFactory } from "../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { Params } from "@angular/router";
import { Subscription } from "rxjs";
import { CommitteeConfigService } from "../../services/committee/commitee-config.service";
import { CommitteeReferenceData } from "../../services/committee/committee-reference-data";
import { CommitteeMember, ContactFormDetails, ValidateTokenRequest } from "../../models/committee.model";
import { SystemConfigService } from "../../services/system/system-config.service";
import { SystemConfig } from "../../models/system.model";
import { ContactUsService } from "./contact-us.service";
import { AlertInstance, NotifierService } from "../../services/notifier.service";
import { AlertTarget } from "../../models/alert-target.model";
import { MailMessagingService } from "../../services/mail/mail-messaging.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { NotificationConfig, SendSmtpEmailRequest } from "../../models/mail.model";
import { NotificationDirective } from "../../notifications/common/notification.directive";
import { omit } from "lodash-es";
import { DateUtilsService } from "../../services/date-utils.service";
import { FirstAndLastName } from "../../models/member.model";
import { MemberNamingService } from "../../services/member/member-naming.service";
import { FormsModule } from "@angular/forms";
import { RecaptchaModule } from "ng-recaptcha-2";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { MarkdownComponent } from "ngx-markdown";
import { DisplayDateAndTimePipe } from "../../pipes/display-date-and-time.pipe";

@Component({
    selector: "app-contact-modal",
    template: `
    <div class="modal-content">
      <div class="modal-header">
        <h4 class="modal-title">Contact <em>{{ committeeMember?.fullName }}</em></h4>
        <button type="button" class="close" (click)="close()">&times;</button>
      </div>
      <div class="modal-body">
        @if (committeeMember) {
          <form #contactForm="ngForm" (ngSubmit)="sendEmail()" class="p-2" novalidate>
            <h6 class="my-3">Please complete the following details and we'll send your message to
            {{ committeeMember?.fullName }}, our {{ committeeMember?.description }}.</h6>
            <div class="form-group">
              <label for="contact-name">Your Name</label>
              <input #contactNameInput [(ngModel)]="contactFormDetails.name" name="name" type="text" id="contact-name"
                class="form-control" required>
              @if (contactForm.submitted && !contactForm.controls.name?.valid) {
                <div class="text-danger">
                  Name is required.
                </div>
              }
            </div>
            <div class="form-group">
              <label for="contact-email">Your Email Address</label>
              <input [(ngModel)]="contactFormDetails.email" name="email" type="email" id="contact-email"
                class="form-control" required>
              @if (contactForm.submitted && !contactForm.controls.email?.valid) {
                <div class="text-danger">
                  Valid email is required.
                </div>
              }
            </div>
            <div class="form-group">
              <label for="contact-subject">Subject</label>
              <input [(ngModel)]="contactFormDetails.subject" name="subject" type="text" id="contact-subject"
                class="form-control" required>
              @if (contactForm.submitted && !contactForm.controls.subject?.valid) {
                <div class="text-danger">
                  Subject is required.
                </div>
              }
            </div>
            <div class="form-group">
              <label for="contact-message">Your Message</label>
              <textarea [(ngModel)]="contactFormDetails.message" name="message" id="contact-message" class="form-control"
              rows="8" required></textarea>
              @if (contactForm.submitted && !contactForm.controls.message?.valid) {
                <div class="text-danger">
                  Message is required.
                </div>
              }
            </div>
            <div class="form-group">
              <div class="form-check">
                <input [(ngModel)]="contactFormDetails.sendCopy" name="sendCopy" type="checkbox" id="contact-email-copy"
                  class="form-check-input">
                <label for="contact-email-copy" class="form-check-label">Send a copy to yourself</label>
              </div>
            </div>
            @if (config?.recaptcha?.siteKey) {
              <div class="form-group">
                <re-captcha (resolved)="onCaptchaResolved($event)"
                  [siteKey]="config?.recaptcha?.siteKey"/>
              </div>
            }
            <button type="submit" #hiddenSubmitButton class="d-none"></button>
          </form>
        }
        @if (notifyTarget.showAlert) {
          <div class="alert {{notifyTarget.alertClass}}">
            <fa-icon [icon]="notifyTarget.alert.icon"/>
            @if (notifyTarget.alertTitle) {
              <strong>
              {{ notifyTarget.alertTitle }}: </strong>
              } {{ notifyTarget.alertMessage }}
            </div>
          }
        </div>
        <div class="modal-footer">
          <div class="d-flex gap-2 flex-wrap">
            <button class="btn btn-primary" [disabled]="emailSendDisabled()"
              (click)="triggerSubmit()">Send
              Email
            </button>
            <button class="btn btn-primary" (click)="close()">Close</button>
          </div>
        </div>
      </div>
      <div class="d-none">
        <ng-template app-notification-directive></ng-template>
        <div #inboundNotificationContent>
          <p>A message was been received via the website as follows:</p>
          <dl>
            <dt>
              <b>Time:</b>
            </dt>
            <dd>{{ contactFormDetails.timestamp | displayDateAndTime }}</dd>
          </dl>
          <dl>
            <dt>
              <b>Route:</b>
            </dt>
            <dd>{{ formatRoute() }}</dd>
          </dl>
          <dl>
            <dt>
              <b>Contact Name:</b>
            </dt>
            <dd>{{ contactFormDetails.name }}</dd>
          </dl>
          <dl>
            <dt>
              <b>Contact Email:</b>
            </dt>
            <dd>{{ contactFormDetails.email }}</dd>
          </dl>
          <dl>
            <dt>
              <b>Message:</b>
            </dt>
            <dd markdown [data]="contactFormDetails.message"></dd>
          </dl>
        </div>
        <div #sendCopyNotificationContent>
          <p>This is a copy of a message that you sent via our website as follows:</p>
          <dl>
            <dt>
              <b>Time:</b>
            </dt>
            <dd>{{ contactFormDetails.timestamp | displayDateAndTime }}</dd>
          </dl>
          <dl>
            <dt>
              <b>Contact Name:</b>
            </dt>
            <dd>{{ contactFormDetails.name }}</dd>
          </dl>
          <dl>
            <dt>
              <b>Contact Email:</b>
            </dt>
            <dd>{{ contactFormDetails.email }}</dd>
          </dl>
          <dl>
            <dt>
              <b>Message:</b>
            </dt>
            <dd markdown [data]="contactFormDetails.message"></dd>
          </dl>
        </div>
      </div>
    `,
    imports: [FormsModule, RecaptchaModule, FontAwesomeModule, NotificationDirective, MarkdownComponent, DisplayDateAndTimePipe]
})
export class ContactUsModalComponent implements OnInit, OnDestroy, AfterViewInit {
  queryParams: Params;
  protected dateUtils: DateUtilsService = inject(DateUtilsService);
  private committeeConfig: CommitteeConfigService = inject(CommitteeConfigService);
  public systemConfigService: SystemConfigService = inject(SystemConfigService);
  public contactUsService: ContactUsService = inject(ContactUsService);
  private notifierService: NotifierService = inject(NotifierService);
  private memberNamingService: MemberNamingService = inject(MemberNamingService);
  protected mailMessagingService: MailMessagingService = inject(MailMessagingService);
  protected stringUtils: StringUtilsService = inject(StringUtilsService);
  public notifyTarget: AlertTarget = {};
  private notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);
  protected config: SystemConfig;
  private subscriptions: Subscription[] = [];
  public bsModalRef: BsModalRef = inject(BsModalRef);
  private loggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("ContactUsModalComponent", NgxLoggerLevel.ERROR);
  protected committeeMember: CommitteeMember;
  protected validateTokenRequest: ValidateTokenRequest = {captchaToken: null};
  protected contactFormDetails: ContactFormDetails = {
    timestamp: this.dateUtils.dateTimeNow().toMillis(),
    name: null,
    email: null,
    subject: null,
    message: null,
    sendCopy: false
  };
  private emailSent = false;
  @ViewChild("contactNameInput") contactNameInput: ElementRef;
  @ViewChild("hiddenSubmitButton") hiddenSubmitButton: ElementRef;
  @ViewChild("inboundNotificationContent") inboundNotificationContent: ElementRef;
  @ViewChild("sendCopyNotificationContent") sendCopyNotificationContent: ElementRef;
  @ViewChild(NotificationDirective) notificationDirective: NotificationDirective;
  private notificationConfig: NotificationConfig;

  ngOnInit(): void {
    this.subscriptions.push(this.mailMessagingService.events().subscribe(mailMessagingConfig => {
      this.notificationConfig = this.mailMessagingService.queryNotificationConfig(this.notify, mailMessagingConfig, "contactUsNotificationConfigId");
      this.logger.info("initialising with notificationConfig:", this.notificationConfig);
    }));
    this.subscriptions.push(this.systemConfigService.events()
      .subscribe((config: SystemConfig) => {
        this.config = config;
        this.logger.info("config:recaptcha:", this.config.recaptcha);
        if (!config?.recaptcha?.siteKey) {
          this.notify.error({
            title: "Failed to initialise Contact Us form",
            message: "Recaptcha site key not configured"
          });
        }
      }));
    this.subscriptions.push(this.committeeConfig.committeeReferenceDataEvents().subscribe((data: CommitteeReferenceData) => {
      this.committeeMember = data.committeeMemberForRole(this.queryParams["role"]);
      if (!this.committeeMember) {
        this.notify.error({
          title: "Failed to initialise Contact Us form",
          message: "No committee member found for role: " + this.queryParams["role"]
        });
      }

      this.contactFormDetails.subject = this.queryParams["subject"] || "Website Enquiry";
      this.logger.info("ngOnInit - queryParams:", this.queryParams, "bsModalRef:", this.bsModalRef, "committeeMember:", this.committeeMember);
    }));
  }

  ngAfterViewInit(): void {
    this.logger.info("ngAfterViewInit - focus on contactNameInput:", this.contactNameInput?.nativeElement);
    setTimeout(() => {
      this.contactNameInput?.nativeElement?.focus();
    }, 0);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  onCaptchaResolved(captchaResponse: string) {
    this.notify.hide();
    this.validateTokenRequest.captchaToken = captchaResponse;
    this.logger.info("Captcha resolved with response:", captchaResponse);
  }

  close() {
    this.bsModalRef.hide();
  }

  triggerSubmit() {
    this.hiddenSubmitButton.nativeElement.click();
  }

  inboundBodyContent(): string {
    const bodyContent = this.inboundNotificationContent?.nativeElement?.innerHTML;
    this.logger.info("bodyContent ->", bodyContent);
    return bodyContent;
  }

  sendCopyBodyContent(): string {
    const bodyContent = this.sendCopyNotificationContent?.nativeElement?.innerHTML;
    this.logger.info("bodyContent ->", bodyContent);
    return bodyContent;
  }

  sendEmail() {
    this.notify.success({
      title: "Sending Email",
      message: `To ${this.committeeMember.fullName}...`
    });
    this.contactUsService.validateToken(this.validateTokenRequest)
      .then(() => this.sendInboundEmailRequest())
      .then(() => this.sendCopyEmailRequest())
      .then(() => {
        this.notify.success({
          title: "Email sent",
          message: `Your message has been sent to ${this.committeeMember.fullName}.`
        });
        this.logger.info("Email sent with params:", this.contactFormDetails);
        this.emailSent = true;
        setTimeout(() => {
          this.close();
        }, 5000);
      }).catch((error) => this.notify.error({title: "Failed to send email", message: error}));
  }

  sendInboundEmailRequest(): Promise<void> {
    this.logger.info("sendInboundEmailRequest:contactFormDetails:", this.contactFormDetails);
    const name: FirstAndLastName = this.memberNamingService.firstAndLastNameFrom(this.committeeMember.fullName);
    this.logger.info("sendInboundEmailRequest:name:", name, "given:", this.committeeMember);
    const replyTo = {email: this.contactFormDetails.email, name: this.contactFormDetails.name};
    const emailRequest: SendSmtpEmailRequest = this.mailMessagingService.createEmailRequest({
      member: {email: this.contactFormDetails.email, firstName: name.firstName, lastName: name.lastName},
      notificationConfig: this.notificationConfig,
      notificationDirective: this.notificationDirective,
      emailSubject: this.contactFormDetails.subject,
      bodyContent: this.inboundBodyContent(),
      sender: this.mailMessagingService.createBrevoAddress(this.notificationConfig.senderRole),
      to: [this.mailMessagingService.createBrevoAddress(this.committeeMember.type)],
      replyTo,
    });
    this.logger.info("sendInboundEmailRequest:emailRequest:", emailRequest);
    return this.contactUsService.sendTransactionalMessage(emailRequest);
  }

  sendCopyEmailRequest(): Promise<void> {
    if (this.contactFormDetails.sendCopy) {
      this.logger.info("sendCopyEmailRequest:contactFormDetails:", this.contactFormDetails);
      const name: FirstAndLastName = this.memberNamingService.firstAndLastNameFrom(this.contactFormDetails.name);
      const to = {email: this.contactFormDetails.email, name: this.contactFormDetails.name};
      const emailRequest: SendSmtpEmailRequest = this.mailMessagingService.createEmailRequest({
        member: {email: this.contactFormDetails.email, firstName: name.firstName, lastName: name.lastName},
        notificationConfig: this.notificationConfig,
        notificationDirective: this.notificationDirective,
        emailSubject: this.contactFormDetails.subject,
        bodyContent: this.sendCopyBodyContent(),
        sender: this.mailMessagingService.createBrevoAddress(this.notificationConfig.senderRole),
        to: [to]
      });
      this.logger.info("sendEmailRequest:emailRequest:", emailRequest);
      return this.contactUsService.sendTransactionalMessage(emailRequest);
    } else {
      this.logger.info("sendCopyEmailRequest:copy request not requested");
      return Promise.resolve();
    }
  }

  emailSendDisabled() {
    return !this.committeeMember || this.emailSent || !this.validateTokenRequest.captchaToken;
  }

  formatRoute() {
    return this.stringUtils.stringifyObject(omit(this.queryParams, "contact-us"));
  }
}
