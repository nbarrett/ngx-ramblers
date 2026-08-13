import { CdkTextareaAutosize } from "@angular/cdk/text-field";
import { TestBed } from "@angular/core/testing";
import { vi } from "vitest";
import { EmojiTextareaComponent } from "./emoji-textarea";

describe("EmojiTextareaComponent", () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [EmojiTextareaComponent]
  }).compileComponents());

  it("resizes when a generated caption is written programmatically", () => {
    const resize = vi.spyOn(CdkTextareaAutosize.prototype, "resizeToFitContent");
    const fixture = TestBed.createComponent(EmojiTextareaComponent);
    fixture.componentInstance.writeValue("A generated caption\nwith several lines\nand hashtags\n#Ramblers #Walking");
    fixture.detectChanges();

    expect(resize).toHaveBeenCalled();
  });
});
