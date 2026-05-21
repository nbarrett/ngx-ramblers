import { Component, EventEmitter, inject, Input, OnChanges, OnInit, Output, SimpleChanges } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgSelectComponent } from "@ng-select/ng-select";
import { NgxLoggerLevel } from "ngx-logger";
import { CommitteeRecipientOption } from "../../../../models/committee.model";
import { Member } from "../../../../models/member.model";
import { sortBy } from "../../../../functions/arrays";
import { normaliseEmail, validEmail } from "../../../../functions/strings";
import { CommitteeQueryService } from "../../../../services/committee/committee-query.service";
import { FullNamePipe } from "../../../../pipes/full-name.pipe";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";

@Component({
  selector: "app-recipient-multi-select",
  standalone: true,
  imports: [FormsModule, NgSelectComponent],
  template: `
    <ng-select
      [items]="options"
      [searchable]="true"
      [clearable]="true"
      [editableSearchTerm]="true"
      [addTag]="tagRecipientEmail"
      [multiple]="true"
      [closeOnSelect]="true"
      dropdownPosition="bottom"
      [placeholder]="placeholder"
      class="recipient-select"
      bindLabel="label"
      bindValue="email"
      (open)="refresh()"
      [id]="inputId"
      [ngModel]="recipients"
      (ngModelChange)="onChange($event)">
    </ng-select>
  `
})
export class RecipientMultiSelect implements OnInit, OnChanges {
  private logger: Logger = inject(LoggerFactory).createLogger("RecipientMultiSelect", NgxLoggerLevel.ERROR);
  private committeeQueryService = inject(CommitteeQueryService);
  private fullNamePipe = inject(FullNamePipe);

  @Input() recipients: string[] = [];
  @Input() inputId = "recipient-multi-select";
  @Input() placeholder = "Select one or more recipients";
  @Output() recipientsChange = new EventEmitter<string[]>();

  options: CommitteeRecipientOption[] = [];

  ngOnInit() {
    this.refresh();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes["recipients"]) {
      this.refresh();
    }
  }

  refresh(): void {
    const memberOptions = this.committeeQueryService.committeeMembers
      .map(member => this.recipientOptionFor(member))
      .filter((option): option is CommitteeRecipientOption => !!option);
    const selectedOptions = (this.recipients || [])
      .filter(email => email)
      .map(email => this.tagRecipientEmail(email))
      .filter((option): option is CommitteeRecipientOption => !!option);
    this.options = memberOptions
      .concat(selectedOptions)
      .reduce<CommitteeRecipientOption[]>((acc, option) => {
        const optionEmail = normaliseEmail(option.email);
        const exists = acc.find(item => normaliseEmail(item.email) === optionEmail);
        return exists ? acc : [...acc, option];
      }, [])
      .sort(sortBy("label"));
    this.logger.debug("refresh: options=", this.options.length, "for recipients=", this.recipients);
  }

  tagRecipientEmail = (value: string): CommitteeRecipientOption | null => {
    if (!validEmail(value)) {
      return null;
    }
    return {label: value, email: value};
  };

  private recipientOptionFor(member: Member): CommitteeRecipientOption | null {
    if (!member?.email) {
      return null;
    }
    return {
      email: member.email,
      label: `${this.fullNamePipe.transform(member)} — ${member.email}`
    };
  }

  onChange(recipients: string[]) {
    const next = [...(recipients || [])];
    this.recipients = next;
    this.refresh();
    this.recipientsChange.emit(next);
  }
}
