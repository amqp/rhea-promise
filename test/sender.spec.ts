import * as rhea from "rhea";
import { assert } from "chai";
import { Connection } from "../lib/index";

describe("Sender", () => {
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
    const sender = await connection.createSender();
    assert.isTrue(sender.isOpen(), "Sender should be open.");
    assert.isFalse(sender.isClosed(), "Sender should not be closed.");
    assert.isFalse(
      sender.isItselfClosed(),
      "Sender should not be fully closed."
    );

    await sender.close();
    assert.isTrue(sender.isClosed(), "Sender should be closed.");
    assert.isTrue(sender.isItselfClosed(), "Sender should be fully closed.");
    assert.isFalse(sender.isOpen(), "Sender should not be open.");
  });

  describe("supports events", () => {
    it("senderError on sender.close() is bubbled up", async () => {
      const errorCondition = "amqp:connection:forced";
      const errorDescription = "testing error on close";
      mockService.on(
        rhea.ReceiverEvents.receiverClose,
        (context: rhea.EventContext) => {
          context.receiver?.close({
            condition: errorCondition,
            description: errorDescription,
          });
        }
      );

      const sender = await connection.createSender();

      try {
        await sender.close();
        throw new Error("boo")
      } catch (error) {
        assert.exists(error, "Expected an AMQP error.");
        assert.strictEqual(error.condition, errorCondition);
        assert.strictEqual(error.description, errorDescription);
      }
    });
  });
});
