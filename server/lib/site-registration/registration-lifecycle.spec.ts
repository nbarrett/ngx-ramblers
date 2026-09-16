import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import {
  RegistrationPlan, RegistrationSettings, RegistrationState, RegistrationStep, StoredSiteRegistration
} from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import * as registrationStore from "./registration-store";
import * as groupsApi from "../ramblers/list-groups";
import * as registrationEmail from "../brevo/transactional-mail/send-site-registration-email";
import * as environmentsConfig from "../environments/environments-config";
import * as environmentContext from "../environment-setup/environment-context";
import * as adminMemberTemplate from "../environment-setup/templates/sample-data/admin-member-template";
import * as importScrape from "./registration-import-scrape";
import * as environmentSetup from "../environment-setup/environment-setup-service";
import * as registrationLogos from "./registration-logos";
import * as osMapsProvision from "../os-maps/provision-os-maps-key";
import * as environmentDetailsModule from "../environment-setup/environment-details";
import * as mongoDatabaseUser from "../environment-setup/mongo-database-user";
import * as systemConfigModule from "../config/system-config";
import { approveRegistration, runRegistrationJobs, submitRegistration } from "./registration-jobs";
import { confirmRegistration, startRegistration } from "./registration-service";
import { registrationMigrationConfig } from "./registration-content";
import { createEmptySetupRequest } from "../../../projects/ngx-ramblers/src/app/models/environment-setup.model";
import { MongoClient } from "mongodb";
import * as publicSiteFetch from "./public-site-fetch";
import * as migrationFileUpload from "../migration/migration-file-upload";
import { FLYIO_DEFAULTS } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";

const settings: RegistrationSettings = {
  enabled: true,
  committeeEmailValidationEnabled: true,
  sourceFidelityValidationEnabled: true,
  publicUrl: "https://platform.example.com",
  senderEmail: "sender@example.com",
  reviewer: {firstName: "Site", lastName: "Reviewer", email: "reviewer@example.com"},
  sourceEnvironmentName: "staging",
  approvedEmails: [{groupCode: "AB01", recipients: [{email: "committee@example.com", name: "Committee"}]}]
};

const group = {
  scope: "G", group_code: "AB01", area_code: "AB", groups_in_area: [], name: "Example Ramblers",
  url: "", external_url: "https://group.example", description: "", latitude: 0, longitude: 0,
  date_updated: "", date_walks_events_updated: ""
};

function inMemoryRegistrations(state: {registration: StoredSiteRegistration | null}) {
  const matchesState = (query: any): boolean => !query.state || query.state === state.registration?.state || query.state.$in?.includes(state.registration?.state);
  const collection: any = {
    createIndex: sinon.stub().resolves(),
    findOne: sinon.stub().callsFake(async (query: any) => {
      const registration = state.registration;
      const matches = registration && matchesState(query) &&
        (!query.id || query.id === registration.id) &&
        (!query["group.group_code"] || query["group.group_code"] === registration.group.group_code) &&
        (!query.resumeTokenHash || query.resumeTokenHash === registration.resumeTokenHash) &&
        (!query.verificationTokenHash || query.verificationTokenHash === registration.verificationTokenHash);
      return matches ? registration : null;
    }),
    findOneAndUpdate: sinon.stub().callsFake(async (query: any, update: any) => {
      if (!state.registration && update.$setOnInsert) {
        state.registration = {...update.$setOnInsert};
      } else if (state.registration && matchesState(query) && (!query.id || query.id === state.registration.id)) {
        state.registration = {...state.registration, ...(update.$set || {})};
      }
      return state.registration;
    }),
    updateOne: sinon.stub().callsFake(async (query: any, update: any) => {
      const matched = state.registration && (!query.id || query.id === state.registration.id) && matchesState(query);
      if (matched) {
        const pushedProgress = update.$push?.progress?.$each || [];
        state.registration = {...state.registration, ...(update.$set || {}), progress: [...state.registration.progress, ...pushedProgress]};
      }
      return {matchedCount: matched ? 1 : 0};
    }),
    updateMany: sinon.stub().resolves({matchedCount: 0})
  };
  return collection;
}

describe("site registration lifecycle", () => {
  const sandboxState: {sandbox: sinon.SinonSandbox | null} = {sandbox: null};

  beforeEach(() => {
    sandboxState.sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandboxState.sandbox.restore();
  });

  it("takes a Lite registration from approved email through confirmation, review and invitation", async () => {
    const state: {registration: StoredSiteRegistration | null} = {registration: null};
    const registrations = inMemoryRegistrations(state);
    const members: any[] = [];
    const membersCollection = {
      updateOne: sinon.stub().callsFake(async (_query: any, update: any) => { members.splice(0, members.length, update.$set); }),
      findOne: sinon.stub().callsFake(async () => members[0])
    };
    sandboxState.sandbox.stub(registrationStore, "registrations").returns(registrations);
    sandboxState.sandbox.stub(registrationStore, "registrationSettings").resolves(settings);
    sandboxState.sandbox.stub(registrationStore, "ensureRegistrationIndexes").resolves();
    sandboxState.sandbox.stub(groupsApi, "fetchRamblersGroupsFromApi").resolves([group] as any);
    const sendEmail = sandboxState.sandbox.stub(registrationEmail, "sendRegistrationEmail").resolves();
    sandboxState.sandbox.stub(environmentsConfig, "findEnvironmentFromDatabase").resolves(null);
    const setupDefaults = createEmptySetupRequest();
    sandboxState.sandbox.stub(environmentDetailsModule, "environmentDetails").resolves({
      environmentBasics: {...setupDefaults.environmentBasics, memory: "1024mb", scaleCount: 2, organisation: "source-organisation"},
      serviceConfigs: {...setupDefaults.serviceConfigs, brevo: {apiKey: "platform-brevo-key"}}
    } as any);
    sandboxState.sandbox.stub(systemConfigModule, "systemConfig").resolves({national: {walksManager: {apiKey: "api-key"}}} as any);
    const createEnvironment = sandboxState.sandbox.stub(environmentSetup, "createEnvironment").resolves({} as any);
    sandboxState.sandbox.stub(mongoDatabaseUser, "createEnvironmentMongoUser").resolves({username: "ngx_example_ramblers_db_user", password: "generated-password"});
    sandboxState.sandbox.stub(registrationLogos, "applyRamblersDirectoryLogo").resolves(null);
    sandboxState.sandbox.stub(osMapsProvision, "ensureOsMapsApiKey").resolves({apiKey: "os-key", message: "OS Maps API key already configured"});
    sandboxState.sandbox.stub(environmentsConfig, "setEnvironmentEstateDeploy").resolves();
    sandboxState.sandbox.stub(MongoClient.prototype, "connect").resolves();
    sandboxState.sandbox.stub(MongoClient.prototype, "close").resolves();
    sandboxState.sandbox.stub(MongoClient.prototype, "db").returns({
      collection: () => ({updateOne: sandboxState.sandbox.stub().resolves()})
    } as any);
    sandboxState.sandbox.stub(environmentContext, "loadEnvironmentContext").resolves({envConfigData: {}} as any);
    sandboxState.sandbox.stub(environmentContext, "connectToEnvironmentMongo").resolves({
      db: {collection: () => membersCollection}, client: {close: sinon.stub().resolves()}
    } as any);
    sandboxState.sandbox.stub(adminMemberTemplate, "createAdminMember").returns({member: {email: "committee@example.com"}} as any);

    const started = await startRegistration({groupCode: "AB01", email: "committee@example.com", plan: RegistrationPlan.LITE});
    expect(started.resumeToken).toMatch(/^[a-f0-9]{64}$/);
    expect(state.registration.state).toBe(RegistrationState.AWAITING_EMAIL);

    await confirmRegistration(started.resumeToken);
    expect(state.registration.state).toBe(RegistrationState.DRAFT);
    expect(state.registration.currentStep).toBe(RegistrationStep.REVIEW);

    await submitRegistration(started.resumeToken);
    expect(state.registration.state).toBe(RegistrationState.QUEUED);
    expect(state.registration.migrationConfig).toBe(null);

    await runRegistrationJobs();
    expect(state.registration.state).toBe(RegistrationState.REVIEW);
    expect(state.registration.provisionedAt).not.toBe(null);
    expect(createEnvironment.firstCall.args[0].ramblersInfo.groupCode).toBe("AB01");
    expect(createEnvironment.firstCall.args[0].serviceConfigs.ramblers.apiKey).toBe("api-key");
    expect(createEnvironment.firstCall.args[0].serviceConfigs.osMaps).toEqual({apiKey: ""});
    expect(createEnvironment.firstCall.args[0].environmentBasics.memory).toBe(FLYIO_DEFAULTS.MEMORY);
    expect(createEnvironment.firstCall.args[0].environmentBasics.scaleCount).toBe(FLYIO_DEFAULTS.SCALE_COUNT);
    expect(createEnvironment.firstCall.args[0].environmentBasics.organisation).toBe("source-organisation");
    expect(createEnvironment.firstCall.args[0].serviceConfigs.brevo.apiKey).toBe("");
    expect(createEnvironment.firstCall.args[0].serviceConfigs.mongodb.username).toBe("ngx_example_ramblers_db_user");
    expect(createEnvironment.firstCall.args[0].serviceConfigs.mongodb.password).toBe("generated-password");

    await approveRegistration(state.registration.id);
    await runRegistrationJobs();

    expect(state.registration.state).toBe(RegistrationState.COMPLETE);
    expect(state.registration.invitedAt).not.toBe(null);
    expect(sendEmail.callCount).toBe(3);
    expect(sendEmail.thirdCall.args[2]).toBe("committee@example.com");
    expect(sendEmail.thirdCall.args[3].actionUrl).toContain("/admin/set-password/");
  });

  it("imports a generic Full registration and saves its editable Migration Settings config before review", async () => {
    const pages = [{url: "https://group.example/about", path: "about", title: "About", type: "text", selected: true, parentPath: null, proposed: false}] as any;
    const initial = {
      id: "registration-full", group, email: "committee@example.com", plan: RegistrationPlan.FULL,
      currentStep: RegistrationStep.PROGRESS, website: "https://group.example", pages,
      proposedNavigation: [{path: "about", title: "About"}], state: RegistrationState.QUEUED,
      verifiedAt: 1, createdAt: 1, updatedAt: 1, environmentName: "example-ramblers",
      siteUrl: "https://example-ramblers.ngx-ramblers.org.uk", flavour: "generic", progress: [], error: null,
      resumeTokenHash: "resume", verificationTokenHash: "verify", verificationExpiresAt: 0, lastEmailAt: 1,
      migrationConfig: null, provisionedAt: 1, walksLoadedAt: 1, importedAt: null, reviewedAt: null,
      reviewNotifiedAt: null, invitedAt: null, leaseUntil: 0, leaseOwner: null
    } as StoredSiteRegistration;
    initial.migrationConfig = registrationMigrationConfig(initial);
    const state = {registration: initial};
    const registrations = inMemoryRegistrations(state);
    const target = {migrationConfig: null as any, navigation: null as any, groupPages: null as any, pagePaths: [] as string[], deletedPaths: [] as string[], earlierImportQueries: [] as any[], landingVisual: false, landingVisualImages: [] as string[], homeVisual: false};
    const targetDb = {collection: (name: string) => ({
      find: sinon.stub().returns({toArray: sinon.stub().resolves(target.pagePaths.map(path => ({path, rows: [{}]})))}),
      findOne: sinon.stub().resolves(null),
      deleteMany: sinon.stub().callsFake(async query => {
        if (query.path?.$in) {
          target.deletedPaths = query.path.$in;
          return {deletedCount: target.deletedPaths.length};
        } else {
          target.earlierImportQueries.push(query);
          return {deletedCount: 0};
        }
      }),
      updateOne: sinon.stub().callsFake(async (query: any, update: any) => {
        if (name === "config" && query.key === "migration") {
          target.migrationConfig = update.$set.value;
        } else if (name === "config") {
          target.navigation = update.$set["value.header.navigationButtons"];
          target.groupPages = update.$set["value.group.pages"];
        } else if (name === "pageContent" && update.$set?.path) {
          target.pagePaths.push(update.$set.path);
          const headingFirst = /^#\s+/.test(update.$set.rows[0]?.columns?.[0]?.contentText || "");
          const openingRow = update.$set.rows[headingFirst ? 1 : 0];
          target.landingVisual = openingRow?.showSwiper && openingRow.columns.some((column: any) => column.imageSource || column.showPlaceholderImage || column.rows?.length);
          target.landingVisualImages = (openingRow?.showSwiper ? openingRow.columns : []).map((column: any) => column.imageSource).filter(Boolean);
        } else if (name === "pageContent" && update.$push?.rows) {
          target.homeVisual = update.$push.rows.$each[0].showSwiper;
        }
      })
    })};
    sandboxState.sandbox.stub(registrationStore, "registrations").returns(registrations);
    sandboxState.sandbox.stub(registrationStore, "registrationSettings").resolves(settings);
    sandboxState.sandbox.stub(environmentContext, "loadEnvironmentContext").resolves({envConfigData: {aws: {bucket: "review-site"}}} as any);
    sandboxState.sandbox.stub(environmentContext, "connectToEnvironmentMongo").resolves({db: targetDb, client: {close: sinon.stub().resolves()}} as any);
    sandboxState.sandbox.stub(osMapsProvision, "ensureOsMapsApiKey").resolves({apiKey: "os-key", message: "OS Maps API key already configured"});
    sandboxState.sandbox.stub(environmentsConfig, "setEnvironmentEstateDeploy").resolves();
    sandboxState.sandbox.stub(publicSiteFetch, "fetchPublicSiteImage").resolves(Buffer.from("image"));
    const uploads = sandboxState.sandbox.stub(migrationFileUpload, "uploadMigrationBufferToS3").callsFake(async (_bucket, sourceName) => `site-content/${sourceName.split("/").pop()}`);
    sandboxState.sandbox.stub(importScrape, "scrapeRegistrationSite").resolves({pageContents: [{path: "about", rows: [
      {type: "text", columns: [{contentText: "About"}]},
      {type: "text", showSwiper: true, columns: [
        {imageSource: "https://group.example/one.jpg"},
        {imageSource: "https://group.example/two.jpg"},
        {imageSource: "https://group.example/three.jpg"}
      ]}
    ]}], albums: [], contentTextItems: []} as any);
    const sendEmail = sandboxState.sandbox.stub(registrationEmail, "sendRegistrationEmail").resolves();

    await runRegistrationJobs();

    expect(state.registration.state).toBe(RegistrationState.REVIEW);
    expect(state.registration.importedAt).not.toBe(null);
    expect(target.migrationConfig.sites[0].parentPages[0].templateFragmentId).toContain("fragments/templates/self-service/");
    expect(target.pagePaths).toContain("about-us");
    expect(target.earlierImportQueries.length).toBe(2);
    expect(target.navigation).toEqual([{title: "National Ramblers", href: "https://ramblers.org.uk"}]);
    expect(target.groupPages.map(page => page.href)).toEqual(["about-us", "admin"]);
    expect(target.deletedPaths).toContain("contact-us");
    expect(target.deletedPaths).toContain("walks/information");
    expect(target.deletedPaths).not.toContain("about-us");
    expect(uploads.args.map(args => args[0])).toEqual(["review-site", "review-site", "review-site"]);
    expect(target.landingVisualImages).toEqual(["site-content/one.jpg", "site-content/two.jpg"]);
    expect(sendEmail.firstCall.args[2]).toBe("reviewer@example.com");
  });
});
