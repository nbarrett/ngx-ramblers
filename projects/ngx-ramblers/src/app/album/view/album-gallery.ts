import { Component, inject, Input, OnInit } from "@angular/core";
import { Gallery, GalleryItem, ImageItem } from "ng-gallery";
import { RootFolder } from "../../models/system.model";
import { ContentMetadata } from "../../models/content-metadata.model";
import { PageService } from "../../services/page.service";
import { ContentMetadataService } from "../../services/content-metadata.service";
import { UrlService } from "../../services/url.service";
import { LoggerFactory } from "../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import take from "lodash-es/take";
import { DateUtilsService } from "../../services/date-utils.service";
import { faImages, faSearch } from "@fortawesome/free-solid-svg-icons";
import { AlbumData, AlbumView } from "../../models/content-text.model";
import { coerceBooleanProperty } from "@angular/cdk/coercion";

@Component({
  selector: "app-album-gallery",
  template: `
    <gallery gallerize [items]="images"
             [imageSize]="'cover'"
             thumbPosition="left"
             [thumbImageSize]="'cover'" loadingStrategy="lazy" [dotsPosition]="'bottom'">
      <ng-container *galleryImageDef="let item; let active = active">
        <div *ngIf="active" class="item-panel-heading">
          <div>{{item?.alt}}</div>
        </div>
      </ng-container>
    </gallery>
  `
})
export class AlbumGalleryComponent implements OnInit {
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("AlbumGalleryComponent", NgxLoggerLevel.INFO);

  public preview: boolean;

  @Input("preview") set previewValue(value: boolean) {
    this.preview = coerceBooleanProperty(value);
    this.logger.info("preview:", this.preview);
  }

  @Input()
  public index: number;
  @Input()
  album: AlbumData;
  public gallery: Gallery = inject(Gallery);
  public pageService: PageService = inject(PageService);
  public dateUtils: DateUtilsService = inject(DateUtilsService);
  public contentMetadataService: ContentMetadataService = inject(ContentMetadataService);
  private urlService: UrlService = inject(UrlService);
  images: GalleryItem[];
  public contentMetadata: ContentMetadata;
  public galleryId: string;
  public albumView: AlbumView = AlbumView.GRID;
  protected readonly faImages = faImages;
  protected readonly faSearch = faSearch;

  protected readonly AlbumView = AlbumView;

  ngOnInit() {
    this.galleryId = "myLightbox";
    this.logger.info("ngOnInit:album:", this.album);
    if (this.album.albumView) {
      this.albumView = this.album.albumView;
    }
    this.contentMetadataService.items(RootFolder.carousels, this.album.name)
      .then(contentMetadata => {
        this.contentMetadata = contentMetadata;
        const images = this?.contentMetadata?.files.map(file => new ImageItem({
          alt: file.text,
          src: this.urlService.imageSourceFor(file.image, contentMetadata),
          thumb: this.urlService.imageSourceFor(file.image, contentMetadata)
        }));
        this.images = this.preview ? take(images, 2) : images;
        this.logger.info("initialised with", this?.contentMetadata?.files?.length, "slides in total", "loading images:", this.images);
        const galleryRef = this.gallery.ref();
        galleryRef.load(this.images);
      });
  }


}
