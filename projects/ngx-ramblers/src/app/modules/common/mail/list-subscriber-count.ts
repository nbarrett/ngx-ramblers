import { Component, inject, Input } from "@angular/core";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { ListInfo } from "../../../models/mail.model";
import { Member } from "../../../models/member.model";
import { ListSubscriberService } from "../../../services/mail/list-subscriber.service";

@Component({
  selector: "app-list-subscriber-count",
  imports: [TooltipDirective],
  template: `
    @if (listKey(); as id) {
      <span class="list-subscriber-count"
            [tooltip]="listSubscriberService.subscriberNamesTooltip(members, id)"
            containerClass="list-subscriber-count-tooltip"
            placement="right">{{ listSubscriberService.subscriberCountLabel(members, id) }}</span>
    }`,
  styles: [`
    .list-subscriber-count
      font-size: 0.85em
      color: #6c757d
      text-decoration: underline dotted
      text-underline-offset: 2px
      cursor: default
    :host ::ng-deep .list-subscriber-count-tooltip .tooltip-inner
      max-width: 360px
      text-align: left
      white-space: normal
  `]
})
export class ListSubscriberCountComponent {

  protected listSubscriberService = inject(ListSubscriberService);
  @Input() list: ListInfo | null = null;
  @Input() listId: number | null = null;
  @Input() members: Member[] = [];

  protected listKey(): number | null {
    return this.list?.id ?? this.listId;
  }
}
