import { ChangeDetectionStrategy, Component, inject, OnInit, ViewChild } from "@angular/core";
import { faMeetup } from "@fortawesome/free-brands-svg-icons";
import { first } from "es-toolkit/compat";
import { range } from "es-toolkit";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { NgxLoggerLevel } from "ngx-logger";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { AlertTarget } from "../../../models/alert-target.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { ContentText, ContentTextCategory, View } from "../../../models/content-text.model";
import { MeetupConfig } from "../../../models/meetup-config.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { ContentTextService } from "../../../services/content-text.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { UrlService } from "../../../services/url.service";
import { MeetupService } from "../../../services/meetup.service";
import { PageComponent } from "../../../page/page.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { MarkdownComponent } from "ngx-markdown";
import {
  WalkMeetupConfigParametersComponent
} from "../walk-meetup-config-parameters/walk-meetup-config-parameters.component";

@Component({
    selector: "app-walk-meetup-settings",
    templateUrl: "./walk-meetup-settings.component.html",
    styleUrls: ["./walk-meetup-settings.component.sass"],
    changeDetection: ChangeDetectionStrategy.Default,
    imports: [PageComponent, FontAwesomeModule, TabsetComponent, TabDirective, FormsModule, MarkdownEditorComponent, MarkdownComponent, WalkMeetupConfigParametersComponent]
})
export class WalkMeetupSettingsComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkMeetupSettingsComponent", NgxLoggerLevel.ERROR);
  private urlService = inject(UrlService);
  private contentTextService = inject(ContentTextService);
  private meetupService = inject(MeetupService);
  private broadcastService = inject<BroadcastService<ContentText>>(BroadcastService);
  protected notifierService = inject(NotifierService);
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public contentTextItems: ContentText[] = [];
  @ViewChild("tabs", {static: true}) tabs: TabsetComponent;
  public selectedContent: ContentText;
  addNew: boolean;
  public config: MeetupConfig;
  public publishStatuses: string[] = [];
  private guestLimits: number[];
  faMeetup = faMeetup;
  public view: View = View.VIEW;

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.publishStatuses = this.meetupService.publishStatuses();
    this.guestLimits = range(1, 11);
    this.meetupService.queryConfig().then(config => this.config = config);
    this.contentTextService.filterByCategory(ContentTextCategory.MEETUP_DESCRIPTION_PREFIX).then(contentTextItems => {
      this.logger.debug("forCategory", ContentTextCategory.MEETUP_DESCRIPTION_PREFIX + ":", contentTextItems);
      this.contentTextItems = contentTextItems;
      this.onChange(first(this.contentTextItems));
    });
    this.broadcastService.on(NamedEventType.MARKDOWN_CONTENT_SYNCED, (event: NamedEvent<MarkdownEditorComponent>) => this.replaceContent(event.data.content));
    this.broadcastService.on(NamedEventType.MARKDOWN_CONTENT_DELETED, (event: NamedEvent<ContentText>) => this.removeContent(event.data));
  }

  activeTabIs(tab: number) {
    return this.tabs.tabs[tab].active;
  }

  backToWalksAdmin() {
    this.urlService.navigateTo(["walks", "admin"]);
  }

  private replaceContent(contentText: ContentText) {
    if (contentText.category === ContentTextCategory.MEETUP_DESCRIPTION_PREFIX) {
      this.logger.debug("Received updated content", contentText);
      const existingContent: ContentText = this.contentTextItems.find(item => !item.name || (item.name === contentText.name));
      if (existingContent) {
        this.contentTextItems[(this.contentTextItems.indexOf(existingContent))] = contentText;
        this.onChange(contentText);
      } else {
        this.contentTextItems.push(contentText);
        this.onChange(contentText);
      }
    }
  }

  private removeContent(contentText: ContentText) {
    if (contentText.category === ContentTextCategory.MEETUP_DESCRIPTION_PREFIX) {
      this.logger.debug("Received deleted content", contentText);
      this.contentTextItems = this.contentTextItems.filter(item => item.id !== contentText.id);
    }
  }

  addNewContent() {
    this.addNew = true;
    const newContent = {category: ContentTextCategory.MEETUP_DESCRIPTION_PREFIX, text: "Replace with text that will be used as a prefix for the walk description", name: "Enter name of Content"};
    this.logger.debug("adding new content", newContent);
    this.selectedContent = newContent;
    this.contentTextItems.push(newContent);
  }

  onChange(content: ContentText) {
    this.logger.debug("selected content text:", content);
    this.selectedContent = content;
  }

  changeGuestLimit(content: any) {
    this.logger.debug("changeGuestLimit:change to", content);
    this.config.guestLimit = content;
  }

  matching(content: ContentText, selectedContent: ContentText) {
    return content && selectedContent && content.name === selectedContent.name;
  }

  save() {
    this.meetupService.saveConfig(this.notify, this.config);
  }

  protected readonly View = View;
}
