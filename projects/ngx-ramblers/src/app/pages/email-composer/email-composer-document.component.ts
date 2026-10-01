import {Component, inject, Input} from "@angular/core";
import {FontAwesomeModule} from "@fortawesome/angular-fontawesome";
import {faTrash} from "@fortawesome/free-solid-svg-icons";
import {TooltipDirective} from "ngx-bootstrap/tooltip";
import {ComposerFragment, CommitteeFileEmailInclude} from "../../models/email-composer.model";
import {EmailComposerDocumentsService} from "../../services/email-composer/email-composer-documents.service";
import {CommitteeDisplayService} from "../committee/committee-display.service";
import {TiptapMarkdownEditor} from "../../modules/common/tiptap-editor/tiptap-markdown-editor";
import {SiteLinkInputComponent} from "../../modules/common/site-link-input/site-link-input";
import {CommitteeFileMultiSelectComponent} from "../../modules/common/committee-file-multi-select/committee-file-multi-select";

@Component({
  selector: "app-email-composer-document",
  imports: [FontAwesomeModule, TooltipDirective, TiptapMarkdownEditor, SiteLinkInputComponent, CommitteeFileMultiSelectComponent],
  template: `
                    <div class="fragment-committee-file">
                      @let files = documents.committeeFilesFor(fragment);
                      @if (documents.committeeFileFragmentHasMarkdown(fragment)) {
                        <div class="mb-3">
                          <p class="form-label small mb-1">Include in the email</p>
                          <div class="form-check form-check-inline">
                            <input class="form-check-input" type="radio"
                                   [name]="'committee-file-include-' + fragment.id"
                                   [id]="'committee-file-include-link-' + fragment.id"
                                   [checked]="documents.committeeFileInclude(fragment) === CommitteeFileEmailInclude.LINK"
                                   (change)="documents.setCommitteeFileInclude(fragment, CommitteeFileEmailInclude.LINK)">
                            <label class="form-check-label" [for]="'committee-file-include-link-' + fragment.id">Link</label>
                          </div>
                          <div class="form-check form-check-inline">
                            <input class="form-check-input" type="radio"
                                   [name]="'committee-file-include-' + fragment.id"
                                   [id]="'committee-file-include-content-' + fragment.id"
                                   [checked]="documents.committeeFileInclude(fragment) === CommitteeFileEmailInclude.CONTENT"
                                   (change)="documents.setCommitteeFileInclude(fragment, CommitteeFileEmailInclude.CONTENT)">
                            <label class="form-check-label" [for]="'committee-file-include-content-' + fragment.id">Content</label>
                          </div>
                          <div class="form-check form-check-inline">
                            <input class="form-check-input" type="radio"
                                   [name]="'committee-file-include-' + fragment.id"
                                   [id]="'committee-file-include-both-' + fragment.id"
                                   [checked]="documents.committeeFileInclude(fragment) === CommitteeFileEmailInclude.BOTH"
                                   (change)="documents.setCommitteeFileInclude(fragment, CommitteeFileEmailInclude.BOTH)">
                            <label class="form-check-label" [for]="'committee-file-include-both-' + fragment.id">Both</label>
                          </div>
                        </div>
                      }
                      @if (files.length > 0) {
                        <ul class="list-unstyled mb-2">
                          @for (file of files; track file.id) {
                            <li class="py-1">
                              <div class="d-flex align-items-center justify-content-between gap-2">
                                <div>
                                  <strong>{{ file.fileType }}</strong>
                                  @if (documents.committeeFileDateLabel(file)) {
                                    <span class="text-muted"> · {{ documents.committeeFileDateLabel(file) }}</span>
                                  }
                                  @if (documents.committeeFileShowsDownloadLink(fragment, file)) {
                                    <a class="ms-2" [href]="committeeDisplayService.fileUrl(file, documents.committeeFileLinkPath(file))"
                                       target="_blank">{{ documents.committeeFileDownloadFilename(file) }}</a>
                                  }
                                </div>
                                <button type="button" class="btn btn-danger btn-icon flex-shrink-0"
                                        tooltip="Remove this file" container="body"
                                        (click)="documents.removeCommitteeFile(fragment, file.id)">
                                  <fa-icon [icon]="faTrash"/>
                                </button>
                              </div>
                              @if (documents.committeeFileShowsContent(fragment, file)) {
                                <div class="mt-3">
                                  <app-tiptap-markdown-editor
                                    [value]="documents.committeeFileMarkdownForEmail(file)"
                                    [editable]="false"/>
                                </div>
                              }
                            </li>
                          }
                        </ul>
                      }
                      @let unresolved = documents.unresolvedCommitteeFileIdsFor(fragment);
                      @if (unresolved.length > 0) {
                        <div class="text-danger small mb-2">
                          Couldn't find committee file{{ unresolved.length === 1 ? '' : 's' }}:
                          @for (missingId of unresolved; track missingId) { <code class="ms-1">{{ missingId }}</code> }
                        </div>
                      }
                      <div class="row g-2 align-items-end">
                        <div class="col-md-12">
                          <label class="form-label small mb-1">Filter by page URL <span class="text-muted">(optional - narrows the dropdown to files on that page)</span>:</label>
                          <app-site-link-input cssClass="form-control form-control-sm"
                                               placeholder="Pick a site page to filter committee files"
                                               [value]="documents.committeeFileUrlInput"
                                               (valueChange)="documents.onCommitteeFileUrlChanged($event)"/>
                        </div>
                      </div>
                      @if (documents.committeeFileUrlError) {
                        <div class="text-danger small mt-1">{{ documents.committeeFileUrlError }}</div>
                      }
                      <div class="row g-2 align-items-end mt-2">
                        <div class="col-md-12">
                          <label class="form-label small mb-1">Choose committee files:</label>
                          <app-committee-file-multi-select placeholder="Search committee files..."
                                                           [value]="fragment.committeeFileIds ?? []"
                                                           [allowedFileIds]="documents.committeeFileUrlAllowedIds"
                                                           (valueChange)="documents.onCommitteeFileIdsChanged(fragment, $event)"
                                                           (filesLoaded)="documents.onPickerFilesLoaded($event)"/>
                        </div>
                      </div>
                      @if (files.length === 0 && unresolved.length === 0) {
                        <div class="text-muted small mt-2">Pick one or more committee files from the dropdown, optionally narrowing them by typing a page URL above.</div>
                      }
                    </div>
  `
})
export class EmailComposerDocumentComponent {
  @Input({required: true}) fragment!: ComposerFragment;
  protected documents = inject(EmailComposerDocumentsService);
  protected committeeDisplayService = inject(CommitteeDisplayService);
  protected readonly CommitteeFileEmailInclude = CommitteeFileEmailInclude;
  protected readonly faTrash = faTrash;
}
