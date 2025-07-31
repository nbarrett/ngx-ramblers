import { TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { EventsMigrationService } from "./migration/events-migration.service";
import { HttpClientTestingModule } from "@angular/common/http/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { ValueOrDefaultPipe } from "../pipes/value-or-default.pipe";
import { SearchFilterPipe } from "../pipes/search-filter.pipe";
import { AuditDeltaChangedItemsPipePipe } from "../pipes/audit-delta-changed-items.pipe";
import { DisplayDatePipe } from "../pipes/display-date.pipe";

describe("EventsMigrationService", () => {

  beforeEach(() => TestBed.configureTestingModule({
    imports: [LoggerTestingModule, HttpClientTestingModule, RouterTestingModule],
    providers: [ValueOrDefaultPipe, SearchFilterPipe, AuditDeltaChangedItemsPipePipe, DisplayDatePipe]
  }).compileComponents());

});
