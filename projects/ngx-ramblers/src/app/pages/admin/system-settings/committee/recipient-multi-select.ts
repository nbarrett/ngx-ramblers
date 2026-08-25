import { AfterViewInit, Component, EventEmitter, inject, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgSelectComponent } from "@ng-select/ng-select";
import { NgxLoggerLevel } from "ngx-logger";
import { CommitteeRecipientOption } from "../../../../models/committee.model";
import { Member } from "../../../../models/member.model";
import { isArray, isObject, isString } from "es-toolkit/compat";
import { sortBy } from "../../../../functions/arrays";
import { emailIsOnDomain, normaliseEmail, validEmail } from "../../../../functions/strings";
import { CommitteeQueryService } from "../../../../services/committee/committee-query.service";
import { FullNamePipe } from "../../../../pipes/full-name.pipe";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";

@Component({
  selector: "app-recipient-multi-select",
  imports: [FormsModule, NgSelectComponent],
  styles: [`
    :host ::ng-deep .recipient-select,
    :host ::ng-deep .recipient-select .ng-select-container,
    :host ::ng-deep .recipient-select .ng-value-container,
    :host ::ng-deep .recipient-select .ng-value,
    :host ::ng-deep .recipient-select .ng-placeholder,
    :host ::ng-deep .recipient-select .ng-input,
    :host ::ng-deep .recipient-select .ng-input input,
    :host ::ng-deep .ng-dropdown-panel,
    :host ::ng-deep .ng-dropdown-panel .ng-option
      font-size: 0.875rem
    :host ::ng-deep .recipient-select .ng-select-container
      min-height: 31px
    :host ::ng-deep .ng-dropdown-panel .ng-option
      white-space: normal
  `],
  template: `
    <ng-select
      [items]="options"
      [searchable]="true"
      [clearable]="true"
      [editableSearchTerm]="false"
      [clearSearchOnAdd]="true"
      [addTag]="typedAddressOption() ? tagRecipientEmail : false"
      addTagText="Press Enter to add this email address"
      [multiple]="true"
      [closeOnSelect]="false"
      dropdownPosition="bottom"
      [placeholder]="placeholder"
      [notFoundText]="emptySearchText()"
      class="recipient-select"
      bindLabel="label"
      bindValue="email"
      [compareWith]="compareEmails"
      (open)="refresh()"
      (search)="onSearch($event)"
      [id]="selectId()"
      [inputAttrs]="searchAttrs"
      [ngModel]="selectedEmails"
      (ngModelChange)="onChange($event)">
    </ng-select>
  `
})
export class RecipientMultiSelect implements OnInit, OnChanges, AfterViewInit {
  private logger: Logger = inject(LoggerFactory).createLogger("RecipientMultiSelect", NgxLoggerLevel.ERROR);
  private committeeQueryService = inject(CommitteeQueryService);
  private fullNamePipe = inject(FullNamePipe);

  @ViewChild(NgSelectComponent) private ngSelect: NgSelectComponent | null = null;

  @Input() recipients: string[] = [];
  @Input() lockedEmails: string[] = [];
  @Input() inputId = "recipient-multi-select";
  @Input() placeholder = "Select one or more recipients";
  @Input() requiredDomain: string | null = null;
  @Input() includeMemberOptions = true;
  @Input() excludedEmails: string[] = [];
  @Input() groupDomain: string | null = null;
  @Output() recipientsChange = new EventEmitter<string[]>();

  options: CommitteeRecipientOption[] = [];
  selectedEmails: string[] = [];
  searchAttrs: Record<string, string> = {};
  private applyingInput = false;
  private typedSearch = "";

  ngOnInit() {
    this.searchAttrs = this.buildSearchAttrs();
    this.applyRecipients(this.recipients);
  }

  ngAfterViewInit() {
    this.applyRecipients(this.recipients);
  }

  selectId(): string {
    return (this.inputId || "recipient-select").replace(/[^a-zA-Z0-9_-]+/g, "-");
  }

  compareEmails = (left: unknown, right: unknown): boolean =>
    normaliseEmail(this.emailValue(left)) === normaliseEmail(this.emailValue(right));

  emptySearchText(): string {
    return this.requiredDomain
      ? `Type a complete address ending @${this.requiredDomain}`
      : "Type a complete email address";
  }

  onSearch(event: {term: string}): void {
    this.typedSearch = event?.term || "";
  }

  typedAddressOption(): CommitteeRecipientOption | null {
    return this.tagRecipientEmail(this.typedSearch || this.ngSelect?.searchTerm || "");
  }

  private buildSearchAttrs(): Record<string, string> {
    return {
      autocomplete: "one-time-code",
      autocorrect: "off",
      autocapitalize: "off",
      spellcheck: "false",
      name: `${this.selectId()}-search`,
      "data-lpignore": "true",
      "data-1p-ignore": "true",
      "data-bwignore": "true",
      "data-form-type": "other"
    };
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes["inputId"]) {
      this.searchAttrs = this.buildSearchAttrs();
    }
    if ((changes["recipients"] || changes["lockedEmails"]) && !this.sameEmails(this.selectedEmails, this.mergeLocked(this.recipients))) {
      this.applyRecipients(this.recipients);
    } else if (changes["excludedEmails"] || changes["groupDomain"]) {
      this.refresh();
    }
  }

  private locked(): string[] {
    return (this.lockedEmails || []).filter(Boolean);
  }

  private mergeLocked(emails: string[]): string[] {
    return this.locked()
      .concat(emails || [])
      .filter(Boolean)
      .reduce<string[]>((unique, email) => unique.some(existing => normaliseEmail(existing) === normaliseEmail(email)) ? unique : unique.concat(email), []);
  }

  private sameEmails(left: string[] | null, right: string[] | null): boolean {
    const first = (left || []).map(email => normaliseEmail(email)).filter(Boolean).sort();
    const second = (right || []).map(email => normaliseEmail(email)).filter(Boolean).sort();
    return first.length === second.length && first.every((email, index) => email === second[index]);
  }

  private excluded(email: string): boolean {
    const wanted = normaliseEmail(email);
    return (this.excludedEmails || []).some(excludedEmail => normaliseEmail(excludedEmail) === wanted);
  }

  private onGroupDomain(email: string): boolean {
    return Boolean(this.groupDomain) && emailIsOnDomain(email, this.groupDomain);
  }

  private emailValue(value: unknown): string {
    if (isString(value)) {
      return value;
    } else if (isObject(value) && isString((value as CommitteeRecipientOption).email)) {
      return (value as CommitteeRecipientOption).email;
    } else {
      return "";
    }
  }

  private asEmailList(recipients: string[] | string | null): string[] {
    if (isArray(recipients)) {
      return recipients.map(email => this.emailValue(email)).filter(Boolean);
    } else if (isString(recipients) && recipients) {
      return [recipients];
    } else {
      return [];
    }
  }

  private incomingIsRemoval(incoming: string[], current: string[]): boolean {
    const have = current.map(email => normaliseEmail(email));
    return incoming.every(email => have.includes(normaliseEmail(email)));
  }

  private applyRecipients(emails: string[]) {
    this.applyingInput = true;
    this.selectedEmails = this.mergeLocked(emails);
    this.refresh();
    Promise.resolve().then(() => {
      this.applyingInput = false;
    });
  }

  refresh(): void {
    const memberOptions = this.includeMemberOptions
      ? this.committeeQueryService.committeeMembers
        .filter(member => member?.email && !this.excluded(member.email) && !this.onGroupDomain(member.email))
        .map(member => this.recipientOptionFor(member))
        .filter((option): option is CommitteeRecipientOption => !!option)
      : [];
    const selectedOptions = this.selectedEmails
      .filter(email => email)
      .map(email => this.displayOptionFor(email));
    const nextOptions = memberOptions
      .concat(selectedOptions)
      .reduce<CommitteeRecipientOption[]>((acc, option) => {
        const optionEmail = normaliseEmail(option.email);
        const exists = acc.find(item => normaliseEmail(item.email) === optionEmail);
        return exists ? acc : acc.concat(option);
      }, [])
      .sort(sortBy("label"));
    if (!this.sameEmails(this.options.map(option => option.email), nextOptions.map(option => option.email))) {
      this.options = nextOptions;
    }
    this.logger.debug("refresh: options=", this.options.length, "for recipients=", this.selectedEmails);
  }

  tagRecipientEmail = (value: string): CommitteeRecipientOption | null => {
    if (!validEmail(value)) {
      return null;
    } else if (this.requiredDomain && !normaliseEmail(value).endsWith(`@${this.requiredDomain.toLowerCase()}`)) {
      return null;
    } else if (this.excluded(value) || this.onGroupDomain(value)) {
      return null;
    } else {
      return this.memberOptionForEmail(value) ?? {label: value, email: value};
    }
  };

  private recipientOptionFor(member: Member): CommitteeRecipientOption | null {
    if (!member?.email) {
      return null;
    } else {
      return {
        email: member.email,
        label: `${this.fullNamePipe.transform(member)} - ${member.email}`
      };
    }
  }

  private memberOptionForEmail(email: string): CommitteeRecipientOption | null {
    const wanted = this.includeMemberOptions ? normaliseEmail(email) : null;
    const member = wanted ? this.committeeQueryService.committeeMembers
      .find(candidate => candidate?.email && normaliseEmail(candidate.email) === wanted) : null;
    return member ? this.recipientOptionFor(member) : null;
  }

  private displayOptionFor(email: string): CommitteeRecipientOption {
    return this.memberOptionForEmail(email) ?? {label: email, email};
  }

  onChange(recipients: string[] | string) {
    const incoming = this.asEmailList(recipients);
    const current = this.selectedEmails;
    const merged = this.incomingIsRemoval(incoming, current) ? incoming : current.concat(incoming);
    const next = this.mergeLocked(merged);
    if (!this.applyingInput && !this.sameEmails(current, next)) {
      this.selectedEmails = next;
      this.typedSearch = "";
      this.ngSelect?.filter("");
      this.refresh();
      this.recipientsChange.emit(next);
    }
  }
}
