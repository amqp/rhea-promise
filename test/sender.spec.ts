import * as rhea from "rhea";
import { assert } from "chai";
import { Connection, InsufficientCreditError } from "../lib/index";
import { AbortController } from "@azure/abort-controller";
import { abortErrorName } from "../lib/util/utils";

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

  it("Delivery returned from `AwaitableSender.send()` is not undefined", async () => {
    const sender = await connection.createAwaitableSender();
    const response = await sender.send({ body: "message" }, { timeoutInSeconds: 1});
    assert.exists(
      response,
      "Response from the AwaitableSender.send() is undefined"
    );
    assert.exists(
      response.id,
      "Delivery returned from the AwaitableSender.send() is undefined"
    );
    await sender.close();
  });

  it(".remove() removes event listeners", async () => {
    const sender = await connection.createSender();
    sender.on(rhea.SenderEvents.senderOpen, () => {
      /** no-op */
    });

    assert.isAtLeast(sender.listenerCount(rhea.SenderEvents.senderOpen), 1);

    sender.remove();

    assert.strictEqual(sender.listenerCount(rhea.SenderEvents.senderOpen), 0);
  });

  it(".close() removes event listeners", async () => {
    const sender = await connection.createSender();
    sender.on(rhea.SenderEvents.senderOpen, () => {
      /** no-op */
    });

    assert.isAtLeast(sender.listenerCount(rhea.SenderEvents.senderOpen), 1);

    await sender.close();

    assert.strictEqual(sender.listenerCount(rhea.SenderEvents.senderOpen), 0);
  });

  it("createSender() bubbles up error", async () => {
    const errorCondition = "amqp:connection:forced";
    const errorDescription = "testing error on create";
    mockService.on(
      rhea.ReceiverEvents.receiverOpen,
      (context: rhea.EventContext) => {
        context.receiver &&
          context.receiver.close({
            condition: errorCondition,
            description: errorDescription,
          });
      }
    );

    try {
      await connection.createSender();
      throw new Error("boo");
    } catch (error) {
      assert.exists(error, "Expected an AMQP error.");
      assert.strictEqual(error.condition, errorCondition);
      assert.strictEqual(error.description, errorDescription);
    }
  });

  it("InsufficientCreditError", async () => {
    const connection = new Connection({
      port: mockServiceListener.address().port,
      reconnect: false,
    });
    await connection.open();
    const sender = await connection.createAwaitableSender();
    sender.sendable = () => {
      return false;
    };

    let insufficientCreditErrorThrown = false;
    try {
      await sender.send({ body: "hello" });
    } catch (error) {
      insufficientCreditErrorThrown = error instanceof InsufficientCreditError;
    }

    assert.isTrue(
      insufficientCreditErrorThrown,
      "AbortError should have been thrown."
    );
    await connection.close();
  });

  describe("supports events", () => {
    it("senderError on sender.close() is bubbled up", async () => {
      const errorCondition = "amqp:connection:forced";
      const errorDescription = "testing error on close";
      mockService.on(
        rhea.ReceiverEvents.receiverClose,
        (context: rhea.EventContext) => {
          context.receiver &&
            context.receiver.close({
              condition: errorCondition,
              description: errorDescription,
            });
        }
      );

      const sender = await connection.createSender();

      try {
        await sender.close();
        throw new Error("boo");
      } catch (error) {
        assert.exists(error, "Expected an AMQP error.");
        assert.strictEqual(error.condition, errorCondition);
        assert.strictEqual(error.description, errorDescription);
      }
    });
  });

  describe("AbortSignal", () => {
    it("send() fails with aborted signal", async () => {
      const connection = new Connection({
        port: mockServiceListener.address().port,
        reconnect: false,
      });
      await connection.open();
      const sender = await connection.createAwaitableSender();

      const abortController = new AbortController();
      const abortSignal = abortController.signal;

      // Pass an already aborted signal to send()
      abortController.abort();
      const sendPromise = sender.send({ body: "hello" }, {
        abortSignal,
      });

      let abortErrorThrown = false;
      try {
        await sendPromise;
      } catch (error) {
        abortErrorThrown = error.name === abortErrorName;
      }

      assert.isTrue(abortErrorThrown, "AbortError should have been thrown.");
      await connection.close();
    });

    it("send() fails with aborted signal even when insufficient credits", async () => {
      const connection = new Connection({
        port: mockServiceListener.address().port,
        reconnect: false,
      });
      await connection.open();
      const sender = await connection.createAwaitableSender();
      sender.sendable = () => {
        return false;
      };

      const abortController = new AbortController();
      const abortSignal = abortController.signal;

      // Pass an already aborted signal to send()
      abortController.abort();
      const sendPromise = sender.send({ body: "hello" }, {
        abortSignal,
      });

      let abortErrorThrown = false;
      try {
        await sendPromise;
      } catch (error) {
        abortErrorThrown = error.name === abortErrorName;
      }

      assert.isTrue(abortErrorThrown, "AbortError should have been thrown.");
      await connection.close();
    });

    it("send() fails when abort signal is fired", async () => {
      const connection = new Connection({
        port: mockServiceListener.address().port,
        reconnect: false,
      });
      await connection.open();
      const sender = await connection.createAwaitableSender();

      const abortController = new AbortController();
      const abortSignal = abortController.signal;

      // Fire abort signal after passing it to send()
      const sendPromise = sender.send({ body: "hello" }, {
        abortSignal,
      });
      abortController.abort();

      let abortErrorThrown = false;
      try {
        await sendPromise;
      } catch (error) {
        abortErrorThrown = error.name === abortErrorName;
      }

      assert.isTrue(abortErrorThrown, "AbortError should have been thrown.");
      await connection.close();
    });
  });
});
