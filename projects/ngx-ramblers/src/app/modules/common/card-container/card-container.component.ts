import { Component, Input } from "@angular/core";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";

@Component({
  selector: "app-card-container",
  template: `
    <div class="social-card">
      <div class="social-card-header">
        @if (icon) {
          <span class="social-card-brand" [style.color]="brandColour">
            <fa-icon [icon]="icon"/>
          </span>
        }
        <div class="social-card-heading">
          <span class="social-card-title">{{ title }}</span>
          @if (subtitle) {
            <span class="social-card-subtitle">{{ subtitle }}</span>
          }
        </div>
        @if (href) {
          <a class="social-card-link" [href]="href" target="_blank" rel="noopener noreferrer"
             [attr.aria-label]="'Visit ' + title">
            <span class="social-card-link-text">Visit</span>
            <fa-icon [icon]="faArrowUpRightFromSquare"/>
          </a>
        }
      </div>
      <div class="social-card-body">
        <ng-content/>
      </div>
    </div>
  `,
  styleUrls: ["./card-container.component.sass"],
  imports: [FontAwesomeModule]
})
export class CardContainerComponent {

  @Input() icon: IconDefinition;
  @Input() title: string;
  @Input() subtitle: string;
  @Input() href: string;
  @Input() brandColour: string;
  protected readonly faArrowUpRightFromSquare = faArrowUpRightFromSquare;

}
