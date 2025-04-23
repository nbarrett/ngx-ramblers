import { Component, effect, inject, signal } from "@angular/core";
import { DuplicateContentService } from "./duplicate-content-service";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { PageComponent } from "../../../page/page.component";
import { DuplicatePageContent, EM_DASH_WITH_SPACES } from "../../../models/content-text.model";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { ALERT_SUCCESS, AlertTarget } from "../../../models/alert-target.model";
import { DynamicContentViewComponent } from "../../../modules/common/dynamic-content/dynamic-content-view";
import { StringUtilsService } from "../../../services/string-utils.service";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faWarning } from "@fortawesome/free-solid-svg-icons/faWarning";
import { FormsModule } from "@angular/forms";
import { UiSwitchModule } from "ngx-ui-switch";
import { PageContentService } from "../../../services/page-content.service";
import { TypeaheadDirective } from "ngx-bootstrap/typeahead";
import { AlertComponent } from "ngx-bootstrap/alert";

@Component({
  selector: "app-duplicate-page-content-navigator",
  template: `
    <app-page autoTitle>
      <app-markdown-editor category="admin" name="duplicate-page-content-navigator"/>
      @if (duplicates().length > 0) {
        <section>
          @for (duplicate of duplicates(); track duplicate.path) {
            <h3>
              <fa-icon class="fa-icon-sunrise mr-1" [icon]="faWarning"/>
              Duplicate {{ duplicates().indexOf(duplicate) + 1 }}
              of {{ duplicates().length }}:
              Path <a class="rams-text-decoration-pink"
                      [href]="duplicate.path">{{ duplicate.path }}</a> {{ EM_DASH_WITH_SPACES }}{{ stringUtils.pluraliseWithCount(duplicate.duplicatePageContents.length, "duplicate") }}
            </h3>
            @for (duplicatePageContent of duplicate.duplicatePageContents; track duplicatePageContent.id) {
              <div class="dotted-content">


                <div class="row align-items-start d-flex">
                  <div class="col-auto">
                    <button class="btn btn-primary mb-3" (click)="deleteDuplicate(duplicatePageContent.id)">
                      Delete page content
                      duplicate {{ duplicate.duplicatePageContents.indexOf(duplicatePageContent) + 1 }}
                      of {{ duplicate.duplicatePageContents.length }}
                    </button>
                  </div>
                  <div class="col-auto flex-grow-1">
                    <form>
                      <input id="move-or-copy-to-path"
                             [typeahead]="pageContentService.siteLinks"
                             name="destinationPath"
                             autocomplete="nope"
                             [typeaheadMinLength]="0"
                             [(ngModel)]="duplicatePageContent.path"
                             type="text" class="form-control">
                    </form>
                  </div>
                  <div class="col-auto">
                    <button class="btn btn-primary mb-3"
                            (click)="changePath(duplicatePageContent.id, duplicatePageContent.path)">
                      Change Path {{ duplicate.duplicatePageContents.indexOf(duplicatePageContent) + 1 }}
                      of {{ duplicate.duplicatePageContents.length }}
                    </button>
                  </div>
                </div>
                <app-dynamic-content-view [pageContent]="duplicatePageContent"
                                          [notify]="notify"
                                          [contentPath]="duplicatePageContent.path"
                                          [contentDescription]="duplicatePageContent.path"/>
              </div>
            }
          }
        </section>
      } @else {
        <alert type="success" class="flex-grow-1">
          <fa-icon [icon]="ALERT_SUCCESS.icon"/>
          <strong class="ml-2">No duplicate page content found</strong>
          <div class="ml-2">Looks like your page content is all in order for the site!</div>
        </alert>
      }
    </app-page>
  `,
  imports: [
    MarkdownEditorComponent,
    PageComponent,
    DynamicContentViewComponent,
    FontAwesomeModule,
    FormsModule,
    UiSwitchModule,
    TypeaheadDirective,
    AlertComponent
  ]
})
export class DuplicatePageContentNavigatorComponent {

  protected pageContentService = inject(PageContentService);
  private notifierService: NotifierService = inject(NotifierService);
  public notifyTarget: AlertTarget = {};
  public notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);
  private duplicateContentService = inject(DuplicateContentService);
  public stringUtils: StringUtilsService = inject(StringUtilsService);
  protected readonly EM_DASH_WITH_SPACES = EM_DASH_WITH_SPACES;
  protected readonly faWarning = faWarning;

  constructor() {
    effect(async () => {
      this.duplicates.set(await this.duplicateContentService.findDuplicates());
    });
  }

  duplicates = signal<DuplicatePageContent[]>([]);


  async deleteDuplicate(contentPathId: string): Promise<void> {
    this.duplicateContentService.deleteDuplicate(contentPathId);
    this.duplicates.set(await this.duplicateContentService.findDuplicates());
  }

  async changePath(contentPathId: string, changedPath: string): Promise<void> {
    this.duplicateContentService.changePath(contentPathId, changedPath);
    this.duplicates.set(await this.duplicateContentService.findDuplicates());
  }

  protected readonly ALERT_SUCCESS = ALERT_SUCCESS;
}
