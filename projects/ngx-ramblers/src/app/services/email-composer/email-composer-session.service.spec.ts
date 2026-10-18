import { provideRouter, Router } from "@angular/router";
import { skip } from "rxjs";
import { kebabCase } from "es-toolkit/compat";
import { MemberSelection } from "../../models/mail.model";
import { TestBed } from "@angular/core/testing";
import { LoggerFactory } from "../logger-factory.service";
import { EmailComposerSessionService } from "./email-composer-session.service";
import { BrandingMode, EmailCompositionKind, EmailComposerStepKey, RecipientMode } from "../../models/email-composer.model";
import { StoredValue } from "../../models/ui-actions";
import { defaultEmailComposerState } from "../../functions/email-composer";

describe("unbranded composer session", () => {
  function session() {
    const service = Object.create(EmailComposerSessionService.prototype) as EmailComposerSessionService;
    const navigate = vi.fn();
    Object.assign(service, {
      state: defaultEmailComposerState(),
      uiActions: {updateQueryParameters: navigate}
    });
    service.state.brandingMode = BrandingMode.UNBRANDED;
    return {service, navigate};
  }

  it("removes the branded configuration from the URL on any unbranded state update", async () => {
    const {service, navigate} = session();
    await service.syncStateToUrl({[StoredValue.TAB]: "compose"});
    expect(navigate).toHaveBeenCalledWith({[StoredValue.TAB]: "compose", [StoredValue.CONFIG_ID]: null});
  });

  it("does not let later configuration updates put config-id back into an unbranded URL", async () => {
    const {service, navigate} = session();
    await service.syncStateToUrl({[StoredValue.CONFIG_ID]: "newsletter"});
    expect(navigate).toHaveBeenCalledWith({[StoredValue.CONFIG_ID]: null});
  });

  it("keeps configuration URLs available for branded compositions", async () => {
    const {service, navigate} = session();
    service.state.brandingMode = BrandingMode.BRANDED;
    await service.syncStateToUrl({[StoredValue.CONFIG_ID]: "standard"});
    expect(navigate).toHaveBeenCalledWith({[StoredValue.CONFIG_ID]: "standard"});
  });

  it.each([EmailCompositionKind.NEWSLETTER, EmailCompositionKind.RELEASE_NOTE_UPDATE])("disables inherited %s drafting features in unbranded mode", kind => {
    const {service} = session();
    service.state.compositionKind = kind;
    expect(service.newsletterMode()).toBe(false);
    expect(service.releaseNoteUpdateMode()).toBe(false);
    service.state.brandingMode = BrandingMode.BRANDED;
    expect(service.newsletterMode()).toBe(kind === EmailCompositionKind.NEWSLETTER);
    expect(service.releaseNoteUpdateMode()).toBe(kind === EmailCompositionKind.RELEASE_NOTE_UPDATE);
  });
});

describe("composer recipient URL transitions", () => {
  function routedSession() {
    TestBed.configureTestingModule({
      providers: [
        EmailComposerSessionService,
        provideRouter([]),
        {provide: LoggerFactory, useValue: {createLogger: () => ({debug: vi.fn()})}}
      ]
    });
    return {router: TestBed.inject(Router), service: TestBed.inject(EmailComposerSessionService)};
  }

  it("keeps Welcome recipient defaults when changing the step before navigation finishes", async () => {
    const {router, service} = routedSession();
    await router.navigate([], {queryParams: {
      [StoredValue.CONFIG_ID]: "newsletter",
      [StoredValue.EMAIL_TYPE]: kebabCase(RecipientMode.ENTIRE_LIST),
      [StoredValue.LIST_ID]: "42",
      [StoredValue.TAB]: EmailComposerStepKey.RECIPIENTS
    }});
    service.syncStateToUrl({
      [StoredValue.CONFIG_ID]: "welcome",
      [StoredValue.EMAIL_TYPE]: kebabCase(RecipientMode.SELECTED_MEMBERS),
      [StoredValue.LIST_ID]: null,
      [StoredValue.PRE_FILTER]: MemberSelection.RECENTLY_ADDED
    });
    await service.syncStateToUrl({
      [StoredValue.TAB]: EmailComposerStepKey.TEMPLATE,
      [StoredValue.DRAFT_ID]: null
    });
    await service.syncStateToUrl({[StoredValue.TAB]: EmailComposerStepKey.RECIPIENTS});
    const params = router.routerState.snapshot.root.queryParamMap;
    expect(params.get(StoredValue.CONFIG_ID)).toBe("welcome");
    expect(params.get(StoredValue.EMAIL_TYPE)).toBe(kebabCase(RecipientMode.SELECTED_MEMBERS));
    expect(params.get(StoredValue.PRE_FILTER)).toBe(MemberSelection.RECENTLY_ADDED);
    expect(params.get(StoredValue.LIST_ID)).toBeNull();
  });

  it("publishes a branding switch and recipient reset together without an intermediate branded audience", async () => {
    const {router, service} = routedSession();
    await router.navigate([], {queryParams: {
      [StoredValue.BRANDING]: BrandingMode.BRANDED,
      [StoredValue.CONFIG_ID]: "newsletter",
      [StoredValue.EMAIL_TYPE]: kebabCase(RecipientMode.ENTIRE_LIST),
      [StoredValue.LIST_ID]: "42"
    }});
    const observed: string[] = [];
    const subscription = router.routerState.root.queryParamMap.pipe(skip(1)).subscribe(params => observed.push(params.get(StoredValue.BRANDING)));
    service.state.brandingMode = BrandingMode.UNBRANDED;
    service.syncStateToUrl({[StoredValue.EMAIL_TYPE]: kebabCase(RecipientMode.SELECTED_MEMBERS)});
    service.syncStateToUrl({[StoredValue.LIST_ID]: null});
    await service.syncStateToUrl({[StoredValue.BRANDING]: BrandingMode.UNBRANDED, [StoredValue.PRE_FILTER]: null});
    subscription.unsubscribe();
    expect(observed).toEqual([BrandingMode.UNBRANDED]);
    const params = router.routerState.snapshot.root.queryParamMap;
    expect(params.get(StoredValue.CONFIG_ID)).toBeNull();
    expect(params.get(StoredValue.LIST_ID)).toBeNull();
    expect(params.get(StoredValue.EMAIL_TYPE)).toBe(kebabCase(RecipientMode.SELECTED_MEMBERS));
  });

  it("keeps the latest recipient choice when it matches the URL before an earlier update finishes", async () => {
    const {router, service} = routedSession();
    await router.navigate([], {queryParams: {[StoredValue.LIST_ID]: "42"}});
    service.syncStateToUrl({[StoredValue.LIST_ID]: null});
    await service.syncStateToUrl({[StoredValue.LIST_ID]: "42"});
    expect(router.routerState.snapshot.root.queryParamMap.get(StoredValue.LIST_ID)).toBe("42");
  });
});
