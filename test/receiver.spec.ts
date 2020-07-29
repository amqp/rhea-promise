import * as rhea from "rhea";
import { assert } from "chai";
import { Connection } from "../lib/index";

describe("Receiver", () => {
  let mockService: rhea.Container;
  let mockServiceListener: ReturnType<rhea.Container["listen"]>;
  let connection: Connection;

  beforeEach((done: Function) => {
    mockService = rhea.create_container();
    mockServiceListener = mockService.listen({ port: 0 });
    mockServiceListener.on("listening", async () => {
      connection = new Connection({
        port: mockServiceListener.address().port,
        reconnect: false,
      });
      await connection.open();
      done();
    });
  });

  afterEach(async () => {
    await connection.close();
    mockServiceListener.close();
  });

  it("can be opened and closed", async () => {
    const receiver = await connection.createReceiver();
    assert.isTrue(receiver.isOpen(), "Receiver should be open.");
    assert.isFalse(receiver.isClosed(), "Receiver should not be closed.");
    assert.isFalse(
      receiver.isItselfClosed(),
      "Receiver should not be fully closed."
    );

    await receiver.close();
    assert.isTrue(receiver.isClosed(), "Receiver should be closed.");
    assert.isTrue(receiver.isItselfClosed(), "Receiver should be fully closed.");
    assert.isFalse(receiver.isOpen(), "Receiver should not be open.");
  });
});
