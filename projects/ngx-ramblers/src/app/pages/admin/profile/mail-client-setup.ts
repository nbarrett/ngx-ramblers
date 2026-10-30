import {DeviceKind} from "../../../models/inbox.model";
import {Component, inject, Input, OnDestroy, OnInit, signal} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {FormsModule} from "@angular/forms";
import {faApple, faWindows, faLinux} from "@fortawesome/free-brands-svg-icons";
import {faEnvelope} from "@fortawesome/free-solid-svg-icons";
import {Subscription} from "rxjs";
import {MailClientConnectionSettings, MailClientSetupApp, MailClientSetupPlatform} from "../../../models/mail-client.model";
import {OutlookCalendarPlatform} from "../../../models/walk-programme.model";
import {StoredValue} from "../../../models/ui-actions";
import {SectionToggleTab} from "../../../models/section-toggle.model";
import {SectionToggle} from "../../../shared/components/section-toggle";
import {SecretInputComponent} from "../../../modules/common/secret-input/secret-input.component";
import {mailClientConnectionForHost} from "../../../functions/mail-client-connection";
import {browserCalendarClientHints, browserDeviceKind, outlookPlatformTabs} from "../../../functions/calendar-add";

@Component({
  selector: "app-mail-client-setup",
  imports: [FormsModule, SectionToggle, SecretInputComponent],
  template: `
    @if (connection(); as connection) {
      <p>Read and send committee email in your usual mail app. Inbox, Sent and your committee folders are shared with the website.</p>
      @if (connection.allowedFromAddresses.length) {
        <app-section-toggle stackOnMobile [tabs]="platformTabs" [selectedTab]="platform()"
          (selectedTabChange)="selectPlatform($event)"/>
        <p class="fw-bold mt-3 mb-2">Which email app do you use?</p>
        <app-section-toggle stackOnMobile [tabs]="appTabs" [selectedTab]="selectedApp()"
          [queryParamKey]="StoredValue.MAIL_CLIENT_APP" (selectedTabChange)="selectApp($event)"/>
        <div class="form-group mt-3 mb-3">
          <label for="mail-client-address">Which committee address would you like to use?</label>
          <select id="mail-client-address" class="form-select" [ngModel]="address()" (ngModelChange)="selectAddress($event)">
            @for (email of connection.allowedFromAddresses; track email) {
              <option [value]="email">{{ email }}</option>
            }
          </select>
        </div>
        <ol class="ps-4">
          <li class="mb-4">
            <h3 class="h6">Create an application password</h3>
            <p>Give it a name you will recognise, such as “Laptop”. Use this password in your email app, rather than your website password.</p>
            <ng-content/>
          </li>
          <li class="mb-4">
            <h3 class="h6">Add an email account</h3>
            @switch (selectedApp()) {
              @case (MailClientSetupApp.THUNDERBIRD) {
                <p>In Thunderbird, open <strong>☰ → Account Settings → New Account → Mail</strong> (in older versions, <strong>Account Actions → Add Mail Account</strong>).
                  Enter your name, paste the email address below and the application password above. Choose <strong>Continue → Manual configuration</strong>.</p>
              }
              @case (MailClientSetupApp.APPLE_MAIL) {
                <p>On your Mac, open <strong>Mail → Add Account → Other Mail Account → Continue</strong>.
                  Enter your name, paste the email address below and the application password above, then choose <strong>Sign In</strong>.
                  If Mail cannot verify the account automatically, enter the settings in step 3.</p>
              }
              @case (MailClientSetupApp.IOS_MAIL) {
                <p>On your iPhone or iPad, open <strong>Settings → Apps → Mail → Mail Accounts → Add Account → Other → Add Mail Account</strong>.
                  On older versions, start at <strong>Settings → Mail → Accounts</strong>.
                  Enter your name, the email address below and the application password above, then choose <strong>Next → IMAP</strong>.</p>
              }
              @case (OutlookCalendarPlatform.MAC) {
                <p>In Outlook on your Mac, open <strong>Outlook → Settings → Accounts → Add Account</strong>.
                  Paste the email address below and choose <strong>Continue</strong>.
                  If asked to choose a provider, choose <strong>IMAP</strong>. Enter the settings in step 3.</p>
              }
              @case (OutlookCalendarPlatform.WINDOWS_NEW) {
                <p>In new Outlook, open <strong>Settings → Accounts → Your accounts → Add Account</strong>.
                  Paste the email address below and choose <strong>Continue</strong>.
                  Choose <strong>IMAP</strong> if asked for the account type. Expand <strong>Show more</strong> or <strong>Advanced settings</strong> to enter the settings in step 3.</p>
              }
              @case (OutlookCalendarPlatform.WINDOWS_CLASSIC) {
                <p>In classic Outlook, open <strong>File → Add Account</strong>.
                  Paste the email address below, choose <strong>Advanced options → Let me set up my account manually → Connect → IMAP</strong>.</p>
              }
            }
            <label for="mail-setup-email">Email address — paste into the email address box</label>
            <app-secret-input id="mail-setup-email" [ngModel]="address()" [readOnly]="true" [reveal]="false" autocomplete="off"/>
          </li>
          <li class="mb-4">
            <h3 class="h6">Fill in the account settings</h3>
            <p>Choose <strong>IMAP</strong> for incoming mail and <strong>SMTP</strong> for outgoing mail. Use the clipboard icon inside each box to copy its value. You can edit either server name; entering localhost switches both servers to local testing settings.</p>
            <div class="row g-3">
              <div class="col-md-6">
                <h4 class="h6">Incoming mail (IMAP)</h4>
                <label for="mail-setup-imap-host">{{ serverLabel() }}</label>
                <app-secret-input id="mail-setup-imap-host" [ngModel]="connection.host" (ngModelChange)="changeHost($event)" [reveal]="false" autocomplete="off"/>
                <label class="mt-2" for="mail-setup-imap-port">Port — incoming server</label>
                <app-secret-input id="mail-setup-imap-port" [ngModel]="'' + connection.imapPort" [readOnly]="true" [reveal]="false" autocomplete="off"/>
                <label class="mt-2" for="mail-setup-imap-user">{{ usernameLabel() }}</label>
                <app-secret-input id="mail-setup-imap-user" [ngModel]="address()" [readOnly]="true" [reveal]="false" autocomplete="off"/>
                <p class="mt-2 mb-0">Connection security: <strong>{{ connection.imapSecure ? "SSL/TLS" : "None" }}</strong>.</p>
              </div>
              <div class="col-md-6">
                <h4 class="h6">Outgoing mail (SMTP)</h4>
                <label for="mail-setup-smtp-host">{{ serverLabel() }}</label>
                <app-secret-input id="mail-setup-smtp-host" [ngModel]="connection.host" (ngModelChange)="changeHost($event)" [reveal]="false" autocomplete="off"/>
                <label class="mt-2" for="mail-setup-smtp-port">Port — outgoing server</label>
                <app-secret-input id="mail-setup-smtp-port" [ngModel]="'' + connection.smtpPort" [readOnly]="true" [reveal]="false" autocomplete="off"/>
                <label class="mt-2" for="mail-setup-smtp-user">{{ usernameLabel() }}</label>
                <app-secret-input id="mail-setup-smtp-user" [ngModel]="address()" [readOnly]="true" [reveal]="false" autocomplete="off"/>
                <p class="mt-2 mb-0">Connection security: <strong>{{ connection.smtpSecure ? "SSL/TLS" : "None" }}</strong>.</p>
              </div>
            </div>
            <p class="mt-3">Paste the <strong>same application password</strong> from step 1 into both password boxes.
              Enable outgoing server authentication if shown; use the same username and password as incoming mail.</p>
            @if (selectedApp() === MailClientSetupApp.THUNDERBIRD) {
              <p>For both servers, choose <strong>Authentication method → Normal password</strong>. Choose <strong>Re-test</strong>, then <strong>Done</strong>.</p>
            } @else if (selectedApp() === MailClientSetupApp.APPLE_MAIL || selectedApp() === MailClientSetupApp.IOS_MAIL) {
              <p>Use <strong>Password</strong> authentication. If automatic connection settings are enabled, turn them off to enter the ports above.
                Set <strong>Use TLS/SSL</strong> {{ connection.imapSecure ? "on" : "off" }} for incoming mail and {{ connection.smtpSecure ? "on" : "off" }} for outgoing mail, then save the account.</p>
            } @else {
              <p>Use password authentication. Choose <strong>SSL/TLS</strong> where encryption is requested if shown above. Do not choose STARTTLS.
                Choose <strong>Connect</strong> or <strong>Done</strong> to save the account.</p>
            }
            @if (!connection.imapSecure || !connection.smtpSecure) {
              <p>This is a local test connection. Use a mail app on this computer; “localhost” on a phone refers to the phone itself. New Outlook may also be unable to reach a local-only server.</p>
            }
          </li>
          <li>
            <h3 class="h6">Check Inbox and Sent</h3>
            <p>Open Inbox and read a message. Send a short test to an address you can check, confirm it arrives, then open Sent and check the saved copy.
              Your existing committee folders should also appear in the account.</p>
          </li>
        </ol>
      } @else {
        <p>No committee email address is assigned to you yet. Ask a site administrator to check your committee role before setting up a mail app.</p>
      }
    }
  `
})
export class MailClientSetupComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private subscriptions: Subscription[] = [];
  private currentSettings: MailClientConnectionSettings | null = null;
  protected readonly MailClientSetupApp = MailClientSetupApp;
  protected readonly OutlookCalendarPlatform = OutlookCalendarPlatform;
  protected readonly StoredValue = StoredValue;
  readonly selectedApp = signal<MailClientSetupApp | OutlookCalendarPlatform>(MailClientSetupApp.THUNDERBIRD);
  readonly address = signal("");
  readonly connection = signal<MailClientConnectionSettings | null>(null);
  readonly platform = signal<MailClientSetupPlatform>(this.detectedPlatform());
  readonly platformTabs: SectionToggleTab[] = [
    {value: MailClientSetupPlatform.MAC, label: "Mac", icon: faApple},
    {value: MailClientSetupPlatform.WINDOWS, label: "Windows", icon: faWindows},
    {value: MailClientSetupPlatform.IOS, label: "iPhone or iPad", icon: faApple},
    {value: MailClientSetupPlatform.OTHER, label: "Other computer", icon: faLinux}
  ];
  private readonly allAppTabs: SectionToggleTab[] = [
    {value: MailClientSetupApp.THUNDERBIRD, label: "Thunderbird", icon: faEnvelope},
    {value: MailClientSetupApp.APPLE_MAIL, label: "Apple Mail on Mac", icon: faApple},
    {value: MailClientSetupApp.IOS_MAIL, label: "iPhone or iPad Mail", icon: faApple},
    ...outlookPlatformTabs()
  ];

  @Input() set settings(value: MailClientConnectionSettings | null) {
    const previousHost = this.connection()?.host ?? null;
    const overridden = this.currentSettings && previousHost !== this.currentSettings.host;
    this.currentSettings = value;
    this.connection.set(value ? mailClientConnectionForHost(value, overridden ? previousHost : value.host) : null);
    this.restoreAddress(this.route.snapshot.queryParams[StoredValue.MAIL_CLIENT_ADDRESS]);
  }

  get settings(): MailClientConnectionSettings | null {
    return this.currentSettings;
  }

  ngOnInit(): void {
    this.subscriptions.push(this.route.queryParams.subscribe(params => {
      this.restoreAddress(params[StoredValue.MAIL_CLIENT_ADDRESS]);
      this.restoreSelection(params);
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  get appTabs(): SectionToggleTab[] {
    return this.allAppTabs.filter(tab => this.platform() === MailClientSetupPlatform.IOS
      ? tab.value === MailClientSetupApp.IOS_MAIL
      : this.platform() === MailClientSetupPlatform.MAC
        ? [MailClientSetupApp.THUNDERBIRD, MailClientSetupApp.APPLE_MAIL, OutlookCalendarPlatform.MAC].some(app => app === tab.value)
        : this.platform() === MailClientSetupPlatform.WINDOWS
          ? [MailClientSetupApp.THUNDERBIRD, OutlookCalendarPlatform.WINDOWS_NEW, OutlookCalendarPlatform.WINDOWS_CLASSIC].some(app => app === tab.value)
          : tab.value === MailClientSetupApp.THUNDERBIRD);
  }

  selectPlatform(value: string): void {
    const selected = this.platformTabs.find(tab => tab.value === value);
    if (selected) {
      this.platform.set(selected.value as MailClientSetupPlatform);
      this.selectApp(this.appTabs.some(tab => tab.value === this.selectedApp()) ? this.selectedApp() : this.appTabs[0].value);
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {[StoredValue.MAIL_CLIENT_PLATFORM]: this.platform(), [StoredValue.MAIL_CLIENT_APP]: this.selectedApp()},
        queryParamsHandling: "merge"
      });
    }
  }

  private detectedPlatform(): MailClientSetupPlatform {
    const userAgent = browserCalendarClientHints().userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent) ? MailClientSetupPlatform.IOS
      : browserDeviceKind() === DeviceKind.APPLE ? MailClientSetupPlatform.MAC
        : browserDeviceKind() === DeviceKind.WINDOWS ? MailClientSetupPlatform.WINDOWS : MailClientSetupPlatform.OTHER;
  }

  private restoreSelection(params: Record<string, string>): void {
    const requested = params[StoredValue.MAIL_CLIENT_APP];
    const explicitPlatform = this.platformTabs.find(tab => tab.value === params[StoredValue.MAIL_CLIENT_PLATFORM]);
    const inferred = requested === OutlookCalendarPlatform.WINDOWS_NEW || requested === OutlookCalendarPlatform.WINDOWS_CLASSIC
      ? MailClientSetupPlatform.WINDOWS : requested === MailClientSetupApp.IOS_MAIL ? MailClientSetupPlatform.IOS
        : requested === OutlookCalendarPlatform.MAC || requested === MailClientSetupApp.APPLE_MAIL ? MailClientSetupPlatform.MAC : this.detectedPlatform();
    this.platform.set(explicitPlatform ? explicitPlatform.value as MailClientSetupPlatform : inferred);
    this.selectApp(this.appTabs.some(tab => tab.value === requested) ? requested : this.appTabs[0].value);
  }

  changeHost(host: string): void {
    if (this.settings) {
      this.connection.set(mailClientConnectionForHost(this.settings, host));
    }
  }

  selectApp(value: string): void {
    const tab = this.appTabs.find(app => app.value === value);
    if (tab) {
      this.selectedApp.set(tab.value as MailClientSetupApp | OutlookCalendarPlatform);
    }
  }

  selectAddress(value: string): void {
    this.restoreAddress(value);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {[StoredValue.MAIL_CLIENT_ADDRESS]: this.address()},
      queryParamsHandling: "merge"
    });
  }

  serverLabel(): string {
    return this.selectedApp() === MailClientSetupApp.THUNDERBIRD ? "Hostname" : this.selectedApp() === MailClientSetupApp.APPLE_MAIL || this.selectedApp() === MailClientSetupApp.IOS_MAIL ? "Host Name / Mail Server" : "Server / Server name";
  }

  usernameLabel(): string {
    return this.selectedApp() === MailClientSetupApp.APPLE_MAIL || this.selectedApp() === MailClientSetupApp.IOS_MAIL ? "User Name" : "Username";
  }

  private restoreAddress(value: string | null): void {
    const addresses = this.settings?.allowedFromAddresses ?? [];
    this.address.set(addresses.includes(value) ? value : addresses[0] ?? "");
  }
}
