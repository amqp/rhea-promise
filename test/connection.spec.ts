import * as rhea from "rhea";
import { assert } from "chai";
import { Connection, ConnectionEvents } from "../lib/index";

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

    const requestResponseLink = await connection.createRequestResponseLink({}, {}, session);

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
});
