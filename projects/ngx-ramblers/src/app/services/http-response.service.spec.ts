import { TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";

import { HttpResponseService } from "./http-response.service";

describe("HttpResponseService", () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [LoggerTestingModule]
  }));

  it("if response has a data object then return data", () => {
    const service: HttpResponseService = TestBed.inject(HttpResponseService);
    const data = {data: "hello"};
    expect(service.returnResponse(data)).toBe("hello");
  });

  it("if response doesnt have a data object then nothing", () => {
    const service: HttpResponseService = TestBed.inject(HttpResponseService);
    const data = {someObject: "hello"};
    expect(service.returnResponse(data)).toBeUndefined();
  });
});
