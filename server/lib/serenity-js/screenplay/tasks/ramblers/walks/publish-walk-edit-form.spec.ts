import expect from "expect";
import { describe, it } from "mocha";
import { forceSubmitWalkEditPublish, prepareWalkEditFormForPublish } from "./publish-walk-edit-form";

describe("prepareWalkEditFormForPublish", () => {
  it("turns off HTML5 validation and enables the hidden publish submit", () => {
    const form = {
      noValidate: false,
      querySelectorAll: () => [{id: "edit-field-estimated-finishing-time-0-value"}],
      querySelector: () => null
    };
    const submitter = {disabled: true, form};
    const documentRef = {
      querySelector: (selector: string) => selector === "#save_publish_action" ? submitter : form
    } as unknown as Document;
    const attempt = prepareWalkEditFormForPublish(documentRef, "#save_publish_action", "#node-walk-walk-details-form");
    expect(form.noValidate).toEqual(true);
    expect(submitter.disabled).toEqual(false);
    expect(attempt).toMatchObject({foundSubmit: true, foundForm: true, method: "prepared"});
    expect(attempt.invalidFields).toEqual(["edit-field-estimated-finishing-time-0-value"]);
  });

  it("stringifies without module identifiers so the browser evaluate can run it", () => {
    expect(prepareWalkEditFormForPublish.toString()).not.toMatch(/WALK_EDIT_|walkEditPublishForm/);
  });
});

describe("forceSubmitWalkEditPublish", () => {
  it("posts save_publish_action via form.submit when a click did not submit", () => {
    const submitted = {count: 0};
    const created: {type?: string; name?: string; value?: string; attrs: Record<string, string>; setAttribute?: (key: string, value: string) => void} = {attrs: {}};
    created.setAttribute = (key: string, value: string) => {
      created.attrs[key] = value;
    };
    const form = {
      querySelector: () => null,
      querySelectorAll: () => [],
      appendChild: (element: unknown) => element,
      submit: () => {
        submitted.count += 1;
      }
    };
    const documentRef = {
      querySelector: (selector: string) => selector === "#save_publish_action" ? {form, disabled: false} : form,
      createElement: () => created
    } as unknown as Document;
    const windowRef = {ngxSaveSubmitted: false};
    const attempt = forceSubmitWalkEditPublish(documentRef, windowRef, "#save_publish_action", "#node-walk-walk-details-form");
    expect(submitted.count).toEqual(1);
    expect(windowRef.ngxSaveSubmitted).toEqual(true);
    expect(created.name).toEqual("save_publish_action");
    expect(created.value).toEqual("Publish");
    expect(created.attrs["data-ngx-publish"]).toEqual("true");
    expect(attempt.method).toEqual("form-submit");
  });

  it("stringifies without module identifiers so the browser evaluate can run it", () => {
    expect(forceSubmitWalkEditPublish.toString()).not.toMatch(/WALK_EDIT_|walkEditPublishForm/);
  });
});
