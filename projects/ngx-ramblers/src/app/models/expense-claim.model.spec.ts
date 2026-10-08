import { expenseEventDisplayDescription, ExpenseEventDisplayDescription, ExpenseEventTypeDescription } from "./expense-claim.model";

describe("expenseEventDisplayDescription", () => {

  it("explains first approval as payment created in Unity", () => {
    expect(expenseEventDisplayDescription(ExpenseEventTypeDescription.FIRST_APPROVAL))
      .toEqual(ExpenseEventDisplayDescription.FIRST_APPROVAL);
  });

  it("explains paid as authorised in Unity", () => {
    expect(expenseEventDisplayDescription(ExpenseEventTypeDescription.PAID))
      .toEqual(ExpenseEventDisplayDescription.PAID);
  });

  it("leaves created and submitted as stored", () => {
    expect(expenseEventDisplayDescription(ExpenseEventTypeDescription.CREATED))
      .toEqual(ExpenseEventTypeDescription.CREATED);
    expect(expenseEventDisplayDescription(ExpenseEventTypeDescription.SUBMITTED))
      .toEqual(ExpenseEventTypeDescription.SUBMITTED);
  });

  it("returns an empty string when there is no description", () => {
    expect(expenseEventDisplayDescription(undefined)).toEqual("");
  });
});
