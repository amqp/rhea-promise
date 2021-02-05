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

  it(".remove() removes event listeners", async () => {
    const receiver = await connection.createReceiver();
    receiver.on(rhea.ReceiverEvents.receiverOpen, () => {
      /** no-op */
    });

    assert.isAtLeast(receiver.listenerCount(rhea.ReceiverEvents.receiverOpen), 1);

    receiver.remove();

    assert.strictEqual(receiver.listenerCount(rhea.ReceiverEvents.receiverOpen), 0);
  });

  it(".close() removes event listeners", async () => {
    const receiver = await connection.createReceiver();
    receiver.on(rhea.ReceiverEvents.receiverOpen, () => {
      /** no-op */
    });

    assert.isAtLeast(receiver.listenerCount(rhea.ReceiverEvents.receiverOpen), 1);

    await receiver.close();

    assert.strictEqual(receiver.listenerCount(rhea.ReceiverEvents.receiverOpen), 0);
  });

  // TODO: This test fails because we first get a receiver_open event instead of
  // a receiver_close event which does get fired, but by then we have removed listeners
  // it("createReceiver() bubbles up error", async () => {
  //   const errorCondition = "amqp:connection:forced";
  //   const errorDescription = "testing error on create";
  //   mockService.on(
  //     rhea.SenderEvents.senderOpen,
  //     (context: rhea.EventContext) => {
  //       context.sender?.close({
  //         condition: errorCondition,
  //         description: errorDescription,
  //       });
  //     }
  //   );

  //   try {
  //     await connection.createReceiver();
  //     throw new Error("boo");
  //   } catch (error) {
  //     assert.exists(error, "Expected an AMQP error.");
  //     assert.strictEqual(error.condition, errorCondition);
  //     assert.strictEqual(error.description, errorDescription);
  //   }
  // });

  describe("supports events", () => {
    it("receiverError on receiver.close() is bubbled up", async () => {
      const errorCondition = "amqp:connection:forced";
      const errorDescription = "testing error on close";
      mockService.on(
        rhea.SenderEvents.senderClose,
        (context: rhea.EventContext) => {
          context.sender && context.sender.close({
            condition: errorCondition,
            description: errorDescription,
          });
        }
      );

      const receiver = await connection.createReceiver();

      try {
        await receiver.close();
        throw new Error("boo")
      } catch (error) {
        assert.exists(error, "Expected an AMQP error.");
        assert.strictEqual(error.condition, errorCondition);
        assert.strictEqual(error.description, errorDescription);
      }
    });
  });
});
