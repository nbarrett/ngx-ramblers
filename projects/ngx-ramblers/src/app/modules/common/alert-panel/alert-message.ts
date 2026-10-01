import {IconDefinition} from "@fortawesome/fontawesome-svg-core";
import {Component, EventEmitter, Input, Output} from "@angular/core";
import {FontAwesomeModule} from "@fortawesome/angular-fontawesome";
import {faArrowRight, faTriangleExclamation, faXmark} from "@fortawesome/free-solid-svg-icons";
import {TooltipDirective} from "ngx-bootstrap/tooltip";

@Component({
  selector: "app-alert-message",
  imports: [FontAwesomeModule, TooltipDirective],
  host: {"[hidden]": "dismissed"},
  styles: `
    :host
      display: block
    :host[hidden]
      display: none
    .alert-message-row
      display: flex
      align-items: flex-start
      gap: var(--space-3, 12px)
    .alert-message-content
      flex: 1
      min-width: 0
    .alert-message-title
      display: flex
      align-items: center
      gap: 8px
      margin-bottom: var(--space-2, 8px)
      font-size: inherit
    .alert-message-body
      display: flex
      flex-direction: column
      gap: var(--space-2, 8px)
    .alert-message-actions
      margin-top: var(--space-2, 8px)
    :host ::ng-deep .alert-message-content a
      font-weight: 700
      text-decoration: none
      color: inherit
      &:hover,
      &:focus,
      &:active
        text-decoration: none
        background-color: transparent
        color: inherit
    @media (min-width: 768px)
      :host-context(.alert-panel-compact) .alert-message-title
        display: inline-flex
        align-items: baseline
        gap: 8px
        margin: 0
        vertical-align: baseline
        &::after
          content: " — "
          font-weight: normal
          white-space: pre
      :host-context(.alert-panel-compact) .alert-message-body,
      :host-context(.alert-panel-compact) ::ng-deep .alert-message-body *
        display: inline
      :host-context(.alert-panel-compact) .alert-message-actions
        display: block
    .alert-message-dismiss
      display: inline-flex
      align-items: center
      justify-content: center
      flex-shrink: 0
      width: 28px
      height: 28px
      margin-left: auto
      padding: 0
      border: none
      border-radius: 50%
      background: transparent
      color: #9b2c2c
      cursor: pointer
      &:hover,
      &:focus
        background: rgba(155, 44, 44, 0.1)
        color: #7a1f1f
  `,
  template: `
    <div class="alert-message-row">
      <div class="alert-message-content">
        @if (title) {
          <div class="alert-message-title"><fa-icon [icon]="icon" [animation]="spinning ? 'spin' : undefined"/><strong>{{ title }}</strong></div>
        }
        <div class="alert-message-body"><ng-content/></div>
        @if (actionLabel) {
          <div class="alert-message-actions">
            <a href="" (click)="$event.preventDefault(); action.emit()">
              <fa-icon [icon]="actionIcon" class="me-1"/>{{ actionLabel }}
            </a>
          </div>
        }
      </div>
      <button type="button" class="alert-message-dismiss" tooltip="Dismiss"
              container="body" placement="bottom" [attr.aria-label]="title ? 'Dismiss ' + title : 'Dismiss message'"
              (click)="dismiss()">
        <fa-icon [icon]="faXmark"/>
      </button>
    </div>
  `
})
export class AlertMessageComponent {
  @Input({required: true}) title = "";
  @Input() icon: IconDefinition = faTriangleExclamation;
  @Input() spinning = false;
  @Input() actionLabel = "";
  @Input() actionIcon: IconDefinition = faArrowRight;
  @Output() action = new EventEmitter<void>();
  @Output() dismissedChange = new EventEmitter<void>();
  dismissed = false;
  private currentMessageKey: string | null = null;
  protected readonly faXmark = faXmark;

  @Input() set messageKey(value: string | null) {
    if (value !== this.currentMessageKey) {
      this.currentMessageKey = value;
      this.dismissed = false;
    }
  }

  dismiss(): void {
    this.dismissed = true;
    this.dismissedChange.emit();
  }
}
