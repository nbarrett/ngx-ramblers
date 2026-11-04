import { HttpErrorResponse } from "@angular/common/http";
import { ChangePasswordComponent } from "./change-password.component";
import { ProfileUpdateType } from "../../../models/member.model";

function setup() {
  const notify = {
    hide: vi.fn(), showContactUs: vi.fn(), setBusy: vi.fn(), clearBusy: vi.fn(),
    success: vi.fn(), error: vi.fn(), progress: vi.fn()
  };
  const profileService = {saveMemberDetails: vi.fn().mockResolvedValue(null), backToAdmin: vi.fn()};
  const authService = {resetPassword: vi.fn().mockResolvedValue({showResetPassword: false, alertMessage: "Password changed"})};
  const memberService = {getMemberForUserName: vi.fn().mockRejectedValue(new HttpErrorResponse({status: 404}))};
  const component = Object.assign(Object.create(ChangePasswordComponent.prototype), {
    member: {id: "member-id", userName: "alex.reed"},
    enteredMemberCredentials: {userName: "alex.updated"},
    notify, profileService, authService, memberService, logger: {debug: vi.fn()}
  });
  return {component, notify, profileService, authService, memberService};
}

describe("login details saving", () => {
  it("persists a username-only change through the existing profile save flow", async () => {
    const {component, notify, profileService, authService} = setup();
    await component.saveLoginDetails();
    expect(profileService.saveMemberDetails).toHaveBeenCalledWith(notify, ProfileUpdateType.LOGIN_DETAILS, {id: "member-id", userName: "alex.updated"});
    expect(component.member.userName).toBe("alex.updated");
    expect(authService.resetPassword).not.toHaveBeenCalled();
    expect(notify.clearBusy).toHaveBeenCalled();
  });

  it("reports blank usernames without sending a save", async () => {
    const {component, notify, profileService} = setup();
    component.enteredMemberCredentials.userName = "  ";
    await expect(component.saveLoginDetails()).rejects.toThrow("cannot be blank");
    expect(profileService.saveMemberDetails).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalled();
  });

  it("reports duplicate usernames and preserves the entered value for correction", async () => {
    const {component, notify, memberService, profileService} = setup();
    memberService.getMemberForUserName.mockResolvedValue({id: "other-member"});
    await expect(component.saveLoginDetails()).rejects.toThrow("already used");
    expect(profileService.saveMemberDetails).not.toHaveBeenCalled();
    expect(component.enteredMemberCredentials.userName).toBe("alex.updated");
    expect(notify.error).toHaveBeenCalled();
  });

  it("reports availability lookup failures rather than leaving the save pending", async () => {
    const {component, notify, memberService} = setup();
    memberService.getMemberForUserName.mockRejectedValue(new HttpErrorResponse({status: 500, statusText: "Server error"}));
    await expect(component.saveLoginDetails()).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(notify.error).toHaveBeenCalled();
    expect(notify.clearBusy).toHaveBeenCalled();
  });

  it("keeps the original username after a failed save and stays on the page", async () => {
    const {component, profileService, notify} = setup();
    profileService.saveMemberDetails.mockRejectedValue(new Error("Save failed"));
    await expect(component.saveAndExit()).rejects.toThrow("Save failed");
    expect(component.member.userName).toBe("alex.reed");
    expect(profileService.backToAdmin).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalled();
  });

  it("resets a password using the successfully saved username", async () => {
    const {component, authService} = setup();
    component.enteredMemberCredentials.newPassword = "fictional-password";
    component.enteredMemberCredentials.newPasswordConfirm = "fictional-password";
    await component.saveLoginDetails();
    expect(authService.resetPassword).toHaveBeenCalledWith("alex.updated", "fictional-password", "fictional-password");
  });

  it("explains partial success if a password change fails after a username was saved", async () => {
    const {component, authService, notify} = setup();
    component.enteredMemberCredentials.newPassword = "short";
    authService.resetPassword.mockResolvedValue({showResetPassword: true, alertMessage: "Password too short"});
    await expect(component.saveLoginDetails()).rejects.toThrow("Password too short");
    expect(notify.error).toHaveBeenCalledWith({title: "User name saved, password not changed", message: "Your user name was saved successfully. The password change failed: Password too short"});
  });

  it("confirms when there are no changes", async () => {
    const {component, notify, profileService} = setup();
    component.enteredMemberCredentials.userName = "alex.reed";
    await component.saveLoginDetails();
    expect(profileService.saveMemberDetails).not.toHaveBeenCalled();
    expect(notify.success).toHaveBeenCalledWith({title: "Login details", message: "There are no changes to save."});
  });
});
