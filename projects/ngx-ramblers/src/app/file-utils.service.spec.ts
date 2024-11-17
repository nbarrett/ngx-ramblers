import { provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { LoggerTestingModule } from "ngx-logger/testing";

import { FileUtilsService } from "./file-utils.service";
import { SearchFilterPipe } from "./pipes/search-filter.pipe";
import { ContentMetadataService } from "./services/content-metadata.service";
import { FullNamePipe } from "./pipes/full-name.pipe";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";

describe("FileUtilsService", () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [LoggerTestingModule,
        RouterTestingModule],
    providers: [
        ContentMetadataService, SearchFilterPipe, FullNamePipe,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
    ]
}));

  it("fileExtensionIs should return true when matched", () => {
    const service: FileUtilsService = TestBed.inject(FileUtilsService);
    expect(service.fileExtensionIs("nick.doc", ["doc"])).toBe(true);
  });

  it("fileExtensionIs should return false when matched", () => {
    const service: FileUtilsService = TestBed.inject(FileUtilsService);
    expect(service.fileExtensionIs("nick.txt", ["doc"])).toBe(false);
  });
});
