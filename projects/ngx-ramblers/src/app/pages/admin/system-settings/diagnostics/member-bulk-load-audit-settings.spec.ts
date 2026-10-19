import { MemberBulkLoadAuditSettingsComponent } from "./member-bulk-load-audit-settings";
import { MemberBulkLoadAudit } from "../../../../models/member.model";

describe("upload session deletion confirmation", () => {
  function setup() {
    const component = Object.create(MemberBulkLoadAuditSettingsComponent.prototype) as MemberBulkLoadAuditSettingsComponent;
    const deleteSession = vi.fn().mockResolvedValue(null);
    Object.assign(component, {
      busy: false, clearAllArmed: false, pendingDeleteSessionId: null,
      memberBulkLoadAuditService: {delete: deleteSession},
      dateUtils: {displayDateAndTime: () => "the selected date"},
      notify: {warning: vi.fn(), progress: vi.fn(), success: vi.fn(), hide: vi.fn()},
      refresh: vi.fn().mockResolvedValue(null)
    });
    const session = {id: "fictional-session", createdDate: 1} as MemberBulkLoadAudit;
    return {component, deleteSession, session};
  }

  it("requires a second click on the same session before deleting", async () => {
    const {component, deleteSession, session} = setup();
    await component.deleteSession(session);
    expect(deleteSession).not.toHaveBeenCalled();
    await component.deleteSession(session);
    expect(deleteSession).toHaveBeenCalledExactlyOnceWith(session);
  });

  it("cancels confirmation and requires another confirmation for a different session", async () => {
    const {component, deleteSession, session} = setup();
    await component.deleteSession(session);
    component.cancelDeletion();
    await component.deleteSession(session);
    await component.deleteSession({...session, id: "another-fictional-session"});
    expect(deleteSession).not.toHaveBeenCalled();
  });
});
