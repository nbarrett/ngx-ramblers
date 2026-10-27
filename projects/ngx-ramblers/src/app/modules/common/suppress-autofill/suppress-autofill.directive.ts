import {Directive, ElementRef, inject, OnInit} from "@angular/core";

@Directive({
  selector: "input[appSuppressAutofill], textarea[appSuppressAutofill]",
  host: {
    autocomplete: "one-time-code",
    autocapitalize: "none",
    autocorrect: "off",
    "attr.data-lpignore": "true",
    "attr.data-1p-ignore": "",
    "attr.data-bwignore": "",
    "attr.data-form-type": "other",
    "(focus)": "unlock()"
  }
})
export class SuppressAutofillDirective implements OnInit {
  private element = inject(ElementRef<HTMLInputElement | HTMLTextAreaElement>);

  ngOnInit(): void {
    this.element.nativeElement.setAttribute("readonly", "readonly");
  }

  protected unlock(): void {
    this.element.nativeElement.removeAttribute("readonly");
  }
}
