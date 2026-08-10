import { CdkTextareaAutosize } from "@angular/cdk/text-field";
import { TestBed } from "@angular/core/testing";
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

  it("keeps emoji shortcode suggestions and selection", () => {
    const fixture = TestBed.createComponent(EmojiTextareaComponent);
    fixture.detectChanges();
    const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector("textarea");
    textarea.value = ":sun";
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    textarea.dispatchEvent(new Event("input", {bubbles: true}));
    fixture.detectChanges();

    expect(document.querySelector('[role="listbox"]')).not.toBeNull();

    textarea.dispatchEvent(new KeyboardEvent("keydown", {key: "Enter", bubbles: true}));
    fixture.detectChanges();

    expect(textarea.value).not.toContain(":sun");
    expect(textarea.value.trim().length).toBeGreaterThan(0);
  });
});
