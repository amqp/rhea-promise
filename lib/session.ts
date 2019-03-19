// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the Apache License. See License in the project root for license information.

import * as log from "./log";
import { Connection } from "./connection";
import { Receiver, ReceiverOptions } from "./receiver";
import { Sender, SenderOptions } from "./sender";
import {
  SenderEvents, ReceiverEvents, SessionEvents, AmqpError, Session as RheaSession,
  EventContext as RheaEventContext
} from "rhea";
import { Func, EmitParameters, emitEvent } from "./util/utils";
import { OnAmqpEvent } from "./eventContext";
import { Entity } from "./entity";
import { OperationTimeoutError } from "./operationTimeoutError";

/**
 * Describes the event listeners that can be added to the Session.
 * @interface Session
 */
export declare interface Session {
  on(event: SessionEvents, listener: OnAmqpEvent): this;
}

/**
 * Describes the session that wraps the rhea session.
 * @class Session
 */
export class Session extends Entity {
  private _session: RheaSession;
  private _connection: Connection;

  constructor(connection: Connection, session: RheaSession) {
    super();
    this._connection = connection;
    this._session = session;
    this._initializeEventListeners();
  }
  /**
   * @property {Connection} connection The underlying AMQP connection.
   * @readonly
   */
  get connection(): Connection {
    return this._connection;
  }

  get outgoing(): any {
    return (this._session as any).outgoing;
  }

  get error(): AmqpError | Error | undefined {
    return this._session.error;
  }

  /**
   * Determines whether the session and the underlying connection is open.
   * @returns {boolean} result `true` - is open; `false` otherwise.
   */
  isOpen(): boolean {
    let result = false;
    if (this._connection.isOpen() && this._session.is_open()) {
      result = true;
    }
    return result;
  }

  /**
   * Determines whether the close from the peer is a response to a locally initiated close request.
   * @returns {boolean} `true` if close was locally initiated, `false` otherwise.
   */
  isClosed(): boolean {
    return this._session.is_closed();
  }

  /**
   * Determines whether both local and remote endpoint for just the session itself are closed.
   * Within the "session_close" event handler, if this method returns `false` it means that
   * the local end is still open. It can be useful to determine whether the close
   * was initiated locally under such circumstances.
   *
   * @returns {boolean} `true` - closed, `false` otherwise.
   */
  isItselfClosed(): boolean {
    return this._session.is_itself_closed();
  }

  /**
   * Removes the underlying amqp session from the internal map in rhea.
   * Also removes all the event handlers added in the rhea-promise library on the session.
   */
  remove(): void {
    if (this._session) {
      // Remove our listeners and listeners from rhea's 'session' object.
      this.removeAllListeners();
      this._session.removeAllListeners();
      this._session.remove();
    }
  }

  begin(): void {
    if (this._session) {
      this._session.begin();
    }
  }

  /**
   * Closes the underlying amqp session in rhea if open. Also removes all the event
   * handlers added in the rhea-promise library on the session
   * @return {Promise<void>} Promise<void>
   * - **Resolves** the promise when rhea emits the "session_close" event.
   * - **Rejects** the promise with an AmqpError when rhea emits the "session_error" event while trying
   * to close an amqp session.
   */
  close(): Promise<void> {
    this.removeAllListeners();
    return new Promise<void>((resolve, reject) => {
      log.error("[%s] The session is open ? -> %s", this.connection.id, this.isOpen());
      if (this.isOpen()) {
        let onError: Func<RheaEventContext, void>;
        let onClose: Func<RheaEventContext, void>;
        let waitTimer: any;

        const removeListeners = () => {
          clearTimeout(waitTimer);
          this.actionInitiated--;
          this._session.removeListener(SessionEvents.sessionError, onError);
          this._session.removeListener(SessionEvents.sessionClose, onClose);
        };

        onClose = (context: RheaEventContext) => {
          removeListeners();
          log.session("[%s] Resolving the promise as the amqp session has been closed.",
            this.connection.id);
          return resolve();
        };

        onError = (context: RheaEventContext) => {
          removeListeners();
          log.error("[%s] Error occurred while closing amqp session.",
            this.connection.id, context.session!.error);
          reject(context.session!.error);
        };

        const actionAfterTimeout = () => {
          removeListeners();
          const msg: string = `Unable to close the amqp session due to operation timeout.`;
          log.error("[%s] %s", this.connection.id, msg);
          reject(new OperationTimeoutError(msg));
        };

        // listeners that we add for completing the operation are added directly to rhea's objects.
        this._session.once(SessionEvents.sessionClose, onClose);
        this._session.once(SessionEvents.sessionError, onError);
        log.session("[%s] Calling session.close()", this.connection.id);
        waitTimer = setTimeout(actionAfterTimeout, this.connection.options!.operationTimeoutInSeconds! * 1000);
        this._session.close();
        this.actionInitiated++;
      } else {
        return resolve();
      }
    });
  }

  /**
   * Creates an amqp receiver on this session.
   * @param {Session} session The amqp session object on which the receiver link needs to be established.
   * @param {ReceiverOptions} [options] Options that can be provided while creating an amqp receiver.
   * @return {Promise<Receiver>} Promise<Receiver>
   * - **Resolves** the promise with the Receiver object when rhea emits the "receiver_open" event.
   * - **Rejects** the promise with an AmqpError when rhea emits the "receiver_close" event while trying
   * to create an amqp receiver or the operation timeout occurs.
   */
  createReceiver(options?: ReceiverOptions): Promise<Receiver> {
    return new Promise((resolve, reject) => {
      if (options &&
        ((options.onMessage && !options.onError) || (options.onError && !options.onMessage))) {
        if (options.credit_window !== 0) {
          // - If the 'onMessage' handler is not provided and the credit_window is not set to 0,
          // then messages may be lost between the receiver link getting created and the message
          // handler being attached.
          // - It can be possible for a service to initially accept the link attach, which would
          // cause the promise to resolve. However, moments later the service may send a detach
          // due to some internal or configuration issue. If no error handler is attached, then
          // the error may fall through.
          // - Hence it is advised to either provide both 'onMessage' and 'onError' handlers, or
          // please set the credit_window to `0`, if you want to provide only the 'onError' handler.
          return reject(new Error("Either provide both 'onMessage' and 'onError' handlers, or pl" +
            "ease set the credit_window to 0, if you want to provide only the 'onError' " +
            "handler. This ensures no messages are lost between the receiver getting created " +
            " and the 'onMessage' handler being added."));
        }
      }

      // Register session handlers for session_error and session_close if provided.
      // listeners provided by the user in the options object should be added
      // to our (rhea-promise) object.
      if (options && options.onSessionError) {
        this.on(SessionEvents.sessionError, options.onSessionError);
        log.session("[%s] Added event handler for event '%s' on rhea-promise 'session', " +
          "while creating the 'receiver'.", this.connection.id, SessionEvents.sessionError);
      }

      if (options && options.onSessionClose) {
        this.on(SessionEvents.sessionClose, options.onSessionClose);
        log.session("[%s] Added event handler for event '%s' on rhea-promise 'session', " +
          " while creating the 'receiver'.", this.connection.id, SessionEvents.sessionClose);
      }
      const rheaReceiver = this._session.attach_receiver(options);
      const receiver = new Receiver(this, rheaReceiver, options);
      receiver.actionInitiated++;
      let onOpen: Func<RheaEventContext, void>;
      let onClose: Func<RheaEventContext, void>;
      let waitTimer: any;

      if (options && options.onMessage) {
        receiver.on(ReceiverEvents.message, options.onMessage);
        log.receiver("[%s] Added event handler for event '%s' on rhea-promise 'receiver'.",
          this.connection.id, ReceiverEvents.message);
      }
      if (options && options.onError) {
        receiver.on(ReceiverEvents.receiverError, options.onError);
        log.receiver("[%s] Added event handler for event '%s' on rhea-promise 'receiver'.",
          this.connection.id, ReceiverEvents.receiverError);
      }

      if (options && options.onClose) {
        receiver.on(ReceiverEvents.receiverClose, options.onClose);
        log.receiver("[%s] Added event handler for event '%s' on rhea-promise 'receiver'.",
          this.connection.id, ReceiverEvents.receiverClose);
      }

      if (options && options.onSettled) {
        receiver.on(ReceiverEvents.settled, options.onSettled);
        log.receiver("[%s] Added event handler for event '%s' on rhea-promise 'receiver'.",
          this.connection.id, ReceiverEvents.settled);
      }

      const removeListeners = () => {
        clearTimeout(waitTimer);
        receiver.actionInitiated--;
        rheaReceiver.removeListener(ReceiverEvents.receiverOpen, onOpen);
        rheaReceiver.removeListener(ReceiverEvents.receiverClose, onClose);
      };

      onOpen = (context: RheaEventContext) => {
        removeListeners();
        log.receiver("[%s] Resolving the promise with amqp receiver '%s'.",
          this.connection.id, receiver.name);
        return resolve(receiver);
      };

      onClose = (context: RheaEventContext) => {
        removeListeners();
        log.error("[%s] Error occurred while creating a receiver over amqp connection: %O.",
          this.connection.id, context.receiver!.error);
        return reject(context.receiver!.error);
      };

      const actionAfterTimeout = () => {
        removeListeners();
        const msg: string = `Unable to create the amqp receiver ${receiver.name} due to ` +
          `operation timeout.`;
        log.error("[%s] %s", this.connection.id, msg);
        return reject(new OperationTimeoutError(msg));
      };

      // listeners that we add for completing the operation are added directly to rhea's objects.
      rheaReceiver.once(ReceiverEvents.receiverOpen, onOpen);
      rheaReceiver.once(ReceiverEvents.receiverClose, onClose);
      waitTimer = setTimeout(actionAfterTimeout, this.connection.options!.operationTimeoutInSeconds! * 1000);
    });
  }

  /**
   * Creates an amqp sender on this session.
   * @param {SenderOptions} [options] Options that can be provided while creating an amqp sender.
   * @return {Promise<Sender>} Promise<Sender>
   * - **Resolves** the promise with the Sender object when rhea emits the "sender_open" event.
   * - **Rejects** the promise with an AmqpError when rhea emits the "sender_close" event while trying
   * to create an amqp sender or the operation timeout occurs.
   */
  createSender(options?: SenderOptions): Promise<Sender> {
    return new Promise((resolve, reject) => {
      // Register session handlers for session_error and session_close if provided.
      if (options && options.onSessionError) {
        this.on(SessionEvents.sessionError, options.onSessionError);
        log.session("[%s] Added event handler for event '%s' on rhea-promise 'session', " +
          "while creating the sender.", this.connection.id, SessionEvents.sessionError);
      }

      if (options && options.onSessionClose) {
        this.on(SessionEvents.sessionClose, options.onSessionClose);
        log.session("[%s] Added event handler for event '%s' on rhea-promise 'session', " +
          "while creating the sender.", this.connection.id, SessionEvents.sessionClose);
      }

      const rheaSender = this._session.attach_sender(options);
      const sender = new Sender(this, rheaSender, options);
      sender.actionInitiated++;
      let onSendable: Func<RheaEventContext, void>;
      let onClose: Func<RheaEventContext, void>;
      let waitTimer: any;

      // listeners provided by the user in the options object should be added
      // to our (rhea-promise) object.
      if (options) {
        if (options.onError) {
          sender.on(SenderEvents.senderError, options.onError);
        }
        if (options.onClose) {
          sender.on(SenderEvents.senderClose, options.onClose);
        }
        if (options.onAccepted) {
          sender.on(SenderEvents.accepted, options.onAccepted);
        }
        if (options.onRejected) {
          sender.on(SenderEvents.rejected, options.onRejected);
        }
        if (options.onReleased) {
          sender.on(SenderEvents.released, options.onReleased);
        }
        if (options.onModified) {
          sender.on(SenderEvents.modified, options.onModified);
        }
      }

      const removeListeners = () => {
        clearTimeout(waitTimer);
        sender.actionInitiated--;
        rheaSender.removeListener(SenderEvents.senderOpen, onSendable);
        rheaSender.removeListener(SenderEvents.senderClose, onClose);
      };

      onSendable = (context: RheaEventContext) => {
        removeListeners();
        log.sender("[%s] Resolving the promise with amqp sender '%s'.",
          this.connection.id, sender.name);
        return resolve(sender);
      };

      onClose = (context: RheaEventContext) => {
        removeListeners();
        log.error("[%s] Error occurred while creating a sender over amqp connection: %O.",
          this.connection.id, context.sender!.error);
        return reject(context.sender!.error);
      };

      const actionAfterTimeout = () => {
        removeListeners();
        const msg: string = `Unable to create the amqp sender ${sender.name} due to ` +
          `operation timeout.`;
        log.error("[%s] %s", this.connection.id, msg);
        return reject(new OperationTimeoutError(msg));
      };

      // listeners that we add for completing the operation are added directly to rhea's objects.
      rheaSender.once(SenderEvents.sendable, onSendable);
      rheaSender.once(SenderEvents.senderClose, onClose);
      waitTimer = setTimeout(actionAfterTimeout, this.connection.options!.operationTimeoutInSeconds! * 1000);
    });
  }

  /**
   * Adds event listeners for the possible events that can occur on the session object and
   * re-emits the same event back with the received arguments from rhea's event emitter.
   * @private
   * @returns {void} void
   */
  private _initializeEventListeners(): void {

    for (const eventName in SessionEvents) {
      this._session.on(SessionEvents[eventName],
        (context) => {
          const params: EmitParameters = {
            rheaContext: context,
            emitter: this,
            eventName: SessionEvents[eventName],
            emitterType: "session",
            connectionId: this.connection.id
          };
          emitEvent(params);
        });
    }

    // Add event handlers for *_error and *_close events that can be propogated to the session
    // object, if they are not handled at their level. * denotes - Sender and Receiver.

    // Sender
    this._session.on(SenderEvents.senderError, (context) => {
      const params: EmitParameters = {
        rheaContext: context,
        emitter: this,
        eventName: SenderEvents.senderError,
        emitterType: "session",
        connectionId: this.connection.id
      };
      emitEvent(params);
    });
    this._session.on(SenderEvents.senderClose, (context) => {
      const params: EmitParameters = {
        rheaContext: context,
        emitter: this,
        eventName: SenderEvents.senderClose,
        emitterType: "session",
        connectionId: this.connection.id
      };
      emitEvent(params);
    });

    // Receiver
    this._session.on(ReceiverEvents.receiverError, (context) => {
      const params: EmitParameters = {
        rheaContext: context,
        emitter: this,
        eventName: ReceiverEvents.receiverError,
        emitterType: "session",
        connectionId: this.connection.id
      };
      emitEvent(params);
    });
    this._session.on(ReceiverEvents.receiverClose, (context) => {
      const params: EmitParameters = {
        rheaContext: context,
        emitter: this,
        eventName: ReceiverEvents.receiverClose,
        emitterType: "session",
        connectionId: this.connection.id
      };
      emitEvent(params);
    });
    if (typeof this._session.eventNames === "function") {
      log.eventHandler("[%s] rhea-promise 'session' object is listening for events: %o " +
        "emitted by rhea's 'session' object.", this.connection.id, this._session.eventNames());
    }
  }
}
