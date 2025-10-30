import { Component, EventEmitter, Input, Output } from "@angular/core";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faImage } from "@fortawesome/free-solid-svg-icons";

@Component({
  selector: "app-image-actions-dropdown",
  template: `
    <div class="btn-group" [class.w-100]="fullWidth" dropdown>
      <button aria-controls="dropdown-image-actions" class="dropdown-toggle badge-button border-0" [class.w-100]="fullWidth" dropdownToggle type="button">
        <fa-icon [icon]="faImage"></fa-icon>
        <span class="ms-2">Image Actions</span>
      </button>
      <ul *dropdownMenu class="dropdown-menu" [class.w-100]="fullWidth" id="dropdown-image-actions" role="menu">
        @if (!hasImage) {
          <li role="menuitem">
            <a (click)="edit.emit()" class="dropdown-item">Add image</a>
          </li>
        }
        @if (hasImage) {
          <li role="menuitem">
            <a (click)="edit.emit()" class="dropdown-item">Edit image</a>
          </li>
          <li role="menuitem">
            <a (click)="replace.emit()" class="dropdown-item">Replace image</a>
          </li>
          <li role="menuitem">
            <a (click)="remove.emit()" class="dropdown-item text-danger">Remove image</a>
          </li>
        }
      </ul>
    </div>
  `,
    imports: [BsDropdownDirective, BsDropdownToggleDirective, BsDropdownMenuDirective, FontAwesomeModule]
})
export class ImageActionsDropdownComponent {
  @Input() fullWidth = false;
  @Input() hasImage = false;
  @Output() edit = new EventEmitter<void>();
  @Output() replace = new EventEmitter<void>();
  @Output() remove = new EventEmitter<void>();
  faImage = faImage;
}
