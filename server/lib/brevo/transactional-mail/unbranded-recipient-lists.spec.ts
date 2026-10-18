import expect from "expect";
import {afterEach, describe, it} from "mocha";
import sinon from "sinon";
import {unbrandedRecipientListsAllowed} from "./unbranded-recipient-lists";
import {member} from "../../mongo/models/member";
import {BatchTransactionalSendRequest, RecipientMode} from "../../../../projects/ngx-ramblers/src/app/models/email-composer.model";
import {BrandingMode} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

describe("unbranded recipient lists", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  it("allows individual recipients without querying mailing lists", async () => {
    const find = sandbox.stub(member, "find");
    expect(await unbrandedRecipientListsAllowed({brandingMode: BrandingMode.UNBRANDED, recipientMode: RecipientMode.SELECTED_MEMBERS} as BatchTransactionalSendRequest)).toBe(true);
    expect(find.called).toBe(false);
  });

  [[], [{committee: true}, {committee: false}], [{committee: false}]].forEach(subscribers => {
    it(`rejects an empty or mixed committee list with ${subscribers.length} subscribers`, async () => {
      sandbox.stub(member, "find").returns({lean: async () => subscribers} as any);
      expect(await unbrandedRecipientListsAllowed({brandingMode: BrandingMode.UNBRANDED, recipientListIds: [42]} as BatchTransactionalSendRequest)).toBe(false);
    });
  });

  it("allows a committee-only list on Cc beside an individual To recipient", async () => {
    sandbox.stub(member, "find").returns({lean: async () => [{committee: true}]} as any);
    expect(await unbrandedRecipientListsAllowed({brandingMode: BrandingMode.UNBRANDED, recipientListIds: [42], externalRecipients: [{email: "guest@example.com"}]} as BatchTransactionalSendRequest)).toBe(true);
  });

  it("rejects whole-list requests without list provenance", async () => {
    expect(await unbrandedRecipientListsAllowed({brandingMode: BrandingMode.UNBRANDED, recipientMode: RecipientMode.ENTIRE_LIST} as BatchTransactionalSendRequest)).toBe(false);
  });

  it("keeps branded mailing lists available", async () => {
    expect(await unbrandedRecipientListsAllowed({brandingMode: BrandingMode.BRANDED, recipientListIds: [42]} as BatchTransactionalSendRequest)).toBe(true);
  });
});
