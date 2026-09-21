import { Component, inject, Input } from "@angular/core";
import { Router } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faArrowLeft, faHouse } from "@fortawesome/free-solid-svg-icons";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { AppPath } from "../../models/route-follow.model";
import { AppShellService } from "../../services/maps/app-shell.service";
import { RouterHistoryService } from "../../services/router-history.service";

@Component({
  selector: "app-standalone-navigation",
  template: `
    @if (appShell.installed()) {
      <nav class="standalone-navigation" [class.compact]="compact" aria-label="App navigation">
        <button type="button" class="btn btn-quiet" [class.btn-icon]="compact"
                [tooltip]="backLabel()" (click)="back()" [attr.aria-label]="backLabel()">
          <fa-icon [icon]="faArrowLeft"/>
          @if (!compact) { <span>Back</span> }
        </button>
        <button type="button" class="btn btn-primary" [class.btn-icon]="compact"
                tooltip="Walks" (click)="walks()" aria-label="Walks home">
          <fa-icon [icon]="faHouse"/>
          @if (!compact) { <span>Walks</span> }
        </button>
      </nav>
    }
  `,
  styles: [`
    .standalone-navigation
      display: flex
      align-items: center
      gap: 8px
      padding: 8px max(12px, env(safe-area-inset-right)) 8px max(12px, env(safe-area-inset-left))

    .standalone-navigation .btn
      display: inline-flex
      align-items: center
      justify-content: center
      gap: 6px
      min-height: 44px

    .standalone-navigation.compact
      padding: 0

    .standalone-navigation.compact .btn-icon
      width: 44px
      height: 44px
      min-width: 44px
      border-radius: 50%
  `],
  imports: [FontAwesomeModule, TooltipDirective]
})
export class StandaloneNavigationComponent {
  @Input() compact = false;
  protected appShell = inject(AppShellService);
  private router = inject(Router);
  private history = inject(RouterHistoryService);
  protected faArrowLeft = faArrowLeft;
  protected faHouse = faHouse;

  protected backLabel(): string {
    return this.history.appBackDestination() === "/" + AppPath.ROOT ? "Back to walks" : "Back";
  }

  protected back(): void {
    this.history.navigateBackWithinApp();
  }

  protected walks(): void {
    void this.router.navigate(["/" + AppPath.ROOT]);
  }
}
