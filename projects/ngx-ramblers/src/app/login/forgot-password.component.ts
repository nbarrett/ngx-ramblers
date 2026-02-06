import { Component, inject, OnInit } from "@angular/core";
import { BsModalService } from "ngx-bootstrap/modal";
import { AuthService } from "../auth/auth.service";
import { ForgotPasswordModalComponent } from "../pages/login/forgot-password-modal/forgot-password-modal.component";

@Component({
    selector: "app-forgot-password",
    template: ""
})

export class ForgotPasswordComponent implements OnInit {

  private authService = inject(AuthService);
  private modalService = inject(BsModalService);

  ngOnInit() {
    this.authService.logout();
    this.modalService.show(ForgotPasswordModalComponent, {
      animated: false,
      backdrop: "static",
      keyboard: false
    });
  }

}
