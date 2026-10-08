import {describe, expect, it, vi} from "vitest";
import {defaultEmailComposerState} from "../../functions/email-composer";
import {RecipientMode} from "../../models/email-composer.model";
import {Member} from "../../models/member.model";
import {MemberSelection} from "../../models/mail.model";
import {EmailComposerRecipientsService} from "./email-composer-recipients.service";

describe("composer member audience", () => {
  function service() {
    const state = defaultEmailComposerState();
    state.recipientMode = RecipientMode.SELECTED_MEMBERS;
    const candidates = [
      {id: "alex", email: "alex@example.com"}, {id: "sam", email: "sam@example.com"}
    ];
    const instance = Object.create(EmailComposerRecipientsService.prototype);
    Object.assign(instance, {
      session: {state, syncStateToUrl: vi.fn()},
      expandedRecipientFilterKeys: new Set(),
      pool: {
        members: candidates,
        cachedCandidateMembers: candidates,
        recomputeCandidateMembers: vi.fn(),
        candidateMembers: () => candidates
      },
      resolver: {memberMatchesPreFilter: (member: Member) => member.id === "alex"},
      onFilteredMemberIdsChange: (ids: string[]) => { state.selectedMemberIds = ids; }
    });
    return instance;
  }

  it("selects everyone after leaving the configured filter", () => {
    const instance = service();
    instance.session.state.preFilterKey = MemberSelection.RECENTLY_ADDED;
    instance.setNarrowListId = (id: number | null) => { instance.session.state.narrowListId = id; };
    instance.chooseMemberAudience(null);
    expect(instance.session.state.preFilterKey).toBe(null);
    expect(instance.session.state.selectedMemberIds).toEqual(["alex", "sam"]);
  });

  it("clears the list restriction when choosing the configured filter", () => {
    const instance = service();
    instance.session.state.narrowListId = 42;
    instance.onPreFilterKeyChange(MemberSelection.RECENTLY_ADDED);
    expect(instance.session.state.narrowListId).toBe(null);
    expect(instance.pool.recomputeCandidateMembers).toHaveBeenCalledOnce();
    expect(instance.session.state.selectedMemberIds).toEqual(["alex"]);
  });
});
