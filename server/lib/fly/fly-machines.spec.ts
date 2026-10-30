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
    {body: {data: {setSecrets: {release: null}}}, ok: true},
    {body: {data: {setSecrets: {}}}, ok: true},
    {body: {}, ok: false},
    {body: {data: {setSecrets: null}}, ok: false},
    {body: {errors: [{message: "Update refused"}]}, ok: false}
  ].forEach(example => {
    it(`accepts a confirmed secrets update for ${JSON.stringify(example.body)}`, async () => {
      sandbox.stub(runtime, "flyRuntimeConfig").resolves({apiToken: "fictional-token", appName: "fictional-app"} as never);
      const fetchStub = sandbox.stub(globalThis, "fetch" as any);
      fetchStub.onFirstCall().resolves(new Response(JSON.stringify(example.body), {status: 200}));
      fetchStub.onSecondCall().resolves(new Response(JSON.stringify({version: 9}), {status: 200}));
      expect((await setCurrentMachineSecrets({MONGODB_URI: "mongodb+srv://user:password@cluster.example.org.uk/database"})).ok).toBe(example.ok);
    });
  });
});
