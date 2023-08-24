import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { CommitteeMember } from "../models/committee.model";
import { CommitteeConfigService } from "../services/committee/commitee-config.service";
import { CommitteeReferenceData } from "../services/committee/committee-reference-data";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { UrlService } from "../services/url.service";

@Component({
  selector: "app-contact-us",
  templateUrl: "./contact-us.html",
  styleUrls: ["./contact-us.sass"]
})

export class ContactUsComponent implements OnInit, OnDestroy {

  @Input() format: string;
  @Input() text: string;
  @Input() role: string;
  @Input() heading: string;
  @Input() committeeReferenceDataOverride: CommitteeReferenceData;
  private logger: Logger;
  private dataSub: Subscription;
  private committeeReferenceData: CommitteeReferenceData;

  constructor(public urlService: UrlService,
              private loggerFactory: LoggerFactory,
              private committeeConfig: CommitteeConfigService) {
    this.logger = loggerFactory.createLogger(ContactUsComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.dataSub = this.committeeConfig.events().subscribe(data => this.committeeReferenceData = data);
  }

  ngOnDestroy() {
    if (this.dataSub) {
      this.dataSub.unsubscribe();
    }
  }

  committeeReferenceDataSource() {
    return this.committeeReferenceDataOverride || this.committeeReferenceData;
  }

  committeeMembers(): CommitteeMember[] {
    return this.role ? this.committeeReferenceDataSource()?.committeeMembersForRole(this.role) : this.committeeReferenceDataSource()?.committeeMembers();
  }

  email() {
    return this.committeeReferenceDataSource()?.contactUsField(this.role, "email");
  }

}
