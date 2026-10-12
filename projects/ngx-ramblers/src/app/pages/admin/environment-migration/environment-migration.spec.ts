import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { LoggerTestingModule } from "ngx-logger/testing";
import { of } from "rxjs";
import { EnvironmentMigrationComponent } from "./environment-migration";
import { BackupAndRestoreService } from "../../../services/backup-and-restore.service";
import { EnvironmentConfigService } from "../../../services/environment-config.service";
import { EnvironmentMigrationService } from "../../../services/environment-migration.service";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { EnvironmentsConfig } from "../../../models/environment-config.model";

describe("migration target credentials", () => {
  const config: EnvironmentsConfig = {environments: [], atlas: {defaultCluster: "group-sites.abc123"}};
  const state = {page: null as EnvironmentMigrationComponent | null};

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        EnvironmentMigrationService,
        {provide: BackupAndRestoreService, useValue: {}},
        {provide: EnvironmentConfigService, useValue: {events: () => of(config)}},
        {provide: LoggerFactory, useValue: {createLogger: () => ({error: vi.fn()})}},
        {provide: ActivatedRoute, useValue: {}},
        {provide: Router, useValue: {}}
      ]
    });
    state.page = TestBed.runInInjectionContext(() => new EnvironmentMigrationComponent());
    vi.spyOn(state.page, "loadHistory").mockResolvedValue();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it("prefills the default cluster without creating a user or changing existing credentials", async () => {
    state.page.request.targetMongo.username = "saved-user";
    await state.page.loadEnvironmentConfig();
    expect(state.page.request.targetMongo.cluster).toBe("group-sites.abc123");
    expect(state.page.request.targetMongo.username).toBe("saved-user");
  });

  it("keeps a manually selected target cluster when settings load", async () => {
    state.page.request.targetMongo.cluster = "other-target.abc123";
    await state.page.loadEnvironmentConfig();
    expect(state.page.request.targetMongo.cluster).toBe("other-target.abc123");
  });

  it("clears credentials and typed confirmation when changing the source environment", () => {
    state.page.environments = [{name: "hillside", database: "hillside-database"}] as never;
    state.page.request.environment = "hillside";
    state.page.request.targetMongo = {cluster: "group-sites.abc123", db: "previous-database", username: "previous-user", password: "fictional-password"};
    state.page.request.confirmEnvironment = "previous-environment";
    state.page.onEnvironmentChange();
    expect(state.page.request.targetMongo).toEqual({cluster: "group-sites.abc123", db: "hillside-database", username: "", password: ""});
    expect(state.page.request.confirmEnvironment).toBe("");
    expect(state.page.selectedMigration).toBeNull();
  });

  it("fills the target fields from the NGX provisioning response without starting a migration", async () => {
    state.page.request.environment = "hillside";
    state.page.request.targetMongo.cluster = "group-sites.abc123";
    const pending = state.page.provisionMongoTarget();
    const request = TestBed.inject(HttpTestingController).expectOne("api/environment-migration/mongo/provision");
    expect(request.request.body).toEqual({environment: "hillside", cluster: "group-sites.abc123"});
    expect(request.request.method).toBe("POST");
    request.flush({cluster: "group-sites.abc123", db: "hillside-database", username: "hillside-user", password: "fictional-password"});
    await pending;
    expect(state.page.request.targetMongo.username).toBe("hillside-user");
    expect(state.page.busy).toBe(false);
    expect(state.page.selectedMigration).toBeNull();
  });

  it("keeps the target fields and shows a provisioning failure", async () => {
    state.page.request.environment = "hillside";
    state.page.request.targetMongo.cluster = "group-sites.abc123";
    const pending = state.page.provisionMongoTarget();
    TestBed.inject(HttpTestingController).expectOne("api/environment-migration/mongo/provision").flush({error: "Target user already exists"}, {status: 400, statusText: "Bad Request"});
    await pending;
    expect(state.page.error).toBe("Target user already exists");
    expect(state.page.request.targetMongo.username).toBe("");
    expect(state.page.busy).toBe(false);
  });
});
