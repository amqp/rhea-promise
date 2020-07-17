import * as rhea from "rhea";
import { assert } from "chai";
import { Connection, SessionEvents, Session } from "../lib/index";

describe("Session", () => {
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
    const session = await connection.createSession();
    assert.isTrue(session.isOpen(), "Session should be open.");
    assert.isFalse(session.isClosed(), "Session should not be closed.");
    assert.isFalse(
      session.isItselfClosed(),
      "Session should not be fully closed."
    );

    await session.close();
    assert.isTrue(session.isClosed(), "Session should be closed.");
    assert.isTrue(session.isItselfClosed(), "Session should be fully closed.");
    assert.isFalse(session.isOpen(), "Session should not be open.");
  });

  it(".remove() removes event listeners", async () => {
    const session = new Session(
      connection,
      connection["_connection"].create_session()
    );

    session.on(SessionEvents.sessionOpen, () => {
      /** no-op */
    });

    assert.isAtLeast(session.listenerCount(SessionEvents.sessionOpen), 1);
    session.remove();
    assert.strictEqual(session.listenerCount(SessionEvents.sessionOpen), 0);
    await session.close();
  });

  describe("supports events", () => {
    it("sessionOpen", (done: Function) => {
      const session = new Session(
        connection,
        connection["_connection"].create_session()
      );

      session.on(SessionEvents.sessionOpen, async (event) => {
        assert.exists(event, "Expected an AMQP event.");
        assert.isTrue(session.isOpen(), "Expected session to be open.");
        assert.isFalse(
          session.isClosed(),
          "Expected session to not be closed."
        );
        await session.close();
        done();
      });

      // Open the session.
      session.begin();
    });
  });
});
