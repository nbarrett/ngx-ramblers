import { AsyncPipe, CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faInbox } from "@fortawesome/free-solid-svg-icons";
import { InboxNotificationService } from "../../../services/inbox/inbox-notification.service";

@Component({
  selector: "app-inbox-notification-badge",
  standalone: true,
  imports: [CommonModule, AsyncPipe, RouterLink, FontAwesomeModule],
  template: `
    @if ((inboxNotificationService.total$ | async); as total) {
      @if (total > 0) {
        <a class="inbox-notification-badge" routerLink="/admin/inbox"
           [attr.aria-label]="total + ' unread inbox message' + (total === 1 ? '' : 's')"
           [title]="total + ' unread inbox message' + (total === 1 ? '' : 's')">
          <fa-icon [icon]="faInbox" class="inbox-icon"></fa-icon>
          <span class="inbox-count">{{ total }}</span>
        </a>
      }
    }`,
  styles: [`
    .inbox-notification-badge
      display: inline-flex
      align-items: center
      gap: 0.35rem
      background-color: #f9b104
      color: #212529 !important
      padding: 0.25rem 0.5rem
      border-radius: 0.35rem
      text-decoration: none !important
      font-weight: 600
      line-height: 1
      margin-left: 0.5rem
    .inbox-notification-badge:hover
      background-color: #ffc107
    .inbox-notification-badge .inbox-icon
      color: #212529
      font-size: 0.9rem
    .inbox-notification-badge .inbox-count
      background-color: #fff
      color: #212529
      border-radius: 999px
      padding: 0 0.45rem
      min-width: 1.25rem
      display: inline-flex
      align-items: center
      justify-content: center
      font-size: 0.8rem
      line-height: 1.3
  `]
})
export class InboxNotificationBadgeComponent {

  protected inboxNotificationService = inject(InboxNotificationService);
  protected readonly faInbox = faInbox;
}
