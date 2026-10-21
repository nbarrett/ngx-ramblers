import { Component, inject, OnInit } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleExclamation, faRefresh } from "@fortawesome/free-solid-svg-icons";
import { CloudflareWorkerInventory } from "../../../models/cloudflare-email-routing.model";
import { extractErrorMessage } from "../../../functions/strings";
import { PageComponent } from "../../../page/page.component";
import { CloudflareWorkersList } from "../../../modules/common/cloudflare-workers/cloudflare-workers-list";
import { CloudflareEmailRoutingService } from "../../../services/cloudflare/cloudflare-email-routing.service";

@Component({
  selector: "app-cloudflare-workers",
  imports: [PageComponent, CloudflareWorkersList, FontAwesomeModule],
  template: `
    <app-page>
      <div class="thumbnail-heading-frame">
        <div class="thumbnail-heading">Cloudflare Workers</div>
        <p>Workers in the configured Cloudflare account, with email routing references across every zone accessible to its API token. Disabled rules also count as references.</p>
        <p>No email routing references does not mean a worker is unused: it may serve HTTP requests, scheduled tasks or other workers. Check these in Cloudflare before removing it.</p>
        <button class="btn btn-primary mb-3" type="button" [disabled]="loading" (click)="refresh()">
          <fa-icon [icon]="faRefresh" class="me-2"/>{{ loading ? "Checking workers…" : "Refresh workers" }}
        </button>
        @if (error) {
          <div class="alert alert-danger d-flex align-items-start" role="alert">
            <fa-icon [icon]="faCircleExclamation" class="me-2"/>
            <div><strong>Unable to check workers</strong><div>{{ error }}</div></div>
          </div>
        }
        @if (inventory) {
          <p>{{ inventory.workers.length }} workers; {{ inventory.zones.length }} accessible zones checked.</p>
          @if (!inventory.zones.length) {
            <div class="alert alert-warning d-flex align-items-start" role="alert">
              <fa-icon [icon]="faCircleExclamation" class="me-2"/>
              <div><strong>No accessible zones</strong><div>Worker references cannot be confirmed. Check the API token's zone permissions.</div></div>
            </div>
          }
          @for (zone of inventory.zones; track zone.zone) {
            @if (zone.errors.length) {
              <div class="alert alert-warning d-flex align-items-start" role="alert">
                <fa-icon [icon]="faCircleExclamation" class="me-2"/>
                <div><strong>Incomplete check: {{ zone.zone }}</strong><div>{{ zone.errors.join("; ") }}</div></div>
              </div>
            }
          }
          <app-cloudflare-workers-list [inventory]="true" [rows]="inventory.workers" [accountId]="inventory.accountId"
            [allowDelete]="true" [deleteConfirmPending]="workerDeleteConfirmPending" [deletePending]="workerDeletePending"
            (requestDelete)="requestDeleteWorker($event)" (cancelDelete)="cancelDeleteWorker()"
            (deleteWorker)="deleteWorker($event)"/>
        }
      </div>
    </app-page>
  `
})
export class CloudflareWorkersComponent implements OnInit {
  private service = inject(CloudflareEmailRoutingService);
  inventory: CloudflareWorkerInventory = null;
  loading = false;
  error: string = null;
  workerDeleteConfirmPending: string = null;
  workerDeletePending: string = null;
  protected readonly faRefresh = faRefresh;
  protected readonly faCircleExclamation = faCircleExclamation;

  ngOnInit(): void {
    this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading = true;
    this.error = null;
    this.inventory = null;
    try {
      this.inventory = await this.service.workerInventory();
    } catch (error) {
      this.error = extractErrorMessage(error);
    } finally {
      this.loading = false;
    }
  }

  requestDeleteWorker(scriptName: string): void {
    this.workerDeleteConfirmPending = scriptName;
  }

  cancelDeleteWorker(): void {
    this.workerDeleteConfirmPending = null;
  }

  async deleteWorker(scriptName: string): Promise<void> {
    this.workerDeleteConfirmPending = null;
    this.workerDeletePending = scriptName;
    this.error = null;
    try {
      await this.service.deleteWorker(scriptName);
      await this.refresh();
    } catch (error) {
      this.error = extractErrorMessage(error);
    } finally {
      this.workerDeletePending = null;
    }
  }
}
