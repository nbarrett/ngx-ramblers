import { TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { ALL_PHOTOS, ContentMetadata, ContentMetadataItem, SlideInitialisation } from "../models/content-metadata.model";
import { ContentMetadataService } from "./content-metadata.service";
import { LazyLoadingMetadataService } from "./lazy-loading-metadata.service";
import { StringUtilsService } from "./string-utils.service";

describe("LazyLoadingMetadataService", () => {
  let service: LazyLoadingMetadataService;

  const slide = (image: string): ContentMetadataItem => ({image, text: image} as ContentMetadataItem);
  const album = (images: string[]): ContentMetadata => ({name: "images-home", files: images.map(slide), imageTags: []} as ContentMetadata);

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [
        LazyLoadingMetadataService,
        {provide: ContentMetadataService, useValue: {filterSlides: (imageTags: unknown, files: ContentMetadataItem[]) => files}},
        {provide: StringUtilsService, useValue: {pluraliseWithCount: (count: number, text: string) => `${count} ${text}`}}
      ]
    });
    service = TestBed.inject(LazyLoadingMetadataService);
  });

  it("keeps the slides already showing when the full album starts with the same slides", () => {
    const lazyLoadingMetadata = service.initialise(album(["a.jpg", "b.jpg"]));
    service.initialiseAvailableSlides(lazyLoadingMetadata, SlideInitialisation.COMPONENT_INIT, {}, ALL_PHOTOS, 2);
    lazyLoadingMetadata.activeSlideIndex = 1;

    service.replaceContentMetadata(lazyLoadingMetadata, album(["a.jpg", "b.jpg", "c.jpg", "d.jpg"]), {}, ALL_PHOTOS);

    expect(lazyLoadingMetadata.availableSlides.map(item => item.image)).toEqual(["a.jpg", "b.jpg", "c.jpg", "d.jpg"]);
    expect(lazyLoadingMetadata.selectedSlides.map(item => item.image)).toEqual(["a.jpg", "b.jpg"]);
    expect(lazyLoadingMetadata.activeSlideIndex).toEqual(1);
    expect(lazyLoadingMetadata.contentMetadata.files.length).toEqual(4);
  });

  it("starts again from the first slide when the full album no longer starts with the slides showing", () => {
    const lazyLoadingMetadata = service.initialise(album(["a.jpg", "b.jpg"]));
    service.initialiseAvailableSlides(lazyLoadingMetadata, SlideInitialisation.COMPONENT_INIT, {}, ALL_PHOTOS, 2);
    lazyLoadingMetadata.activeSlideIndex = 1;

    service.replaceContentMetadata(lazyLoadingMetadata, album(["z.jpg", "a.jpg", "b.jpg"]), {}, ALL_PHOTOS);

    expect(lazyLoadingMetadata.selectedSlides.map(item => item.image)).toEqual(["z.jpg"]);
    expect(lazyLoadingMetadata.activeSlideIndex).toEqual(0);
  });
});
