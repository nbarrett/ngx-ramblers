import expect from "expect";
import sinon from "sinon";
import { afterEach, describe, it } from "mocha";
import { BackupAndRestoreService } from "./backup-and-restore-service";
import { backupEvents } from "./backup-events";
import { backupSession } from "../mongo/models/backup-session";
import { BackupSessionStatus } from "../../../projects/ngx-ramblers/src/app/models/backup-session.model";

describe("backup database traffic", () => {
  const sandbox = sinon.createSandbox();
  const service = new BackupAndRestoreService([], {});

  afterEach(() => sandbox.restore());

  it("requests network compression alongside the existing connection timeouts", () => {
    const uri = service["buildMongoUriForConfig"]("cluster.example", "backup-user", "example-password", "group-example");
    const options = new URLSearchParams(uri.split("?")[1]);

    expect(options.get("compressors")).toEqual("zlib");
    expect(options.get("socketTimeoutMS")).toEqual("300000");
    expect(options.get("connectTimeoutMS")).toEqual("30000");
    expect(options.get("serverSelectionTimeoutMS")).toEqual("30000");
  });

  it("polls only status and error without transferring the accumulated logs", async () => {
    const result = { status: BackupSessionStatus.IN_PROGRESS };
    const lean = sandbox.stub().resolves(result);
    const select = sandbox.stub().returns({ lean });
    const findById = sandbox.stub(backupSession, "findById").returns({ select } as any);

    expect(await service.sessionStatus("example-session")).toEqual(result);
    expect(findById.calledOnceWithExactly("example-session")).toEqual(true);
    expect(select.calledOnceWithExactly({ status: 1, error: 1, _id: 0 })).toEqual(true);
  });

  it("does not reread the full session when nobody is watching backup progress", async () => {
    sandbox.stub(backupEvents, "listenerCount").returns(0);
    const findById = sandbox.stub(backupSession, "findById");

    await service["emitSessionUpdated"]("example-session");

    expect(findById.called).toEqual(false);
  });

  it("continues to publish full progress to a connected observer", async () => {
    const session = { status: BackupSessionStatus.IN_PROGRESS, logs: ["Dump started"] };
    sandbox.stub(backupEvents, "listenerCount").returns(1);
    sandbox.stub(backupSession, "findById").returns({ lean: sandbox.stub().resolves(session) } as any);
    const emit = sandbox.stub(backupEvents, "emit");

    await service["emitSessionUpdated"]("example-session");

    expect(emit.calledOnceWithExactly("session-updated", { session })).toEqual(true);
  });
});
