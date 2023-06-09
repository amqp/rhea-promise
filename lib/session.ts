// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the Apache License. See License in the project root for license information.

import * as log from "./log";
import { Connection } from "./connection";
import { Receiver, ReceiverOptions } from "./receiver";
import { Sender, SenderOptions } from "./sender";
import {
  SenderEvents, ReceiverEvents, SessionEvents, AmqpError, Session as RheaSession,
  EventContext as RheaEventContext, ConnectionEvents
} from "rhea";
import { Func, EmitParameters, emitEvent, createAbortError, AbortSignalLike } from "./util/utils";
import { OnAmqpEvent } from "./eventContext";
import { Entity } from "./entity";
import { OperationTimeoutError } from "./errorDefinitions";
import { AwaitableSender, AwaitableSenderOptions } from "./awaitableSender";

/**
 * Describes the event listeners that can be added to the Session.
 * @interface Session
 */
export declare interface Session {
  on(event: SessionEvents, listener: OnAmqpEvent): this;
}

/**
 * Set of options to use when running session.close()
 */
export interface SessionCloseOptions {
  abortSignal?: AbortSignalLike;
}

/**
 * @internal
 */
enum SenderType {
  sender = "sender",
  AwaitableSender = "AwaitableSender"
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

  get incoming(): { deliveries: { size: number; capacity: number } } {
    return (this._session as any).incoming;
  }

  get outgoing(): any {
    return (this._session as any).outgoing;
  }

  get error(): AmqpError | Error | undefined {
    return this._session.error;
  }

  /**
   * Returns the unique identifier for the session in the format:
   * "local_<number>-remote_<number>-<connection-id>" or an empty string if the local channel or
   * remote channel are not yet defined.
   */
  get id(): string {
    let result = "";
    const session: any = this._session;
    if (session.local) {
      result += `local-${session.local.channel}_`;
    }

    if (session.remote) {
      result += `remote-${session.remote.channel}_`;
    }

    if (result) {
      result += `${this._connection.id}`;
    }

    return result;
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
   * @param options A set of options including a signal used to cancel the operation.
   * When the abort signal in the options is fired, the local endpoint is closed.
   * This does not guarantee that the remote has closed as well. It only stops listening for
   * an acknowledgement that the remote endpoint is closed as well.
   * @return {Promise<void>} Promise<void>
   * - **Resolves** the promise when rhea emits the "session_close" event.
   * - **Rejects** the promise with an AmqpError when rhea emits the "session_error" event while trying
   * to close an amqp session or with an AbortError if the operation was cancelled.
   */
  async close(options?: SessionCloseOptions): Promise<void> {

    const closePromise = new Promise<void>((resolve, reject) => {
      log.error("[%s] The amqp session '%s' is open ? -> %s", this.connection.id, this.id, this.isOpen());
      if (this.isOpen()) {
        // let onError: Func<RheaEventContext, void>;
        // let onClose: Func<RheaEventContext, void>;
        // let onDisconnected: Func<RheaEventContext, void>;
        // let onAbort: Func<void, void>;
        const abortSignal = options && options.abortSignal;
        // let waitTimer: any;

        const removeListeners = () => {
          clearTimeout(waitTimer);
          this.actionInitiated--;
          this._session.removeListener(SessionEvents.sessionError, onError);
          this._session.removeListener(SessionEvents.sessionClose, onClose);
          this._session.connection.removeListener(ConnectionEvents.disconnected, onDisconnected);
          if (abortSignal) {
            abortSignal.removeEventListener("abort", onAbort);
          }
        };

        const onClose = (context: RheaEventContext) => {
          removeListeners();
          log.session("[%s] Resolving the promise as the amqp session '%s' has been closed.",
            this.connection.id, this.id);
          return resolve();
        };

        const onError = (context: RheaEventContext) => {
          removeListeners();
          log.error("[%s] Error occurred while closing amqp session '%s'.",
            this.connection.id, this.id, context.session!.error);
          reject(context.session!.error);
        };

        const onDisconnected = (context: RheaEventContext) => {
          removeListeners();
          const error = context.connection && context.connection.error
            ? context.connection.error
            : context.error;
          log.error("[%s] Connection got disconnected while closing amqp session '%s': %O.",
            this.connection.id, this.id, error);
        };

        const onAbort = () => {
          removeListeners();
          const err = createAbortError();
          log.error("[%s] [%s]", this.connection.id, err.message);
          return reject(err);
        };

        const actionAfterTimeout = () => {
          removeListeners();
          const msg = `Unable to close the amqp session ${this.id} due to operation timeout.`;
          log.error("[%s] %s", this.connection.id, msg);
          reject(new OperationTimeoutError(msg));
        };

        // listeners that we add for completing the operation are added directly to rhea's objects.
        this._session.once(SessionEvents.sessionClose, onClose);
        this._session.once(SessionEvents.sessionError, onError);
        this._session.connection.once(ConnectionEvents.disconnected, onDisconnected);
        log.session("[%s] Calling session.close() for amqp session '%s'.", this.connection.id, this.id);
        const waitTimer = setTimeout(actionAfterTimeout, this.connection.options!.operationTimeoutInSeconds! * 1000);
        this._session.close();
        this.actionInitiated++;

        if (abortSignal) {
          if (abortSignal.aborted) {
            onAbort();
          } else {
            abortSignal.addEventListener("abort", onAbort);
          }
        }
      } else {
        return resolve();
      }
    });

    try {
      await closePromise;
    } finally {
      this.removeAllListeners();
    }

  }

  /**
   * Creates an amqp receiver on this session.
   * @param session The amqp session object on which the receiver link needs to be established.
   * @param options Options that can be provided while creating an amqp receiver.
   * @return Promise<Receiver>
   * - **Resolves** the promise with the Receiver object when rhea emits the "receiver_open" event.
   * - **Rejects** the promise with an AmqpError when rhea emits the "receiver_close" event while trying
   * to create an amqp receiver or the operation timeout occurs.
   */
  createReceiver(options?: ReceiverOptions & { abortSignal?: AbortSignalLike }): Promise<Receiver> {
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

      const abortSignal = options && options.abortSignal;
      let onAbort: Func<void, void>;
      if (abortSignal) {
        const rejectOnAbort = () => {
          const err = createAbortError();
          log.error("[%s] [%s]", this.connection.id, err.message);
          return reject(err);
        };

        onAbort = () => {
          removeListeners();
          if (rheaReceiver.is_open()) {
            // This scenario *shouldn't* be possible because if `is_open()` returns true,
            // our `onOpen` handler should have executed and removed this abort listener.
            // This is a 'just in case' check in case the operation was cancelled sometime
            // between when the receiver's state was updated and when the receiverOpen
            // event was handled.
            rheaReceiver.close();
          } else if (!rheaReceiver.is_closed()) {
            // If the rheaReceiver isn't closed, then it's possible the peer will still
            // attempt to attach the link and open our receiver.
            // We can detect that if it occurs and close our receiver.
            rheaReceiver.once(ReceiverEvents.receiverOpen, () => {
              rheaReceiver.close();
            });
          }
          return rejectOnAbort();
        };

        if (abortSignal.aborted) {
          // Exit early before we do any work.
          return rejectOnAbort();
        } else {
          abortSignal.addEventListener("abort", onAbort);
        }
      }

      // Register session handlers for session_error and session_close if provided.
      // listeners provided by the user in the options object should be added
      // to our (rhea-promise) object.
      if (options && options.onSessionError) {
        this.on(SessionEvents.sessionError, options.onSessionError);
        log.session("[%s] Added event handler for event '%s' on rhea-promise 'session: %s', " +
          "while creating the 'receiver'.", this.connection.id, SessionEvents.sessionError, this.id);
      }

      if (options && options.onSessionClose) {
        this.on(SessionEvents.sessionClose, options.onSessionClose);
        log.session("[%s] Added event handler for event '%s' on rhea-promise 'session: %s', " +
          " while creating the 'receiver'.", this.connection.id, SessionEvents.sessionClose, this.id);
      }
      const rheaReceiver = this._session.attach_receiver(options);
      const receiver = new Receiver(this, rheaReceiver, options);
      receiver.actionInitiated++;

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
        rheaReceiver.session.connection.removeListener(ConnectionEvents.disconnected, onDisconnected);
        if (abortSignal) {
          abortSignal.removeEventListener("abort", onAbort);
        }
      };

      const onOpen = (context: RheaEventContext) => {
        removeListeners();
        log.receiver("[%s] Resolving the promise with amqp receiver '%s' on amqp session '%s'.",
          this.connection.id, receiver.name, this.id);
        return resolve(receiver);
      };

      const onClose = (context: RheaEventContext) => {
        removeListeners();
        log.error("[%s] Error occurred while creating the amqp receiver '%s' on amqp session " +
          "'%s' over amqp connection: %O.",
          this.connection.id, receiver.name, this.id, context.receiver!.error);
        return reject(context.receiver!.error);
      };

      const onDisconnected = (context: RheaEventContext) => {
        removeListeners();
        const error = context.connection && context.connection.error
          ? context.connection.error
          : context.error;
        log.error("[%s] Connection got disconnected while creating amqp receiver '%s' on amqp " +
          "session '%s': %O.", this.connection.id, receiver.name, this.id, error);
        return reject(error);
      };

      const actionAfterTimeout = () => {
        removeListeners();
        const msg: string = `Unable to create the amqp receiver '${receiver.name}' on amqp ` +
          `session '${this.id}' due to operation timeout.`;
        log.error("[%s] %s", this.connection.id, msg);
        return reject(new OperationTimeoutError(msg));
      };

      // listeners that we add for completing the operation are added directly to rhea's objects.
      rheaReceiver.once(ReceiverEvents.receiverOpen, onOpen);
      rheaReceiver.once(ReceiverEvents.receiverClose, onClose);
      rheaReceiver.session.connection.on(ConnectionEvents.disconnected, onDisconnected);
      const waitTimer = setTimeout(actionAfterTimeout, this.connection.options!.operationTimeoutInSeconds! * 1000);
    });
  }

  /**
   * Creates an amqp sender on this session.
   * @param options Options that can be provided while creating an amqp sender.
   * @return Promise<Sender>
   * - **Resolves** the promise with the Sender object when rhea emits the "sender_open" event.
   * - **Rejects** the promise with an AmqpError when rhea emits the "sender_close" event while trying
   * to create an amqp sender or the operation timeout occurs.
   */
  createSender(options?: SenderOptions & { abortSignal?: AbortSignalLike }): Promise<Sender> {
    return this._createSender(SenderType.sender, options) as Promise<Sender>;
  }

  /**
   * Creates an awaitable amqp sender on this session.
   * @param options Options that can be provided while creating an async amqp sender.
   * - If `onError` and `onSessionError` handlers are not provided then the `AwaitableSender` will
   * clear the timer and reject the Promise for all the entries of inflight send operation in its
   * `deliveryDispositionMap`.
   * - If the user is handling the reconnection of sender link or the underlying connection in it's
   * app, then the `onError` and `onSessionError` handlers must be provided by the user and (s)he
   * shall be responsible of clearing the `deliveryDispotionMap` of inflight `send()` operation.
   *
   * @return Promise<AwaitableSender>
   * - **Resolves** the promise with the Sender object when rhea emits the "sender_open" event.
   * - **Rejects** the promise with an AmqpError when rhea emits the "sender_close" event while trying
   * to create an amqp sender or the operation timeout occurs.
   */
  createAwaitableSender(options?: AwaitableSenderOptions & { abortSignal?: AbortSignalLike }): Promise<AwaitableSender> {
    return this._createSender(SenderType.AwaitableSender, options) as Promise<AwaitableSender>;
  }

  /**
   * Creates the Sender based on the provided type.
   * @internal
   * @param type The type of sender
   * @param options Options to be provided while creating the sender.
   */
  private _createSender(
    type: SenderType,
    options?: (SenderOptions | AwaitableSenderOptions) & { abortSignal?: AbortSignalLike }): Promise<Sender | AwaitableSender> {
    return new Promise((resolve, reject) => {
      const abortSignal = options && options.abortSignal;
      let onAbort: Func<void, void>;
      if (abortSignal) {
        const rejectOnAbort = () => {
          const err = createAbortError();
          log.error("[%s] [%s]", this.connection.id, err.message);
          return reject(err);
        };

        onAbort = () => {
          removeListeners();
          if (rheaSender.is_open()) {
            // This scenario *shouldn't* be possible because if `is_open()` returns true,
            // our `onOpen` handler should have executed and removed this abort listener.
            // This is a 'just in case' check in case the operation was cancelled sometime
            // between when the sender's state was updated and when the senderOpen
            // event was handled.
            rheaSender.close();
          } else if (!rheaSender.is_closed()) {
            // If the rheaSender isn't closed, then it's possible the peer will still
            // attempt to attach the link and open our sender.
            // We can detect that if it occurs and close our sender.
            rheaSender.once(SenderEvents.senderOpen, () => {
              rheaSender.close();
            });
          }
          return rejectOnAbort();
        };

        if (abortSignal.aborted) {
          // Exit early before we do any work.
          return rejectOnAbort();
        } else {
          abortSignal.addEventListener("abort", onAbort);
        }
      }

      // Register session handlers for session_error and session_close if provided.
      if (options && options.onSessionError) {
        this.on(SessionEvents.sessionError, options.onSessionError);
        log.session("[%s] Added event handler for event '%s' on rhea-promise 'session: %s', " +
          "while creating the sender.", this.connection.id, SessionEvents.sessionError, this.id);
      }

      if (options && options.onSessionClose) {
        this.on(SessionEvents.sessionClose, options.onSessionClose);
        log.session("[%s] Added event handler for event '%s' on rhea-promise 'session: %s', " +
          "while creating the sender.", this.connection.id, SessionEvents.sessionClose, this.id);
      }

      const rheaSender = this._session.attach_sender(options);
      let sender: Sender | AwaitableSender;
      if (type === SenderType.sender) {
        sender = new Sender(this, rheaSender, options);
      } else {
        sender = new AwaitableSender(this, rheaSender, options);
      }
      sender.actionInitiated++;
      // let onSendable: Func<RheaEventContext, void>;
      // let onClose: Func<RheaEventContext, void>;
      // let onDisconnected: Func<RheaEventContext, void>;
      // let waitTimer: any;

      // listeners provided by the user in the options object should be added
      // to our (rhea-promise) object.
      if (options) {
        if (options.onError) {
          sender.on(SenderEvents.senderError, options.onError);
        }
        if (options.onClose) {
          sender.on(SenderEvents.senderClose, options.onClose);
        }
        if (type === SenderType.sender) {
          if ((options as SenderOptions).onAccepted) {
            sender.on(SenderEvents.accepted, (options as SenderOptions).onAccepted!);
          }
          if ((options as SenderOptions).onRejected) {
            sender.on(SenderEvents.rejected, (options as SenderOptions).onRejected!);
          }
          if ((options as SenderOptions).onReleased) {
            sender.on(SenderEvents.released, (options as SenderOptions).onReleased!);
          }
          if ((options as SenderOptions).onModified) {
            sender.on(SenderEvents.modified, (options as SenderOptions).onModified!);
          }
        }
      }

      const removeListeners = () => {
        clearTimeout(waitTimer);
        sender.actionInitiated--;
        rheaSender.removeListener(SenderEvents.senderOpen, onSendable);
        rheaSender.removeListener(SenderEvents.senderClose, onClose);
        rheaSender.session.connection.removeListener(ConnectionEvents.disconnected, onDisconnected);
        if (abortSignal) {
          abortSignal.removeEventListener("abort", onAbort);
        }
      };

      const onSendable = (context: RheaEventContext) => {
        removeListeners();
        log.sender("[%s] Resolving the promise with amqp sender '%s' on amqp session '%s'.",
          this.connection.id, sender.name, this.id);
        return resolve(sender);
      };

      const onClose = (context: RheaEventContext) => {
        removeListeners();
        log.error("[%s] Error occurred while creating the amqp sender '%s' on amqp session '%s' " +
          "over amqp connection: %O.",
          this.connection.id, sender.name, this.id, context.sender!.error);
        return reject(context.sender!.error);
      };

      const onDisconnected = (context: RheaEventContext) => {
        removeListeners();
        const error = context.connection && context.connection.error
          ? context.connection.error
          : context.error;
        log.error("[%s] Connection got disconnected while creating amqp sender '%s' on amqp " +
          "session '%s': %O.", this.connection.id, sender.name, this.id, error);
        return reject(error);
      };

      const actionAfterTimeout = () => {
        removeListeners();
        const msg: string = `Unable to create the amqp sender '${sender.name}' on amqp session ` +
          `'${this.id}' due to operation timeout.`;
        log.error("[%s] %s", this.connection.id, msg);
        return reject(new OperationTimeoutError(msg));
      };

      // listeners that we add for completing the operation are added directly to rhea's objects.
      rheaSender.once(SenderEvents.sendable, onSendable);
      rheaSender.once(SenderEvents.senderClose, onClose);
      rheaSender.session.connection.on(ConnectionEvents.disconnected, onDisconnected);
      const waitTimer = setTimeout(actionAfterTimeout, this.connection.options!.operationTimeoutInSeconds! * 1000);
    });
  }

  /**
   * Adds event listeners for the possible events that can occur on the session object and
   * re-emits the same event back with the received arguments from rhea's event emitter.
   * @private
   * @returns {void} void
   */
  private _initializeEventListeners(): void {

    for (const eventName of Object.keys(SessionEvents) as Array<keyof typeof SessionEvents>) {
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

    // Add event handlers for *_error and *_close events that can be propagated to the session
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
      log.eventHandler("[%s] rhea-promise 'session' object '%s' is listening for events: %o " +
        "emitted by rhea's 'session' object.",
        this.connection.id, this.id, this._session.eventNames());
    }
  }
}
