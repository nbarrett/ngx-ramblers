import expect from "expect";
import {afterEach, describe, it} from "mocha";
import sinon from "sinon";
import * as configuration from "../environments/environments-config";
import * as certificates from "../fly/fly-certificates";
import {crossEnvironmentHealth} from "./cross-environment-health";
import {EnvironmentHealthEvent, EnvironmentHealthEventType, HealthStatus} from "../../../projects/ngx-ramblers/src/app/models/health.model";

const sandbox = sinon.createSandbox();

function deferred() {
  const state = {resolve: null as (() => void) | null};
  const promise = new Promise<void>(resolve => state.resolve = resolve);
  return {promise, resolve: () => state.resolve()};
}

function healthyResponse(): Response {
  return new Response(JSON.stringify({status: HealthStatus.OK, group: {href: "https://group.example.org.uk"}, migrations: {pending: 0, applied: 12, failed: false}}));
}

describe("cross-environment health progress", () => {
  afterEach(() => sandbox.restore());

  it("bounds concurrency, reports a fast result first and cancels running and queued checks", async () => {
    const environments = ["hillside", "lakeside", "riverside", "woodland", "moorland", "coastal"].map(environment => ({environment}));
    sandbox.stub(configuration, "environmentsConfigFromDatabase").resolves({environments, cloudflare: {baseDomain: "platform.example.org.uk"}});
    const fourStarted = deferred();
    const fifthStarted = deferred();
    const releases: ((response: Response) => void)[] = [];
    const signals: AbortSignal[] = [];
    sandbox.stub(globalThis, "fetch").callsFake(async (input, init) => {
      if (String(input).endsWith("/api/system-status")) {
        signals.push(init.signal as AbortSignal);
        return await new Promise<Response>((resolve, reject) => {
          releases.push(resolve);
          init.signal.addEventListener("abort", () => reject(init.signal.reason), {once: true});
          if (releases.length === 4) {
            fourStarted.resolve();
          } else if (releases.length === 5) {
            fifthStarted.resolve();
          }
        });
      } else {
        return new Response(null, {status: 200});
      }
    });
    const events: EnvironmentHealthEvent[] = [];
    const controller = new AbortController();
    const completed = crossEnvironmentHealth(event => events.push(event), controller.signal).then(response => ({response, error: null}), error => ({response: null, error}));
    await fourStarted.promise;
    expect(releases.length).toBe(4);
    expect(events.map(event => event.type)).toEqual([EnvironmentHealthEventType.START]);
    releases[1](healthyResponse());
    await fifthStarted.promise;
    expect(events.filter(event => event.type === EnvironmentHealthEventType.RESULT).map(event => event.environment.environment)).toEqual(["lakeside"]);
    controller.abort();
    const outcome = await completed;
    expect(outcome.error.name).toBe("AbortError");
    expect(signals.every(signal => signal.aborted)).toBe(true);
    expect(releases.length).toBe(5);
    expect(events.some(event => event.type === EnvironmentHealthEventType.COMPLETE)).toBe(false);
  });

  it("retains the aggregate response and includes configured hostnames in progressive results", async () => {
    sandbox.stub(configuration, "environmentsConfigFromDatabase").resolves({environments: [{environment: "hillside", flyio: {apiKey: "example-token"}}], cloudflare: {baseDomain: "platform.example.org.uk"}});
    sandbox.stub(globalThis, "fetch").callsFake(async input => String(input).endsWith("/api/system-status") ? healthyResponse() : new Response(null, {status: 200}));
    sandbox.stub(certificates, "queryCertificates").resolves([]);
    const events: EnvironmentHealthEvent[] = [];
    const response = await crossEnvironmentHealth(event => events.push(event));
    expect(events.map(event => event.type)).toEqual([EnvironmentHealthEventType.START, EnvironmentHealthEventType.RESULT, EnvironmentHealthEventType.COMPLETE]);
    expect(response.summary.total).toBe(1);
    expect(response.summary.healthy).toBe(1);
    expect(response.environments[0].hostnames.map(host => host.hostname)).toEqual(["group.example.org.uk", "hillside.platform.example.org.uk"]);
  });

  it("completes an empty configuration without checking any sites", async () => {
    sandbox.stub(configuration, "environmentsConfigFromDatabase").resolves(null);
    const fetch = sandbox.stub(globalThis, "fetch");
    const events: EnvironmentHealthEvent[] = [];
    const response = await crossEnvironmentHealth(event => events.push(event));
    expect(response.summary.total).toBe(0);
    expect(events.map(event => event.type)).toEqual([EnvironmentHealthEventType.START, EnvironmentHealthEventType.COMPLETE]);
    expect(fetch.called).toBe(false);
  });
});
