import expect from "expect";
import sinon from "sinon";
import { EventEmitter, once } from "node:events";
import WebSocket, { WebSocketServer } from "ws";
import { AddressInfo } from "node:net";
import { member } from "../mongo/models/member";
import { registerWebSocketServer } from "../websockets/websocket-broadcaster";
import { startMemberSessionWatcher, stopMemberSessionWatcher } from "./member-session-watcher";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";

class SessionChangeStream extends EventEmitter {
  async close(): Promise<void> {
    this.emit("close");
  }
}

describe("Member session change notifications", () => {
  const sandbox = sinon.createSandbox();
  const state = {server: null as WebSocketServer | null, clients: [] as WebSocket[]};

  afterEach(async () => {
    await stopMemberSessionWatcher();
    state.clients.forEach(client => client.terminate());
    state.clients = [];
    if (state.server) {
      await new Promise<void>((resolve, reject) => state.server.close(error => error ? reject(error) : resolve()));
      state.server = null;
    }
    sandbox.restore();
  });

  it("pushes a database change to separate connected computers without broadcasting member details", async () => {
    const stream = new SessionChangeStream();
    sandbox.stub(member, "watch").returns(stream as unknown as ReturnType<typeof member.watch>);
    state.server = new WebSocketServer({host: "127.0.0.1", port: 0});
    await once(state.server, "listening");
    registerWebSocketServer(state.server);
    const url = `ws://127.0.0.1:${(state.server.address() as AddressInfo).port}`;
    state.clients = [new WebSocket(url), new WebSocket(url)];
    await Promise.all(state.clients.map(client => once(client, "open")));
    startMemberSessionWatcher();
    const received = Promise.all(state.clients.map(async client => JSON.parse((await once(client, "message"))[0].toString())));
    stream.emit("change", {operationType: "update", documentKey: {_id: "fictional-member"}, updateDescription: {updatedFields: {memberAdmin: false}}});
    expect(await received).toEqual([
      {type: MessageType.MEMBER_SESSION_CHANGED, data: {}},
      {type: MessageType.MEMBER_SESSION_CHANGED, data: {}}
    ]);
  });

  it("opens one stream per server and watches changes and removals of session privileges", () => {
    const stream = new SessionChangeStream();
    const watch = sandbox.stub(member, "watch").returns(stream as unknown as ReturnType<typeof member.watch>);
    startMemberSessionWatcher();
    startMemberSessionWatcher();
    expect(watch.callCount).toBe(1);
    const pipeline = JSON.stringify(watch.firstCall.args[0]);
    expect(pipeline).toContain("updateDescription.updatedFields.viewAsMember");
    expect(pipeline).toContain("updateDescription.updatedFields.memberAdmin");
    expect(pipeline).toContain("updateDescription.updatedFields.revoked");
    expect(pipeline).toContain("updateDescription.removedFields");
  });
});
