import { Component, EventEmitter, Input, Output } from "@angular/core";
import { ListInfo } from "../../../models/mail.model";
import { Member } from "../../../models/member.model";
import { ListSubscriberCountComponent } from "./list-subscriber-count";

@Component({
  selector: "app-mailing-list-radios",
  imports: [ListSubscriberCountComponent],
  template: `
    @if (noneLabel) {
      <div class="form-check">
        <input class="form-check-input" type="radio" [name]="groupName" [id]="idPrefix + '-none'"
               [checked]="noneSelected && selectedId === null" (change)="selectedIdChange.emit(null)">
        <label class="form-check-label" [for]="idPrefix + '-none'">{{ noneLabel }}</label>
      </div>
    }
    @if (listsHeading) {
      <div class="mt-2 fw-semibold">{{ listsHeading }}</div>
    }
    @for (list of lists; track list.id) {
      <div class="form-check" [class]="itemClass">
        <input class="form-check-input" type="radio" [name]="groupName" [id]="idPrefix + '-' + list.id"
               [checked]="selectedId === list.id" (change)="selectedIdChange.emit(list.id)">
        <label class="form-check-label" [for]="idPrefix + '-' + list.id">
          {{ list.name }}
          <app-list-subscriber-count [list]="list" [members]="members"/>
        </label>
      </div>
    }
  `
})
export class MailingListRadiosComponent {
  @Input() lists: ListInfo[] = [];
  @Input() members: Member[] = [];
  @Input() groupName = "mailing-list";
  @Input() idPrefix = "mailing-list";
  @Input() selectedId: number | null = null;
  @Input() noneSelected = true;
  @Input() noneLabel: string | null = null;
  @Input() listsHeading: string | null = null;
  @Input() itemClass = "";
  @Output() selectedIdChange = new EventEmitter<number | null>();
}
