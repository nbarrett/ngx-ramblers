import { Component, OnInit } from "@angular/core";

@Component({
    selector: "app-card-container",
    template: `
        <div class="card mb-3 card-fixed-height">
            <div class="card-body p-3">
                <ng-content/>
            </div>
        </div>
    `,
    styleUrls: ["./card-container.component.sass"]
})
export class CardContainerComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
  }

}
