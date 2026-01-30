import { Component, Input } from "@angular/core";
import { NgClass } from "@angular/common";
import { reversed } from "../../functions/arrays";

@Component({
  selector: "app-session-logs",
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="session-logs">
      @for (message of messagesNewestFirst(); track $index) {
        <div [ngClass]="{'text-danger': isError(message), 'text-success': isSuccess(message)}">
          {{ message }}
        </div>
      }
    </div>
  `,
  styles: [`
    .session-logs
      background-color: #1e293b
      color: #e2e8f0
      padding: 1rem
      border-radius: 0.375rem
      font-family: monospace
      font-size: 0.875rem
      max-height: 400px
      overflow-y: auto

      div
        margin-bottom: 0.25rem
  `]
})
export class SessionLogsComponent {
  @Input() messages: string[] = [];

  messagesNewestFirst(): string[] {
    return reversed(this.messages);
  }

  isError(message: string): boolean {
    return message?.toLowerCase().includes("error");
  }

  isSuccess(message: string): boolean {
    return message?.includes("Successfully") || message?.includes("Completed");
  }
}
