import { Component, inject, Input } from "@angular/core";
import { DatePipe, TitleCasePipe } from "@angular/common";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faFacebook, faInstagram } from "@fortawesome/free-brands-svg-icons";
import { faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { SocialNetwork, SocialPublication } from "../../models/social-publish.model";
import { SocialPublishService } from "../../services/social/social-publish.service";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";

@Component({
  selector: "app-social-post-links",
  styles: [`
    :host
      display: contents

    .social-post-links
      display: flex
      flex-wrap: wrap
      align-items: center
      gap: 8px

    .social-post-links-label
      font-size: 0.9rem
      font-weight: 600
      color: var(--rsm-muted, rgb(110, 112, 115))

    .social-post-link
      display: inline-flex
      align-items: center
      gap: 8px
      min-height: 36px
      padding: 0 14px
      border: 1px solid rgba(217, 156, 10, 0.45)
      border-radius: 999px
      background: linear-gradient(135deg, #fff8e6 0%, #fff 100%)
      color: var(--rsm-text, rgb(64, 65, 65))
      font-weight: 700
      font-size: 0.9rem
      line-height: 1.1
      text-decoration: none
      transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease

    .social-post-link:hover,
    .social-post-link:focus-visible
      border-color: #d99c0a
      background: linear-gradient(135deg, #f9b104 0%, #d99c0a 100%)
      box-shadow: 0 2px 8px rgba(217, 156, 10, 0.28)
      color: #1a1a1a
      text-decoration: none

    .social-post-link-icon
      font-size: 1.05rem


    .social-post-link:hover .social-post-link-icon,
    .social-post-link:focus-visible .social-post-link-icon
      color: #1a1a1a

    .social-post-link-date
      font-weight: 500
      font-size: 0.8rem
      color: var(--rsm-muted, rgb(110, 112, 115))

    .social-post-link:hover .social-post-link-date,
    .social-post-link:focus-visible .social-post-link-date
      color: #1a1a1a

    .social-post-link-open
      margin-left: auto
      font-size: 0.85rem

    @media (max-width: 767.98px)
      .social-post-links
        width: 100%
        gap: 6px

      .social-post-links-label
        width: 100%

      .social-post-link
        flex: 1 1 100%
  `],
  template: `
    @if (publications.length > 0) {
      <div class="social-post-links">
        <span class="social-post-links-label">Also posted on</span>
        @for (publication of publications; track publication.network) {
          <a class="social-post-link" [href]="publication.permalink" target="_blank" rel="noopener"
             [attr.aria-label]="'View this album on ' + (publication.network | titlecase)">
            <fa-icon class="social-post-link-icon"
                     [class.icon-facebook]="publication.network === SocialNetwork.FACEBOOK"
                     [class.icon-instagram]="publication.network === SocialNetwork.INSTAGRAM"
                     [icon]="publication.network === SocialNetwork.FACEBOOK ? faFacebook : faInstagram"/>
            <span>{{ publication.network | titlecase }}</span>
            @if (publication.publishedAt) {
              <span class="social-post-link-date">{{ publication.publishedAt | date: "d MMM yyyy" }}</span>
            }
            <fa-icon class="social-post-link-open" [icon]="faArrowUpRightFromSquare"/>
          </a>
        }
      </div>
    }`,
  imports: [FontAwesomeModule, TitleCasePipe, DatePipe]
})
export class SocialPostLinksComponent {

  protected publications: SocialPublication[] = [];
  protected readonly SocialNetwork = SocialNetwork;
  protected readonly faFacebook = faFacebook;
  protected readonly faInstagram = faInstagram;
  protected readonly faArrowUpRightFromSquare = faArrowUpRightFromSquare;
  private socialPublishService = inject(SocialPublishService);
  private logger: Logger = inject(LoggerFactory).createLogger("SocialPostLinksComponent", NgxLoggerLevel.ERROR);

  @Input("albumName") set albumNameValue(albumName: string) {
    this.publications = [];
    if (albumName) {
      this.socialPublishService.publicationsForAlbum(albumName)
        .then(publications => {
          this.publications = (publications || []).filter(publication => publication.permalink);
          this.logger.info("albumName:", albumName, "publications with links:", this.publications.length);
        })
        .catch(error => this.logger.error("could not load publications for album:", albumName, error));
    }
  }
}
