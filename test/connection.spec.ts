import * as rhea from "rhea";
import { assert } from "chai";
import { Connection, ConnectionEvents } from "../lib/index";
import { AbortController } from "@azure/abort-controller";
import { abortErrorName } from "../lib/util/utils";

describe("Connection", () => {
  let mockService: rhea.Container;
  let mockServiceListener: ReturnType<rhea.Container["listen"]>;

  beforeEach((done: Function) => {
    mockService = rhea.create_container();
    mockServiceListener = mockService.listen({ port: 0 });
    mockServiceListener.on("listening", () => {
      done();
    });
  });

  afterEach(() => {
    mockServiceListener.close();
  });

  it("can be opened and closed", async () => {
    const connection = new Connection({
      port: mockServiceListener.address().port,
    });

    await connection.open();
    assert.isTrue(connection.isOpen(), "Connection should be open.");
    assert.isTrue(
      connection.isRemoteOpen(),
      "Connection should be established."
    );
    await connection.close();
    assert.isFalse(
      connection.isRemoteOpen(),
      "Connection should be disconnected."
    );
    assert.isFalse(connection.isOpen(), "Connection should be closed.");
  });

  it("createSession()", async () => {
    const connection = new Connection({
      port: mockServiceListener.address().port,
    });

    await connection.open();
    assert.isTrue(connection.isOpen(), "Connection should be open.");

    const session = await connection.createSession();
    assert.isTrue(session.isOpen(), "Session should be open.");

    await connection.close();
    assert.isFalse(session.isOpen(), "Session should be not be open after connection closed.");
  });

  it("createSender()", async () => {
    const connection = new Connection({
      port: mockServiceListener.address().port,
    });

    await connection.open();
    assert.isTrue(connection.isOpen(), "Connection should be open.");

    const sender = await connection.createSender();
    assert.isTrue(sender.isOpen(), "Sender should be open.");

    await connection.close();
    assert.isFalse(sender.isOpen(), "Sender should be not be open after connection closed.");
  });

  it("createSender() with given session", async () => {
    const connection = new Connection({
      port: mockServiceListener.address().port,
    });

    await connection.open();
    assert.isTrue(connection.isOpen(), "Connection should be open.");

    const session = await connection.createSession();
    assert.isTrue(session.isOpen(), "Session should be open.");

    const sender = await connection.createSender({ session });
    assert.isTrue(sender.isOpen(), "Sender should be open.");
    assert.equal(sender.session, session, "Session of sender should be the same as the session passed to createSender()");

    await connection.close();
    assert.isFalse(sender.isOpen(), "Sender should be not be open after connection closed.");
  });

  it("createAwaitableSender()", async () => {
    const connection = new Connection({
      port: mockServiceListener.address().port,
    });

    await connection.open();
    assert.isTrue(connection.isOpen(), "Connection should be open.");

    const sender = await connection.createAwaitableSender();
    assert.isTrue(sender.isOpen(), "Sender should be open.");

    await connection.close();
    assert.isFalse(sender.isOpen(), "Sender should be not be open after connection closed.");
  });

  it("createAwaitableSender() with given session", async () => {
    const connection = new Connection({
      port: mockServiceListener.address().port,
    });

    await connection.open();
    assert.isTrue(connection.isOpen(), "Connection should be open.");

    const session = await connection.createSession();
    assert.isTrue(session.isOpen(), "Session should be open.");

    const sender = await connection.createAwaitableSender({ session });
    assert.isTrue(sender.isOpen(), "Sender should be open.");
    assert.equal(sender.session, session, "Session of sender should be the same as the session passed to createSender()");

    await connection.close();
    assert.isFalse(sender.isOpen(), "Sender should be not be open after connection closed.");
  });

  it("createReceiver()", async () => {
    const connection = new Connection({
      port: mockServiceListener.address().port,
    });

    await connection.open();
    assert.isTrue(connection.isOpen(), "Connection should be open.");

    const receiver = await connection.createReceiver();
    assert.isTrue(receiver.isOpen(), "Receiver should be open.");

    await connection.close();
    assert.isFalse(receiver.isOpen(), "Receiver should be not be open after connection closed.");
  });

  it("createReceiver() with given session", async () => {
    const connection = new Connection({
      port: mockServiceListener.address().port,
    });

    await connection.open();
    assert.isTrue(connection.isOpen(), "Connection should be open.");

    const session = await connection.createSession();
    assert.isTrue(session.isOpen(), "Session should be open.");

    const receiver = await connection.createReceiver({ session });
    assert.isTrue(receiver.isOpen(), "Receiver should be open.");
    assert.equal(receiver.session, session, "Session of receiver should be the same as the session passed to createReceiver()");

    await connection.close();
    assert.isFalse(receiver.isOpen(), "Receiver should be not be open after connection closed.");
  });

  it("createRequestResponseLink()", async () => {
    const connection = new Connection({
      port: mockServiceListener.address().port,
    });

    await connection.open();
    assert.isTrue(connection.isOpen(), "Connection should be open.");

    const requestResponseLink = await connection.createRequestResponseLink({}, {});

    assert.isTrue(requestResponseLink.session.isOpen(), "Session should be open.");
    assert.isTrue(requestResponseLink.receiver.isOpen(), "Receiver should be open.");
    assert.isTrue(requestResponseLink.sender.isOpen(), "Sender should be open.");

    await connection.close();
    assert.isFalse(requestResponseLink.session.isOpen(), "Session should be not be open after connection closed.");
    assert.isFalse(requestResponseLink.receiver.isOpen(), "Receiver should be not be open after connection closed.");
    assert.isFalse(requestResponseLink.sender.isOpen(), "Sender should be not be open after connection closed.");
  });

  it("createRequestResponseLink() with given session", async () => {
    const connection = new Connection({
      port: mockServiceListener.address().port,
    });

    await connection.open();
    assert.isTrue(connection.isOpen(), "Connection should be open.");

    const session = await connection.createSession();
    assert.isTrue(session.isOpen(), "Session should be open.");

    const requestResponseLink = await connection.createRequestResponseLink({}, {}, {session});

    assert.isTrue(requestResponseLink.session.isOpen(), "Session should be open.");
    assert.isTrue(requestResponseLink.receiver.isOpen(), "Receiver should be open.");
    assert.isTrue(requestResponseLink.sender.isOpen(), "Sender should be open.");
    assert.equal(requestResponseLink.session, session, "Session of requestResponseLink should be the same as the session passed to createRequestResponseLink()");

    await connection.close();
    assert.isFalse(requestResponseLink.session.isOpen(), "Session should be not be open after connection closed.");
    assert.isFalse(requestResponseLink.receiver.isOpen(), "Receiver should be not be open after connection closed.");
    assert.isFalse(requestResponseLink.sender.isOpen(), "Sender should be not be open after connection closed.");
  });

  describe("supports events", () => {
    it("connectionOpen", (done: Function) => {
      const connection = new Connection({
        port: mockServiceListener.address().port,
      });

      connection.on(ConnectionEvents.connectionOpen, async (event) => {
        assert.exists(event, "Expected an AMQP event.");
        await connection.close();
        done();
      });
      connection.open();
    });

    it("connectionClose", (done: Function) => {
      const connection = new Connection({
        port: mockServiceListener.address().port,
      });

      connection.on(ConnectionEvents.connectionClose, (event) => {
        assert.exists(event, "Expected an AMQP event.");
        done();
      });

      (async function run() {
        await connection.open();
        await connection.close();
      })();
    });

    it("connectionError on connection open", (done: Function) => {
      const errorCondition = "amqp:connection:forced";
      const errorDescription = "testing error on close";
      mockService.on(
        rhea.ConnectionEvents.connectionOpen,
        (context: rhea.EventContext) => {
          context.connection.close({
            condition: errorCondition,
            description: errorDescription,
          });
        }
      );

      const connection = new Connection({
        port: mockServiceListener.address().port,
        reconnect: false,
      });

      connection.on(ConnectionEvents.connectionError, async (event) => {
        assert.exists(event, "Expected an AMQP event.");
        const error = event.error as rhea.ConnectionError;
        assert.exists(error, "Expected an AMQP error.");
        assert.strictEqual(error.condition, errorCondition);
        assert.strictEqual(error.description, errorDescription);
        await connection.close();
        done();
      });

      connection.open();
    });

    it("disconnected", (done: Function) => {
      mockService.on(
        rhea.ConnectionEvents.connectionOpen,
        (context: rhea.EventContext) => {
          context.connection.close({
            condition: "amqp:connection:forced",
            description: "testing error on close",
          });
        }
      );

      const connection = new Connection({
        port: mockServiceListener.address().port,
        reconnect: false,
      });

      connection.on(ConnectionEvents.disconnected, async (event) => {
        assert.exists(event, "Expected an AMQP event.");
        await connection.close();
        done();
      });

      connection.open();
    });

    it("connectionError on connection.close() is bubbled up", (done: Function) => {
      const errorCondition = "amqp:connection:forced";
      const errorDescription = "testing error on close";
      mockService.on(
        rhea.ConnectionEvents.connectionClose,
        (context: rhea.EventContext) => {
          context.connection.close({
            condition: errorCondition,
            description: errorDescription,
          });
        }
      );

      const connection = new Connection({
        port: mockServiceListener.address().port,
        reconnect: false,
      });

      connection.on(ConnectionEvents.connectionOpen, async (event) => {
        assert.exists(event, "Expected an AMQP event.");
        try {
          await connection.close();
          throw new Error("boo")
        } catch (error) {
          assert.exists(error, "Expected an AMQP error.");
          assert.strictEqual(error.condition, errorCondition);
          assert.strictEqual(error.description, errorDescription);
        }
        done();
      });

      connection.open();



    });
  });

  describe("AbortError", () => {
    it("connection.open() fails with aborted signal", async () => {
      const connection = new Connection({
        port: mockServiceListener.address().port,
        reconnect: false,
      });

      const abortController = new AbortController();
      const abortSignal = abortController.signal;

      // Pass an already aborted signal to open()
      abortController.abort();
      const connectionOpenPromise = connection.open({ abortSignal });

      let abortErrorThrown = false;
      try {
        await connectionOpenPromise;
      } catch (error) {
        abortErrorThrown = error.name === abortErrorName;
      }

      assert.isTrue(abortErrorThrown, "AbortError should have been thrown.")
      assert.isFalse(connection.isOpen(), "Connection should not be open.");
    });

    it("connection.open() fails when abort signal is fired", async () => {
      const connection = new Connection({
        port: mockServiceListener.address().port,
        reconnect: false,
      });

      const abortController = new AbortController();
      const abortSignal = abortController.signal;

      // Abort the signal after passing it to open()
      const connectionOpenPromise = connection.open({ abortSignal });
      abortController.abort();

      let abortErrorThrown = false;
      try {
        await connectionOpenPromise;
      } catch (error) {
        abortErrorThrown = error.name === abortErrorName;
      }

      assert.isTrue(abortErrorThrown, "AbortError should have been thrown.")
      assert.isFalse(connection.isOpen(), "Connection should not be open.");
    });

    it("connection.close() fails with aborted signal", async () => {
      const connection = new Connection({
        port: mockServiceListener.address().port,
        reconnect: false,
      });

      await connection.open();
      assert.isTrue(connection.isOpen(), "Connection should be open.");

      const abortController = new AbortController();
      const abortSignal = abortController.signal;

      // Pass an already aborted signal to close()
      abortController.abort();
      const connectionClosePromise = connection.close({ abortSignal });

      let abortErrorThrown = false;
      try {
        await connectionClosePromise;
      } catch (error) {
        abortErrorThrown = error.name === abortErrorName;
      }

      assert.isTrue(abortErrorThrown, "AbortError should have been thrown.")
      assert.isFalse(connection.isOpen(), "Connection should not be open.");
      assert.isTrue(connection.isRemoteOpen(), "Connection remote endpoint should not have gotten a chance to close.");
    });

    it("connection.close() fails when abort signal is fired", async () => {
      const connection = new Connection({
        port: mockServiceListener.address().port,
        reconnect: false,
      });

      await connection.open();
      assert.isTrue(connection.isOpen(), "Connection should be open.");

      const abortController = new AbortController();
      const abortSignal = abortController.signal;

      // Abort the signal after passing it to open()
      const connectionClosePromise = connection.close({ abortSignal });
      abortController.abort();

      let abortErrorThrown = false;
      try {
        await connectionClosePromise;
      } catch (error) {
        abortErrorThrown = error.name === abortErrorName;
      }

      assert.isTrue(abortErrorThrown, "AbortError should have been thrown.")
      assert.isFalse(connection.isOpen(), "Connection should not be open.");
      assert.isTrue(connection.isRemoteOpen(), "Connection remote endpoint should not have gotten a chance to close.");
    });

    it("createSession() fails with aborted signal", async () => {
      const connection = new Connection({
        port: mockServiceListener.address().port,
        reconnect: false,
      });
      await connection.open();

      const abortController = new AbortController();
      const abortSignal = abortController.signal;

      // Pass an already aborted signal to createSession()
      abortController.abort();
      const createSessionPromise = connection.createSession({ abortSignal });

      let abortErrorThrown = false;
      try {
        await createSessionPromise
      } catch (error) {
        abortErrorThrown = error.name === abortErrorName;
      }

      assert.isTrue(abortErrorThrown, "AbortError should have been thrown.");
      const sessionMap = (connection["_connection"] as any)["local_channel_map"];
      assert.deepEqual(sessionMap, {});
      await connection.close();
    });

    it("createSession() fails when abort signal is fired", async () => {
      const connection = new Connection({
        port: mockServiceListener.address().port,
        reconnect: false,
      });
      await connection.open();

      const abortController = new AbortController();
      const abortSignal = abortController.signal;

      // Abort the signal after passing it to createSession()
      const createSessionPromise = connection.createSession({ abortSignal });
      abortController.abort();

      let abortErrorThrown = false;
      try {
        await createSessionPromise
      } catch (error) {
        abortErrorThrown = error.name === abortErrorName;
      }

      assert.isTrue(abortErrorThrown, "AbortError should have been thrown.");
      const sessionMap = (connection["_connection"] as any)["local_channel_map"];
      // There should be at most 1 session.
      const [sessionName] = Object.keys(sessionMap);
      const session = sessionName && sessionMap[sessionName];
      if (!session.is_closed()) {
        await new Promise(resolve => {
          session.once(rhea.SessionEvents.sessionClose, resolve);
        });
      }
      assert.isTrue(session.is_closed(), "Session should be closed.");
      assert.deepEqual(sessionMap, {});
      await connection.close();
    });

    it("createSender() fails with aborted signal", async () => {
      const connection = new Connection({
        port: mockServiceListener.address().port,
        reconnect: false,
      });
      await connection.open();

      const abortController = new AbortController();
      const abortSignal = abortController.signal;

      // Pass an already aborted signal to createSender()
      abortController.abort();
      const createSenderPromise = connection.createSender({ abortSignal });

      let abortErrorThrown = false;
      try {
        await createSenderPromise;
      } catch (error) {
        abortErrorThrown = error.name === abortErrorName;
      }

      assert.isTrue(abortErrorThrown, "AbortError should have been thrown.");
      await connection.close();
    });

    it("createSender() fails when abort signal is fired", async () => {
      const connection = new Connection({
        port: mockServiceListener.address().port,
        reconnect: false,
      });
      await connection.open();

      const abortController = new AbortController();
      const abortSignal = abortController.signal;

      // Abort the signal after passing it to createSender()
      const createSenderPromise = connection.createSender({ abortSignal });
      abortController.abort();

      let abortErrorThrown = false;
      try {
        await createSenderPromise;
      } catch (error) {
        abortErrorThrown = error.name === abortErrorName;
      }

      assert.isTrue(abortErrorThrown, "AbortError should have been thrown.");
      await connection.close();
    });

    it("createAwaitableSender() fails with aborted signal", async () => {
      const connection = new Connection({
        port: mockServiceListener.address().port,
        reconnect: false,
      });
      await connection.open();

      const abortController = new AbortController();
      const abortSignal = abortController.signal;

      // Pass an already aborted signal to createAwaitableSender()
      abortController.abort();
      const createAwaitableSenderPromise = connection.createAwaitableSender({ abortSignal });

      let abortErrorThrown = false;
      try {
        await createAwaitableSenderPromise;
      } catch (error) {
        abortErrorThrown = error.name === abortErrorName;
      }

      assert.isTrue(abortErrorThrown, "AbortError should have been thrown.");
      await connection.close();
    });

    it("createAwaitableSender() fails when abort signal is fired", async () => {
      const connection = new Connection({
        port: mockServiceListener.address().port,
        reconnect: false,
      });
      await connection.open();

      const abortController = new AbortController();
      const abortSignal = abortController.signal;

      // Abort the signal after passing it to createAwaitableSender()
      const createAwaitableSenderPromise = connection.createAwaitableSender({ abortSignal });
      abortController.abort();

      let abortErrorThrown = false;
      try {
        await createAwaitableSenderPromise;
      } catch (error) {
        abortErrorThrown = error.name === abortErrorName;
      }

      assert.isTrue(abortErrorThrown, "AbortError should have been thrown.");
      await connection.close();
    });

    it("createReceiver() fails with aborted signal", async () => {
      const connection = new Connection({
        port: mockServiceListener.address().port,
        reconnect: false,
      });
      await connection.open();

      const abortController = new AbortController();
      const abortSignal = abortController.signal;

      // Pass an already aborted signal to createReceiver()
      abortController.abort();
      const createReceiverPromise = connection.createReceiver({ abortSignal });

      let abortErrorThrown = false;
      try {
        await createReceiverPromise;
      } catch (error) {
        abortErrorThrown = error.name === abortErrorName;
      }

      assert.isTrue(abortErrorThrown, "AbortError should have been thrown.");
      await connection.close();
    });

    it("createReceiver() fails when abort signal is fired", async () => {
      const connection = new Connection({
        port: mockServiceListener.address().port,
        reconnect: false,
      });
      await connection.open();

      const abortController = new AbortController();
      const abortSignal = abortController.signal;

      // Abort the signal after passing it to createReceiver()
      const createReceiverPromise = connection.createReceiver({ abortSignal });
      abortController.abort();

      let abortErrorThrown = false;
      try {
        await createReceiverPromise;
      } catch (error) {
        abortErrorThrown = error.name === abortErrorName;
      }

      assert.isTrue(abortErrorThrown, "AbortError should have been thrown.");
      await connection.close();
    });

    it("createRequestResponseLink() fails with aborted signal", async () => {
      const connection = new Connection({
        port: mockServiceListener.address().port,
        reconnect: false,
      });
      await connection.open();

      const abortController = new AbortController();
      const abortSignal = abortController.signal;

      // Pass an already aborted signal to createReceiver()
      abortController.abort();
      const createPromise = connection.createRequestResponseLink({}, {}, {abortSignal});

      let abortErrorThrown = false;
      try {
        await createPromise;
      } catch (error) {
        abortErrorThrown = error.name === abortErrorName;
      }

      assert.isTrue(abortErrorThrown, "AbortError should have been thrown.");
      await connection.close();
    });

    it("createRequestResponseLink() fails when abort signal is fired", async () => {
      const connection = new Connection({
        port: mockServiceListener.address().port,
        reconnect: false,
      });
      await connection.open();

      const abortController = new AbortController();
      const abortSignal = abortController.signal;

      // Abort the signal after passing it to createReceiver()
      const createPromise = connection.createRequestResponseLink({}, {}, {abortSignal});
      abortController.abort();

      let abortErrorThrown = false;
      try {
        await createPromise;
      } catch (error) {
        abortErrorThrown = error.name === abortErrorName;
      }

      assert.isTrue(abortErrorThrown, "AbortError should have been thrown.");
      await connection.close();
    });
  })
});
