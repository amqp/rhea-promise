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

    it("connectionError", (done: Function) => {
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

    it("connectionError", (done: Function) => {
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
  });
});
