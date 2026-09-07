import { CdkTextareaAutosize } from "@angular/cdk/text-field";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { LoggerTestingModule } from "ngx-logger/testing";
import { vi } from "vitest";
import { EmojiTextareaComponent } from "./emoji-textarea";

describe("EmojiTextareaComponent", () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [EmojiTextareaComponent, LoggerTestingModule],
    providers: [provideRouter([]), provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
  }).compileComponents());

  it("resizes when a generated caption is written programmatically", () => {
    const resize = vi.spyOn(CdkTextareaAutosize.prototype, "resizeToFitContent");
    const fixture = TestBed.createComponent(EmojiTextareaComponent);
    fixture.componentInstance.writeValue("A generated caption\nwith several lines\nand hashtags\n#Ramblers #Walking");
    fixture.detectChanges();

    expect(resize).toHaveBeenCalled();
  });
});
