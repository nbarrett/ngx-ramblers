import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContent, PageContentColumn, PageContentRow } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { CardImageComponent } from "../card/image/card-image";
import { FALLBACK_MEDIA } from "../../../models/walk.model";
import { FragmentService } from "../../../services/fragment.service";
import { DynamicContentViewCarousel } from "./dynamic-content-view-carousel";
import { DynamicContentViewAlbum } from "./dynamic-content-view-album";
import { EventsRow } from "../events/events-row";
import { ActionButtons } from "../action-buttons/action-buttons";
import { AreaMap } from "../../../pages/area-map/area-map";
import { DynamicContentViewMap } from "./dynamic-content-view-map";
import { DynamicContentViewIndex } from "./dynamic-content-view-index";
import { YoutubeEmbed } from "../youtube-embed/youtube-embed";

@Component({
    selector: "app-dynamic-content-view-text-row",
    template: `
      @if (actions.isTextRow(row)) {
        <div [class]="actions.rowClasses(row)">
          @for (column of row?.columns; track column; let columnIndex = $index) {
            <div
              [class]="'col-sm-' + (column.columns||12)">
              @for (nestedRow of column.rows; track nestedRow; let innerRowIndex = $index) {
                @if (false) {
                  <div>{{ actions.nestedInnerRowHeading(rowIndex, innerRowIndex, nestedRow.type) }}</div>
                }
                @if (actions.isActionButtons(nestedRow)) {
                  <app-action-buttons
                    [pageContent]="{rows: column.rows}"
                    [rowIndex]="innerRowIndex"/>
                }
                @if (actions.isTextRow(nestedRow)) {
                  <app-dynamic-content-view-text-row
                    [pageContent]="pageContent"
                    [row]="nestedRow"
                    [parentRowIndex]="rowIndex"
                    [rowIndex]="innerRowIndex"
                    [contentPath]="contentPath"
                    [contentDescription]="contentDescription">
                  </app-dynamic-content-view-text-row>
                }
                @if (actions.isCarousel(nestedRow)) {
                  <app-dynamic-content-view-carousel
                    [row]="nestedRow"
                    [index]="actions.carouselOrAlbumIndex(nestedRow, {rows: column.rows})"/>
                }
                @if (actions.isIndex(nestedRow)) {
                  <app-dynamic-content-view-index [row]="nestedRow"/>
                }
                @if (actions.isAlbum(nestedRow)) {
                  <app-dynamic-content-view-album
                    [row]="nestedRow"
                    [index]="actions.carouselOrAlbumIndex(nestedRow, {rows: column.rows})"/>
                }
                @if (actions.isEvents(nestedRow)) {
                  <app-events-row [row]="nestedRow" [rowIndex]="innerRowIndex"/>
                }
                @if (actions.isAreaMap(nestedRow)) {
                  <app-area-map [row]="nestedRow" [pageContent]="{rows: column.rows}"/>
                }
                @if (actions.isMap(nestedRow)) {
                  <app-dynamic-content-view-map [row]="nestedRow" [pageContent]="pageContent"/>
                }
                @if (actions.isSharedFragment(nestedRow) && nestedRow?.fragment?.pageContentId) {
                  @for (fragmentRow of fragmentRowsFor(nestedRow); track fragmentRow; let fragmentRowIndex = $index) {
                    @if (actions.isActionButtons(fragmentRow)) {
                      <app-action-buttons
                        [pageContent]="fragmentContentFor(nestedRow)"
                        [rowIndex]="fragmentRowIndex"/>
                    }
                    @if (actions.isTextRow(fragmentRow)) {
                      <app-dynamic-content-view-text-row
                        [pageContent]="pageContent"
                        [row]="fragmentRow"
                        [rowIndex]="fragmentRowIndex"
                        [contentPath]="fragmentPathFor(nestedRow)"
                        [contentDescription]="contentDescription">
                      </app-dynamic-content-view-text-row>
                    }
                    @if (actions.isCarousel(fragmentRow)) {
                      <app-dynamic-content-view-carousel
                        [row]="fragmentRow"
                        [index]="actions.carouselOrAlbumIndex(fragmentRow, fragmentContentFor(nestedRow))"/>
                    }
                    @if (actions.isIndex(fragmentRow)) {
                      <app-dynamic-content-view-index [row]="fragmentRow"/>
                    }
                    @if (actions.isAlbum(fragmentRow)) {
                      <app-dynamic-content-view-album
                        [row]="fragmentRow"
                        [index]="actions.carouselOrAlbumIndex(fragmentRow, fragmentContentFor(nestedRow))"/>
                    }
                    @if (actions.isEvents(fragmentRow)) {
                      <app-events-row [row]="fragmentRow" [rowIndex]="fragmentRowIndex"/>
                    }
                    @if (actions.isAreaMap(fragmentRow)) {
                      <app-area-map [row]="fragmentRow" [pageContent]="fragmentContentFor(nestedRow)"/>
                    }
                  }
                }
              }
              @if (!column.rows) {
                @if (showYoutubeBeforeText(column)) {
                  <div class="youtube-embed-container">
                    <app-youtube-embed
                      [youtubeId]="column.youtubeId"
                      [title]="column.alt || 'YouTube video'"/>
                  </div>
                }
                @if (showImageBeforeText(column)) {
                  <app-card-image
                    [borderRadius]="column.imageBorderRadius"
                    [aspectRatio]="column.imageAspectRatio"
                    [alt]="column.alt"
                    unconstrainedHeight
                    [cropperPosition]="column.imageCropperPosition"
                    [imageSource]="imageSourceFor(column)">
                  </app-card-image>
                }
                @if (column.contentText) {
                  <app-markdown-editor [text]="column.contentText"
                                       [styles]="column.styles"
                                       [name]="actions.rowColumnIdentifierFor(rowIndex, columnIndex, contentPath)"
                                       [category]="contentPath"/>
                }
                @if (showYoutubeAfterText(column)) {
                  <div class="youtube-embed-container">
                    <app-youtube-embed
                      [youtubeId]="column.youtubeId"
                      [title]="column.alt || 'YouTube video'"/>
                  </div>
                }
                @if (showImageAfterText(column)) {
                  <app-card-image
                    [borderRadius]="column.imageBorderRadius"
                    [aspectRatio]="column.imageAspectRatio"
                    [alt]="column.alt"
                    unconstrainedHeight
                    [cropperPosition]="column.imageCropperPosition"
                    [imageSource]="imageSourceFor(column)">
                  </app-card-image>
                }
              }
            </div>
          }
        </div>
      }`,
    styleUrls: ["./dynamic-content.sass"],
    imports: [MarkdownEditorComponent, CardImageComponent, DynamicContentViewCarousel, DynamicContentViewIndex, DynamicContentViewAlbum, EventsRow, ActionButtons, AreaMap, DynamicContentViewMap, YoutubeEmbed]
})
export class DynamicContentViewTextRow implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("DynamicContentViewTextRow", NgxLoggerLevel.ERROR);
  siteEditService = inject(SiteEditService);
  actions = inject(PageContentActionsService);
  stringUtils = inject(StringUtilsService);
  fragmentService = inject(FragmentService);

  @Input() public row: PageContentRow;
  @Input() public rowIndex: number;
  @Input() public parentRowIndex: number;
  @Input() public contentPath: string;
  @Input() public contentDescription: string;
  @Input() public bordered: boolean;
  @Input() pageContent!: PageContent;

  ngOnInit() {
    const rowDescription = this.parentRowIndex ? this.actions.nestedInnerRowHeading(this.parentRowIndex, this.rowIndex, this.row.type) : "rowIndex:" + this.rowIndex + " type:" + this.row.type;
    this.logger.info("ngOnInit called for:", rowDescription, this.row, "containing", this.stringUtils.pluraliseWithCount(this.row?.columns.length, "column"));
    this.loadNestedFragments();
  }

  private async loadNestedFragments() {
    if (this.row?.columns) {
      for (const column of this.row.columns) {
        if (column.rows) {
          await this.fragmentService.loadFragmentsRecursivelyFromRows(column.rows);
        }
      }
    }
  }

  shouldShowImage(column: PageContentColumn): boolean {
    if (this.hasYoutubeVideo(column)) {
      return false;
    }
    const hasActualImage = !!column.imageSource;
    const showPlaceholder = column.showPlaceholderImage && !column.imageSource;
    return hasActualImage || showPlaceholder;
  }

  hasYoutubeVideo(column: PageContentColumn): boolean {
    return !!column.youtubeId;
  }

  imageSourceFor(column: PageContentColumn): string {
    if (column.imageSource) {
      return column.imageSource;
    } else if (column.showPlaceholderImage && !column.imageSource) {
      return FALLBACK_MEDIA.url;
    } else {
      return column.imageSource;
    }
  }

  showImageAfterText(column: PageContentColumn) {
    return !column.showTextAfterImage && this.shouldShowImage(column);
  }

  showImageBeforeText(column: PageContentColumn) {
    return column.showTextAfterImage && this.shouldShowImage(column);
  }

  showYoutubeAfterText(column: PageContentColumn) {
    return !column.showTextAfterImage && this.hasYoutubeVideo(column);
  }

  showYoutubeBeforeText(column: PageContentColumn) {
    return column.showTextAfterImage && this.hasYoutubeVideo(column);
  }

  fragmentContentFor(row: PageContentRow): PageContent {
    return row?.fragment?.pageContentId ? this.fragmentService.contentById(row.fragment.pageContentId) : null;
  }

  fragmentPathFor(row: PageContentRow): string {
    return this.fragmentService.contentById(row?.fragment?.pageContentId)?.path;
  }

  fragmentRowsFor(row: PageContentRow): PageContentRow[] {
    const content = this.fragmentContentFor(row);
    return content?.rows || [];
  }
}
