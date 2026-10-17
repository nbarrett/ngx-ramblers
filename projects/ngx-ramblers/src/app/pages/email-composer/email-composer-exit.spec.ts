import {describe, expect, it, vi} from "vitest";
import {AdminPath} from "../../models/admin-route-paths.model";
import {StoredValue} from "../../models/ui-actions";
import {EmailComposer} from "./email-composer";

describe("composer Exit destination", () => {
  function composer(overrides: Record<string, unknown> = {}) {
    const instance = Object.create(EmailComposer.prototype);
    Object.assign(instance, {
      routerHistory: {pageHistory: []},
      router: {url: "/group-events/email-composer?config-id=newsletter", navigateByUrl: vi.fn(), navigate: vi.fn()},
      route: {snapshot: {queryParamMap: {get: () => null}}},
      ...overrides
    });
    return instance;
  }

  it("returns to the parent of a nested composer when there is no earlier page", () => {
    const instance = composer();
    instance.leaveComposer();
    expect(instance.router.navigateByUrl).toHaveBeenCalledWith("/group-events");
  });

  it("returns to the last non-composer page when history has one", () => {
    const instance = composer({
      routerHistory: {pageHistory: ["/admin/members/member-admin", "/admin/members/member-admin/email-composer?member=1"]},
      router: {url: "/admin/members/member-admin/email-composer?member=1", navigateByUrl: vi.fn(), navigate: vi.fn()}
    });
    instance.leaveComposer();
    expect(instance.router.navigateByUrl).toHaveBeenCalledWith("/admin/members/member-admin");
  });

  it("returns to Inbox when this is a thread reply with no earlier page", () => {
    const instance = composer({
      router: {url: "/admin/email-composer?thread=abc", navigateByUrl: vi.fn(), navigate: vi.fn()},
      route: {snapshot: {queryParamMap: {get: (key: string) => key === StoredValue.THREAD ? "abc" : null}}}
    });
    instance.leaveComposer();
    expect(instance.router.navigate).toHaveBeenCalledWith(["/" + AdminPath.INBOX], expect.objectContaining({
      queryParams: expect.objectContaining({[StoredValue.THREAD]: "abc"})
    }));
  });
});
