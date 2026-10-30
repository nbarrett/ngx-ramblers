import {TestBed} from "@angular/core/testing";
import {ActivatedRoute, Router} from "@angular/router";
import {BehaviorSubject} from "rxjs";
import {vi} from "vitest";
import {MailClientSetupComponent} from "./mail-client-setup";
import {MailClientConnectionSettings, MailClientSetupApp, MailClientSetupPlatform} from "../../../models/mail-client.model";
import {StoredValue} from "../../../models/ui-actions";
import {OutlookCalendarPlatform} from "../../../models/walk-programme.model";
import {ClipboardService} from "../../../services/clipboard.service";

const settings: MailClientConnectionSettings = {
  enabled: true,
  host: "mail.group.example.org.uk",
  imapPort: 993,
  smtpPort: 465,
  imapSecure: true,
  smtpSecure: true,
  usernameHint: "chair@group.example.org.uk",
  allowedFromAddresses: ["chair@group.example.org.uk", "secretary@group.example.org.uk"]
};

describe("mail client setup instructions", () => {
  const queryParams = new BehaviorSubject<Record<string, string>>({});
  const navigate = vi.fn();
  const copyToClipboard = vi.fn();

  beforeEach(() => {
    queryParams.next({});
    navigate.mockReset().mockResolvedValue(true);
    copyToClipboard.mockReset().mockResolvedValue(null);
    TestBed.configureTestingModule({
      imports: [MailClientSetupComponent],
      providers: [
        {provide: Router, useValue: {navigate}},
        {provide: ActivatedRoute, useValue: {queryParams, snapshot: {queryParams: queryParams.value}}},
        {provide: ClipboardService, useValue: {copyToClipboard}}
      ]
    });
  });

  it("restores the chosen client and address and shows only that client's instructions", () => {
    queryParams.next({[StoredValue.MAIL_CLIENT_APP]: OutlookCalendarPlatform.WINDOWS_CLASSIC, [StoredValue.MAIL_CLIENT_ADDRESS]: settings.allowedFromAddresses[1]});
    const fixture = TestBed.createComponent(MailClientSetupComponent);
    fixture.componentRef.setInput("settings", settings);
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedApp()).toBe(OutlookCalendarPlatform.WINDOWS_CLASSIC);
    expect(fixture.componentInstance.address()).toBe(settings.allowedFromAddresses[1]);
    expect(fixture.nativeElement.textContent).toContain("File → Add Account");
    expect(fixture.nativeElement.textContent).not.toContain("Re-test");
  });

  it("shows a preselected platform bar and filters its apps without an extra device button", () => {
    queryParams.next({[StoredValue.MAIL_CLIENT_PLATFORM]: MailClientSetupPlatform.MAC});
    const fixture = TestBed.createComponent(MailClientSetupComponent);
    fixture.componentRef.setInput("settings", settings);
    fixture.detectChanges();
    expect(fixture.componentInstance.platform()).toBe(MailClientSetupPlatform.MAC);
    expect(fixture.componentInstance.appTabs.map(tab => tab.value)).toEqual([MailClientSetupApp.THUNDERBIRD, MailClientSetupApp.APPLE_MAIL, OutlookCalendarPlatform.MAC]);
    expect(fixture.nativeElement.textContent).not.toContain("Change device");
    fixture.componentInstance.selectPlatform(MailClientSetupPlatform.WINDOWS);
    fixture.detectChanges();
    expect(fixture.componentInstance.appTabs.map(tab => tab.value)).toEqual([MailClientSetupApp.THUNDERBIRD, OutlookCalendarPlatform.WINDOWS_NEW, OutlookCalendarPlatform.WINDOWS_CLASSIC]);
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({queryParams: {[StoredValue.MAIL_CLIENT_PLATFORM]: MailClientSetupPlatform.WINDOWS, [StoredValue.MAIL_CLIENT_APP]: MailClientSetupApp.THUNDERBIRD}}));
  });

  it("updates both server usernames and the email field when another role is chosen", async () => {
    const fixture = TestBed.createComponent(MailClientSetupComponent);
    fixture.componentRef.setInput("settings", settings);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const select = fixture.nativeElement.querySelector("select");
    select.value = settings.allowedFromAddresses[1];
    select.dispatchEvent(new Event("change"));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    ["mail-setup-email", "mail-setup-imap-user", "mail-setup-smtp-user"].forEach(id => {
      expect(fixture.nativeElement.querySelector(`input[id='${id}']`).value).toBe(settings.allowedFromAddresses[1]);
    });
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({queryParams: {[StoredValue.MAIL_CLIENT_ADDRESS]: settings.allowedFromAddresses[1]}, queryParamsHandling: "merge"}));
  });

  it("copies the displayed server value through the existing secret input component", async () => {
    const fixture = TestBed.createComponent(MailClientSetupComponent);
    fixture.componentRef.setInput("settings", settings);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const host = fixture.nativeElement.querySelector("app-secret-input[id='mail-setup-imap-host']");
    expect(host.querySelector("input").readOnly).toBe(false);
    expect(host.querySelector("input").value).toBe(settings.host);
    host.querySelector("button").click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(copyToClipboard).toHaveBeenCalledWith(settings.host);
  });

  it("lets a host be edited and switches both ports and security between local and public settings", async () => {
    const fixture = TestBed.createComponent(MailClientSetupComponent);
    fixture.componentRef.setInput("settings", {...settings, localImapPort: 11993, localSmtpPort: 11587});
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const host = fixture.nativeElement.querySelector("input[id='mail-setup-imap-host']");
    host.value = "localhost";
    host.dispatchEvent(new Event("input"));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("input[id='mail-setup-smtp-host']").value).toBe("localhost");
    expect(fixture.nativeElement.querySelector("input[id='mail-setup-imap-port']").value).toBe("11993");
    expect(fixture.nativeElement.querySelector("input[id='mail-setup-smtp-port']").value).toBe("11587");
    expect(fixture.componentInstance.connection().imapSecure).toBe(false);
    fixture.componentRef.setInput("settings", {...settings, localImapPort: 11993, localSmtpPort: 11587});
    fixture.detectChanges();
    expect(fixture.componentInstance.connection().host).toBe("localhost");
    fixture.componentInstance.changeHost(settings.host);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.connection()).toMatchObject({host: settings.host, imapPort: 993, smtpPort: 465, imapSecure: true, smtpSecure: true});
    expect(settings.host).toBe("mail.group.example.org.uk");
  });

  it("uses the supplied local ports and explains why a phone cannot use localhost", async () => {
    const fixture = TestBed.createComponent(MailClientSetupComponent);
    fixture.componentRef.setInput("settings", {...settings, host: "localhost", imapPort: 1993, smtpPort: 1587, imapSecure: false, smtpSecure: false});
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("input[id='mail-setup-imap-port']").value).toBe("1993");
    expect(fixture.nativeElement.querySelector("input[id='mail-setup-smtp-port']").value).toBe("1587");
    expect(fixture.nativeElement.textContent).toContain("on a phone refers to the phone itself");
    fixture.componentInstance.selectApp(MailClientSetupApp.THUNDERBIRD);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Normal password");
  });

  it("does not offer account setup when no committee address is assigned", () => {
    const fixture = TestBed.createComponent(MailClientSetupComponent);
    fixture.componentRef.setInput("settings", {...settings, allowedFromAddresses: []});
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("No committee email address is assigned");
    expect(fixture.nativeElement.querySelector("app-secret-input")).toBeNull();
  });
});
