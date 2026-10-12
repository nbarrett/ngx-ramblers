import expect from "expect";
import sinon from "sinon";
import {afterEach, describe, it} from "mocha";
import * as runtime from "./fly-runtime-config";
import {setCurrentMachineSecrets} from "./fly-machines";

describe("Fly cutover secrets confirmation", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  [
    {body: {data: {setSecrets: {release: {version: 12}}}}, ok: true},
    {body: {}, ok: false},
    {body: {data: {setSecrets: null}}, ok: false},
    {body: {errors: [{message: "Update refused"}]}, ok: false}
  ].forEach(example => {
    it(`requires a confirmed release for ${JSON.stringify(example.body)}`, async () => {
      sandbox.stub(runtime, "flyRuntimeConfig").resolves({apiToken: "fictional-token", appName: "fictional-app"} as never);
      sandbox.stub(globalThis, "fetch").resolves(new Response(JSON.stringify(example.body), {status: 200}));
      expect((await setCurrentMachineSecrets({MONGODB_URI: "mongodb+srv://user:password@cluster.example.org.uk/database"})).ok).toBe(example.ok);
    });
  });
});
