import { By } from "@angular/platform-browser";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { LoggerTestingModule } from "ngx-logger/testing";
import { MailMxRecords } from "./mail-mx-records";
import { MailDnsLookupStatus, MxRecordStatus } from "../../../../models/cloudflare-email-routing.model";

const status: MxRecordStatus = {
  subdomain: "group.example.org.uk",
  allPresent: true,
  existingRecords: [],
  expectedRecords: [],
  extraRecords: [],
  dnsHealth: {
    healthy: false,
    checkedAt: 1793805000000,
    message: "Public DNS cannot resolve the configured mail servers.",
    delegations: [{hostname: "group.example.org.uk", records: [{id: "ns-1", name: "group.example.org.uk", type: "NS", content: "ns1.mail-provider.example.com"}]}],
    lookups: [{resolver: "1.1.1.1", status: MailDnsLookupStatus.FAILED, exchanges: [], error: "ESERVFAIL"}]
  }
};

describe("mail MX DNS feedback", () => {
  it("shows a delegation warning and resolver failure even when all configured MX records are present", async () => {
    await TestBed.configureTestingModule({imports: [MailMxRecords, LoggerTestingModule], providers: [provideRouter([])]}).compileComponents();
    const fixture = TestBed.createComponent(MailMxRecords);
    fixture.componentRef.setInput("domain", status.subdomain);
    fixture.componentRef.setInput("status", status);
    fixture.componentRef.setInput("domainSettingsUrl", "https://group.example.org.uk/admin/mail-settings?tab=domains");
    fixture.detectChanges();
    const warning = fixture.nativeElement.querySelector(".alert-warning");
    expect(warning.textContent).toContain("Incoming mail DNS needs attention");
    expect(warning.textContent).toContain("group.example.org.uk");
    expect(warning.textContent).toContain("ns1.mail-provider.example.com");
    expect(warning.textContent).toContain("ESERVFAIL");
    expect(fixture.nativeElement.querySelector(".alert-success")).toBeNull();
    const link = warning.querySelector("a");
    expect(link.textContent).toBe("Admin → Mail Settings → Domains");
    expect(link.href).toBe("https://group.example.org.uk/admin/mail-settings?tab=domains");
  });
});

describe("mail DNS maintenance confirmation", () => {
  async function maintenanceFixture() {
    await TestBed.configureTestingModule({imports: [MailMxRecords, LoggerTestingModule], providers: [provideRouter([])]}).compileComponents();
    const fixture = TestBed.createComponent(MailMxRecords);
    fixture.componentRef.setInput("domain", status.subdomain);
    fixture.componentRef.setInput("status", status);
    fixture.componentRef.setInput("allowMutate", true);
    fixture.componentRef.setInput("allowMaintenance", true);
    fixture.detectChanges();
    return fixture;
  }

  it("shows the exact records and emits removal only after a separate confirmation", async () => {
    const fixture = await maintenanceFixture();
    const remove = vi.spyOn(fixture.componentInstance.removeDelegation, "emit");
    fixture.debugElement.queryAll(By.css("button")).find(button => button.nativeElement.textContent.includes("Review delegation removal")).nativeElement.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(remove).not.toHaveBeenCalled();
    const warning = fixture.nativeElement.textContent;
    expect(warning).toContain("Confirm removal of NS delegation");
    expect(warning).toContain("ns1.mail-provider.example.com");
    expect(warning).toContain("whole subdomain");
    fixture.componentInstance.confirmDelegationRemoval();
    expect(remove).toHaveBeenCalledWith({hostname: status.subdomain, records: status.dnsHealth.delegations[0].records});
  });

  it("does not remove anything without a reviewed confirmation", async () => {
    const fixture = await maintenanceFixture();
    const remove = vi.spyOn(fixture.componentInstance.removeDelegation, "emit");
    fixture.componentInstance.confirmDelegationRemoval();
    expect(remove).not.toHaveBeenCalled();
  });

  it("keeps the reviewed record snapshot when a refresh changes the current diagnostics", async () => {
    const fixture = await maintenanceFixture();
    const remove = vi.spyOn(fixture.componentInstance.removeDelegation, "emit");
    fixture.componentInstance.reviewDelegationRemoval();
    fixture.componentRef.setInput("status", {...status, dnsHealth: {...status.dnsHealth, delegations: [{hostname: status.subdomain, records: status.dnsHealth.delegations[0].records.map(record => ({...record, content: "changed.example.com"}))}]}});
    fixture.detectChanges();
    fixture.componentInstance.confirmDelegationRemoval();
    expect(remove).toHaveBeenCalledWith({hostname: status.subdomain, records: status.dnsHealth.delegations[0].records});
  });

  it("does not offer removal of an ancestor domain's delegation", async () => {
    const fixture = await maintenanceFixture();
    fixture.componentRef.setInput("status", {...status, subdomain: "team.group.example.org.uk"});
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain("Review delegation removal");
  });
});
