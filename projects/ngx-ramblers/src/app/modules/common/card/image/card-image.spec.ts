import { ComponentFixture, TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { FileUtilsService } from "../../../../file-utils.service";
import { MediaQueryService } from "../../../../services/committee/media-query.service";
import { UrlService } from "../../../../services/url.service";
import { CardImageComponent } from "./card-image";

describe("CardImageComponent focal point frame", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CardImageComponent, LoggerTestingModule],
      providers: [
        {provide: UrlService, useValue: {imageSource: (url: string) => url, routerLinkUrl: () => null, isRemoteUrl: () => false}},
        {provide: FileUtilsService, useValue: {altFrom: (alt: string, _source: string) => alt}},
        {provide: MediaQueryService, useValue: {}}
      ]
    }).compileComponents();
  });

  function createComponent(): ComponentFixture<CardImageComponent> {
    const fixture = TestBed.createComponent(CardImageComponent);
    fixture.componentInstance.imageSource = "https://example.com/lunch.jpg";
    fixture.componentInstance.height = 250;
    fixture.componentInstance.focalPoint = {x: 50, y: 50, zoom: 1.4};
    fixture.detectChanges();
    return fixture;
  }

  it("keeps zoomed images inside a fixed-height overflow-hidden frame", () => {
    const fixture = createComponent();
    const wrapper = fixture.nativeElement.querySelector(".card-image-focal-wrapper") as HTMLElement;
    const image = fixture.nativeElement.querySelector("img.card-img-focal") as HTMLElement;
    expect(wrapper).toBeTruthy();
    expect(wrapper.style.overflow).toBe("hidden");
    expect(wrapper.style.height).toBe("250px");
    expect(image.style.transform).toBe("scale(1.4)");
    expect(image.style.transformOrigin).toBe("50% 50%");
  });
});
