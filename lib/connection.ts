// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the Apache License. See License in the project root for license information.

import { PeerCertificate } from "tls";
import { Socket } from "net";
import * as log from "./log";
import { Session } from "./session";
import { Sender, SenderOptions } from "./sender";
import { Receiver, ReceiverOptions } from "./receiver";
import { Container } from "./container";
import { defaultOperationTimeoutInSeconds } from "./util/constants";
import { Func, EmitParameters, emitEvent, AbortSignalLike, createAbortError } from "./util/utils";
import {
  ConnectionEvents, SessionEvents, SenderEvents, ReceiverEvents, create_connection, websocket_connect,
  ConnectionOptions as RheaConnectionOptions, Connection as RheaConnection, AmqpError, Dictionary,
  ConnectionError, EventContext as RheaEventContext
} from "rhea";

import { OnAmqpEvent } from "./eventContext";
import { Entity } from "./entity";
import { OperationTimeoutError } from "./errorDefinitions";
import { AwaitableSender, AwaitableSenderOptions } from "./awaitableSender";

/**
 * Describes the options that can be provided while creating an AMQP sender. One can also provide
 * a session if it was already created.
 * @interface SenderOptionsWithSession
 */
export interface CreateSenderOptions extends SenderOptions {
  session?: Session;
  /**
   * A signal used to cancel the Connection.createSender() operation.
   */
  abortSignal?: AbortSignalLike;
}

/**
 * Describes the options that can be provided while creating an Async AMQP sender.
 * One can also provide a session if it was already created.
 */
export interface CreateAwaitableSenderOptions extends AwaitableSenderOptions {
  session?: Session;
  /**
   * A signal used to cancel the Connection.createAwaitableSender() operation.
   */
  abortSignal?: AbortSignalLike;
}

/**
 * Describes the options that can be provided while creating an AMQP receiver. One can also provide
 * a session if it was already created.
 */
export interface CreateReceiverOptions extends ReceiverOptions {
  session?: Session;
  /**
   * A signal used to cancel the Connection.createReceiver() operation.
   */
  abortSignal?: AbortSignalLike;
}

/**
 * Describes the options that can be provided while creating an AMQP Request-Response link. One can also provide
 * a session if it was already created.
 */
export interface CreateRequestResponseLinkOptions {
  session?: Session;
  /**
   * A signal used to cancel the Connection.createRequestResponseLink() operation.
   */
  abortSignal?: AbortSignalLike;
}

/**
 * Set of options to use when running Connection.open()
 */
export interface ConnectionOpenOptions {
  /**
   * A signal used to cancel the Connection.open() operation.
   */
  abortSignal?: AbortSignalLike;
}

/**
 * Set of options to use when running Connection.close()
 */
export interface ConnectionCloseOptions {
  /**
   * A signal used to cancel the Connection.close() operation.
   */
  abortSignal?: AbortSignalLike;
}

/**
 * Set of options to use when running Connection.createSession()
 */
export interface SessionCreateOptions {
  /**
   * A signal used to cancel the Connection.createSession() operation.
   */
  abortSignal?: AbortSignalLike;
}

/**
 * Describes the options that can be provided while creating an AMQP connection.
 * @interface ConnectionOptions
 */
export type ConnectionOptions = RheaConnectionOptions & {
  /**
   * @property {number} [operationTimeoutInSeconds] - The duration in which the promise should
   * complete (resolve/reject). If it is not completed, then the Promise will be rejected after
   * timeout occurs. Default: `60 seconds`.
   */
  operationTimeoutInSeconds?: number;

  /**
   * @property {Object} [webSocketOptions] - Options that include a web socket constructor along
   * with arguments to be passed to the function returned by rhea.websocket_connect()
   * This is required when the connection needs to use web sockets but is being created without
   * creating a container first. If a container is already available, use `websocket_connect` on it
   * directly instead.
   */
  webSocketOptions?: {
    /**
     * @property {any} [webSocket] - The WebSocket constructor used to create an AMQP
     * connection over a WebSocket.
     */
    webSocket: any;
    /**
     * @property {string} [url] - Websocket url which will be passed to the function returned by
     * rhea.websocket_connect()
     */
    url: string;
    /**
     * @property {string[]} {protocol} - Websocket SubProtocol to be passed to the function
     * returned by rhea.websocket_connect()
     */
    protocol: string[];
    /** *
     * @property {any} {options} - Options to be passed to the function returned by
     * rhea.websocket_connect()
     */
    options?: any;
  };
};



/**
 * Describes the options that can be provided while creating a rhea-promise connection from an
 * already created rhea connection object.
 * @interface CreatedRheaConnectionOptions
 */
export interface CreatedRheaConnectionOptions {
  /**
   * @property {number} [operationTimeoutInSeconds] - The duration in which the promise should
   * complete (resolve/reject). If it is not completed, then the Promise will be rejected after
   * timeout occurs. Default: `60 seconds`.
   */
  operationTimeoutInSeconds?: number;
  /**
   * @property rheaConnection The connection object from rhea
   */
  rheaConnection: RheaConnection;
  /**
   * @property container The Container object from this (rhea-promise) library.
   */
  container: Container;
}

// Determines whether the given object is a CreatedRheConnectionOptions object.
function isCreatedRheaConnectionOptions(obj: any): obj is CreatedRheaConnectionOptions {
  return (obj && typeof obj.container === "object" && typeof obj.rheaConnection === "object");
}

/**
 * Provides a sender and a receiver link on the same session. It is useful while constructing a
 * request/response link.
 *
 * @interface ReqResLink
 */
export interface ReqResLink {
  /**
   * @property {Sender} sender - The sender link for sending a request.
   */
  sender: Sender;
  /**
   * @property {Receiver} receiver - The receiver link for receiving a response.
   */
  receiver: Receiver;
  /**
   * @property {Session} session - The underlying session on whicn the sender and receiver links
   * exist.
   */
  session: Session;
}

/**
 * Describes the event listeners that can be added to the Connection.
 * @interface Connection
 */
export declare interface Connection {
  on(event: ConnectionEvents, listener: OnAmqpEvent): this;
}

const maxListenerLimit = 1000;

/**
 * Describes the AMQP Connection.
 * @class Connection
 */
export class Connection extends Entity {
  /**
   * @property {ConnectionOptions} options Options that can be provided while creating the
   * connection.
   */
  options: ConnectionOptions;
  /**
   * @property {Container} container The underlying Container instance on which the connection
   * exists.
   */
  readonly container: Container;
  /**
   * @property {RheaConnection} _connection The connection object from rhea library.
   * @private
   */
  private _connection: RheaConnection;

  /**
   * Creates an instance of the Connection object.
   * @constructor
   * @param {Connection} _connection The connection object from rhea library.
   */
  constructor(options?: ConnectionOptions | CreatedRheaConnectionOptions) {
    super();

    if (isCreatedRheaConnectionOptions(options)) {
      this._connection = (options as CreatedRheaConnectionOptions).rheaConnection;
      this.container = (options as CreatedRheaConnectionOptions).container;
    } else {
      let connectionOptions = options as ConnectionOptions;
      if (!connectionOptions) connectionOptions = { transport: "tls" };
      if (!connectionOptions.operationTimeoutInSeconds) {
        connectionOptions.operationTimeoutInSeconds = defaultOperationTimeoutInSeconds;
      }
      if (connectionOptions.webSocketOptions) {
        const ws = websocket_connect(connectionOptions.webSocketOptions.webSocket);
        (connectionOptions.connection_details as any) = ws(
          connectionOptions.webSocketOptions.url,
          connectionOptions.webSocketOptions.protocol,
          connectionOptions.webSocketOptions.options);
      }
      this._connection = create_connection(connectionOptions);
      this.container = Container.copyFromContainerInstance(this._connection.container);
      options = connectionOptions;
    }

    this.options = this._connection.options;
    this.options.operationTimeoutInSeconds = options?.operationTimeoutInSeconds ?? defaultOperationTimeoutInSeconds;

    this._initializeEventListeners();

    // Set max listeners on the connection to 1000 because Session and Link add their own listeners
    // and the default value of 10 in NodeJS is too low.
    this._connection.setMaxListeners(maxListenerLimit);
  }

  /**
   * @property {string} id Returns the connection id.
   * @readonly
   */
  get id(): string {
    return this._connection.options.id!;
  }

  /**
   * @property {Dictionary<any> | undefined} [properties] Provides the connection properties.
   * @readonly
   */
  get properties(): Dictionary<any> | undefined {
    return this._connection.properties;
  }

  /**
   * @property {number | undefined} [maxFrameSize] Provides the max frame size.
   * @readonly
   */
  get maxFrameSize(): number | undefined {
    return this._connection.max_frame_size;
  }

  /**
   * @property {number | undefined} [idleTimeout] Provides the idle timeout for the connection.
   * @readonly
   */
  get idleTimeout(): number | undefined {
    return this._connection.idle_time_out;
  }

  /**
   * @property {number | undefined} [channelMax] Provides the maximum number of channels supported.
   * @readonly
   */
  get channelMax(): number | undefined {
    return this._connection.channel_max;
  }

  /**
   * @property {AmqpError | Error | undefined} [error] Provides the last error that occurred on the
   * connection.
   */
  get error(): AmqpError | Error | undefined {
    return this._connection.error;
  }

  /**
   * Removes the provided session from the internal map in rhea.
   * Also removes all the event handlers added in the rhea-promise library on the provided session.
   * @param {Session} session The session to be removed.
   */
  removeSession(session: Session): void {
    return session.remove();
  }

  /**
   * Creates a new amqp connection.
   * @param options A set of options including a signal used to cancel the operation.
   * @return {Promise<Connection>} Promise<Connection>
   * - **Resolves** the promise with the Connection object when rhea emits the "connection_open" event.
   * - **Rejects** the promise with an AmqpError when rhea emits the "connection_close" event
   * while trying to establish an amqp connection or with an AbortError if the operation was cancelled.
   */
  open(options?: ConnectionOpenOptions): Promise<Connection> {
    return new Promise((resolve, reject) => {
      if (!this.isOpen()) {

        const abortSignal = options && options.abortSignal;

        const removeListeners = () => {
          clearTimeout(waitTimer);
          this.actionInitiated--;
          this._connection.removeListener(ConnectionEvents.connectionOpen, onOpen);
          this._connection.removeListener(ConnectionEvents.connectionClose, onClose);
          this._connection.removeListener(ConnectionEvents.disconnected, onClose);
          if (abortSignal) {
            abortSignal.removeEventListener("abort", onAbort);
          }
        };

        const onOpen = (context: RheaEventContext) => {
          removeListeners();
          log.connection("[%s] Resolving the promise with amqp connection.", this.id);
          return resolve(this);
        };

        const onClose = (context: RheaEventContext) => {
          removeListeners();
          const err = context.error || context.connection.error || Error('Failed to connect');
          log.error("[%s] Error occurred while establishing amqp connection: %O",
            this.id, err);
          return reject(err);
        };

        const onAbort = () => {
          removeListeners();
          this._connection.close();
          const err = createAbortError();
          log.error("[%s] [%s]", this.id, err.message);
          return reject(err);
        };

        const actionAfterTimeout = () => {
          removeListeners();
          const msg = `Unable to open the amqp connection "${this.id}" due to operation timeout.`;
          log.error("[%s] %s", this.id, msg);
          return reject(new Error(msg));
        };

        // listeners that we add for completing the operation are added directly to rhea's objects.
        this._connection.once(ConnectionEvents.connectionOpen, onOpen);
        this._connection.once(ConnectionEvents.connectionClose, onClose);
        this._connection.once(ConnectionEvents.disconnected, onClose);
        const waitTimer = setTimeout(actionAfterTimeout, this.options!.operationTimeoutInSeconds! * 1000);
        log.connection("[%s] Trying to create a new amqp connection.", this.id);
        this._connection.connect();
        this.actionInitiated++;

        if (abortSignal) {
          if (abortSignal.aborted) {
            onAbort();
          } else {
            abortSignal.addEventListener("abort", onAbort);
          }
        }
      } else {
        return resolve(this);
      }
    });
  }


  /**
   * Closes the amqp connection.
   * @param options A set of options including a signal used to cancel the operation.
   * When the abort signal in the options is fired, the local endpoint is closed.
   * This does not guarantee that the remote has closed as well. It only stops listening for
   * an acknowledgement that the remote endpoint is closed as well.
   * @return {Promise<void>} Promise<void>
   * - **Resolves** the promise when rhea emits the "connection_close" event.
   * - **Rejects** the promise with an AmqpError when rhea emits the "connection_error" event while
   * trying to close an amqp connection or with an AbortError if the operation was cancelled.
   */
  close(options?: ConnectionCloseOptions): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      log.error("[%s] The connection is open ? -> %s", this.id, this.isOpen());
      if (this.isOpen()) {
        const abortSignal = options && options.abortSignal;

        const removeListeners = () => {
          clearTimeout(waitTimer);
          this.actionInitiated--;
          this._connection.removeListener(ConnectionEvents.connectionError, onError);
          this._connection.removeListener(ConnectionEvents.connectionClose, onClose);
          this._connection.removeListener(ConnectionEvents.disconnected, onDisconnected);
          if (abortSignal) {
            abortSignal.removeEventListener("abort", onAbort);
          }
        };

        const onClose = (context: RheaEventContext) => {
          removeListeners();
          log.connection("[%s] Resolving the promise as the connection has been successfully closed.",
            this.id);
          return resolve();
        };

        const onError = (context: RheaEventContext) => {
          removeListeners();
          log.error("[%s] Error occurred while closing amqp connection: %O.",
            this.id, context.connection.error);
          return reject(context.connection.error);
        };

        const onDisconnected = (context: RheaEventContext) => {
          removeListeners();
          const error = context.connection && context.connection.error
            ? context.connection.error
            : context.error;
          log.error("[%s] Connection got disconnected while closing itself: %O.", this.id, error);
        };

        const onAbort = () => {
          removeListeners();
          const err = createAbortError();
          log.error("[%s] [%s]", this.id, err.message);
          return reject(err);
        };

        const actionAfterTimeout = () => {
          removeListeners();
          const msg = `Unable to close the amqp connection "${this.id}" due to operation timeout.`;
          log.error("[%s] %s", this.id, msg);
          return reject(new Error(msg));
        };

        // listeners that we add for completing the operation are added directly to rhea's objects.
        this._connection.once(ConnectionEvents.connectionClose, onClose);
        this._connection.once(ConnectionEvents.connectionError, onError);
        this._connection.once(ConnectionEvents.disconnected, onDisconnected);
        const waitTimer = setTimeout(actionAfterTimeout, this.options!.operationTimeoutInSeconds! * 1000);
        this._connection.close();
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
  }

  /**
   * Determines whether the connection is open.
   * @returns {boolean} result `true` - is open; `false` otherwise.
   */
  isOpen(): boolean {
    let result = false;
    if (this._connection && this._connection.is_open && this._connection.is_open()) {
      result = true;
    }
    return result;
  }

  /**
   * Clears all the amqp sessions from the internal map maintained in rhea. This does not remove any
   * of the event handlers added in the rhea-promise library. To clear such event handlers, either
   * call remove() or close() on each session
   */
  removeAllSessions(): void {
    if (this._connection) {
      this._connection.remove_all_sessions();
    }
  }

  /**
   * Determines whether the remote end of the connection is open.
   * @returns {boolean} result `true` - is open; `false` otherwise.
   */
  isRemoteOpen(): boolean {
    return this._connection.is_remote_open();
  }

  /**
   * Gets the connection error if present.
   * @returns {ConnectionError | undefined} ConnectionError | undefined
   */
  getError(): ConnectionError | undefined {
    return this._connection.get_error();
  }

  /**
   * Gets the peer certificate if present.
   * @returns {PeerCertificate | undefined} PeerCertificate | undefined
   */
  getPeerCertificate(): PeerCertificate | undefined {
    return this._connection.get_peer_certificate();
  }

  /**
   * Gets the tls socket if present.
   * @returns {Socket | undefined} Socket | undefined
   */
  getTlsSocket(): Socket | undefined {
    return this._connection.get_tls_socket();
  }

  /**
   * Determines whether the close from the peer is a response to a locally initiated close request
   * for the connection.
   * @returns {boolean} `true` if close was locally initiated, `false` otherwise.
   */
  wasCloseInitiated(): boolean {
    return this._connection.is_closed();
  }

  /**
   * Creates an amqp session on the provided amqp connection.
   * @param options A set of options including a signal used to cancel the operation.
   * @return {Promise<Session>} Promise<Session>
   * - **Resolves** the promise with the Session object when rhea emits the "session_open" event.
   * - **Rejects** the promise with an AmqpError when rhea emits the "session_close" event while
   * trying to create an amqp session or with an AbortError if the operation was cancelled.
   */
  createSession(options?: SessionCreateOptions): Promise<Session> {
    return new Promise((resolve, reject) => {
      const abortSignal = options && options.abortSignal;
      let onAbort: Func<void, void>;
      if (abortSignal) {
        const rejectOnAbort = () => {
          const err = createAbortError();
          log.error("[%s] [%s]", this.id, err.message);
          return reject(err);
        };

        onAbort = () => {
          removeListeners();
          if (rheaSession.is_open()) {
            // This scenario *shouldn't* be possible because if `is_open()` returns true,
            // our `onOpen` handler should have executed and removed this abort listener.
            // This is a 'just in case' check in case the operation was cancelled sometime
            // between when the session's state was updated and when the sessionOpen
            // event was handled.
            rheaSession.close();
          } else if (!rheaSession.is_closed()) {
            // If the rheaSession isn't closed, then it's possible the peer will still
            // attempt to begin the session.
            // We can detect that if it occurs and close our session.
            rheaSession.once(SessionEvents.sessionOpen, () => {
              rheaSession.close();
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

      const rheaSession = this._connection.create_session();
      const session = new Session(this, rheaSession);
      session.actionInitiated++;

      const removeListeners = () => {
        clearTimeout(waitTimer);
        session.actionInitiated--;
        rheaSession.removeListener(SessionEvents.sessionOpen, onOpen);
        rheaSession.removeListener(SessionEvents.sessionClose, onClose);
        rheaSession.connection.removeListener(ConnectionEvents.disconnected, onDisconnected);
        if (abortSignal) {
          abortSignal.removeEventListener("abort", onAbort);
        }
      };

      const onOpen = (context: RheaEventContext) => {
        removeListeners();
        log.session("[%s] Resolving the promise with amqp session '%s'.", this.id, session.id);
        return resolve(session);
      };

      const onClose = (context: RheaEventContext) => {
        removeListeners();
        log.error("[%s] Error occurred while establishing a session over amqp connection: %O.",
          this.id, context.session!.error);
        return reject(context.session!.error);
      };

      const onDisconnected = (context: RheaEventContext) => {
        removeListeners();
        const error = context.connection && context.connection.error
          ? context.connection.error
          : context.error;
        log.error("[%s] Connection got disconnected while creating amqp session '%s': %O.",
          this.id, session.id, error);
        return reject(error);
      };

      const actionAfterTimeout = () => {
        removeListeners();
        const msg = `Unable to create the amqp session due to operation timeout.`;
        log.error("[%s] %s", this.id, msg);
        return reject(new OperationTimeoutError(msg));
      };

      // listeners that we add for completing the operation are added directly to rhea's objects.
      rheaSession.once(SessionEvents.sessionOpen, onOpen);
      rheaSession.once(SessionEvents.sessionClose, onClose);
      rheaSession.connection.once(ConnectionEvents.disconnected, onDisconnected);
      log.session("[%s] Calling amqp session.begin().", this.id);
      const waitTimer = setTimeout(actionAfterTimeout, this.options!.operationTimeoutInSeconds! * 1000);
      rheaSession.begin();
    });
  }

  /**
   * Creates an amqp sender link. It either uses the provided session or creates a new one.
   * - **Resolves** the promise with the Sender object when rhea emits the "sender_open" event.
   * - **Rejects** the promise with an AmqpError when rhea emits the "sender_close" event while
   * trying to create an amqp session or with an AbortError if the operation was cancelled.
   * @param {CreateSenderOptions} options Optional parameters to create a sender link.
   * @return {Promise<Sender>} Promise<Sender>.
   */
  async createSender(options?: CreateSenderOptions): Promise<Sender> {
    if (options && options.session && options.session.createSender) {
      return options.session.createSender(options);
    }
    const session = await this.createSession({ abortSignal: options && options.abortSignal });
    return session.createSender(options);
  }

  /**
   * Creates an awaitable amqp sender. It either uses the provided session or creates a new one.
   * @param options Optional parameters to create an awaitable sender link.
   * - If `onError` and `onSessionError` handlers are not provided then the `AwaitableSender` will
   * clear the timer and reject the Promise for all the entries of inflight send operation in its
   * `deliveryDispositionMap`.
   * - If the user is handling the reconnection of sender link or the underlying connection in it's
   * app, then the `onError` and `onSessionError` handlers must be provided by the user and (s)he
   * shall be responsible of clearing the `deliveryDispositionMap` of inflight `send()` operation.
   *
   * @return Promise<AwaitableSender>.
   */
  async createAwaitableSender(options?: CreateAwaitableSenderOptions): Promise<AwaitableSender> {
    if (options && options.session && options.session.createAwaitableSender) {
      return options.session.createAwaitableSender(options);
    }
    const session = await this.createSession({ abortSignal: options && options.abortSignal });
    return session.createAwaitableSender(options);
  }

  /**
   * Creates an amqp receiver link. It either uses the provided session or creates a new one.
   * - **Resolves** the promise with the Sender object when rhea emits the "receiver_open" event.
   * - **Rejects** the promise with an AmqpError when rhea emits the "receiver_close" event while
   * trying to create an amqp session or with an AbortError if the operation was cancelled.
   * @param {CreateReceiverOptions} options Optional parameters to create a receiver link.
   * @return {Promise<Receiver>} Promise<Receiver>.
   */
  async createReceiver(options?: CreateReceiverOptions): Promise<Receiver> {
    if (options && options.session && options.session.createReceiver) {
      return options.session.createReceiver(options);
    }
    const session = await this.createSession({ abortSignal: options && options.abortSignal });
    return session.createReceiver(options);
  }

  /**
   * Creates an amqp sender-receiver link. It either uses the provided session or creates a new one.
   * This method creates a sender-receiver link on the same session. It is useful for management
   * style operations where one may want to send a request and await for response.
   * @param {SenderOptions} senderOptions Parameters to create a sender.
   * @param {ReceiverOptions} receiverOptions Parameters to create a receiver.
   * @param {CreateRequestResponseLinkOptions} [options] Optional parameters to control how sender and receiver link creation.
   * @return {Promise<ReqResLink>} Promise<ReqResLink>
   */
  async createRequestResponseLink(senderOptions: SenderOptions, receiverOptions: ReceiverOptions,
    options: CreateRequestResponseLinkOptions = {}): Promise<ReqResLink> {
    if (!senderOptions) {
      throw new Error(`Please provide sender options.`);
    }
    if (!receiverOptions) {
      throw new Error(`Please provide receiver options.`);
    }
    const { session: providedSession, abortSignal } = options;
    const session = providedSession || await this.createSession({ abortSignal });
    const [sender, receiver] = await Promise.all([
      session.createSender({ ...senderOptions, abortSignal }),
      session.createReceiver({ ...receiverOptions, abortSignal })
    ]);
    log.connection("[%s] Successfully created the sender '%s' and receiver '%s' on the same " +
      "amqp session '%s'.", this.id, sender.name, receiver.name, session.id);
    return {
      session: session,
      sender: sender,
      receiver: receiver
    };
  }

  /**
   * Adds event listeners for the possible events that can occur on the connection object and
   * re-emits the same event back with the received arguments from rhea's event emitter.
   * @private
   * @returns {void} void
   */
  private _initializeEventListeners(): void {
    for (const eventName of Object.keys(ConnectionEvents) as Array<keyof typeof ConnectionEvents>) {
      this._connection.on(ConnectionEvents[eventName], (context) => {
        const params: EmitParameters = {
          rheaContext: context,
          emitter: this,
          eventName: ConnectionEvents[eventName],
          emitterType: "connection",
          connectionId: this.id
        };
        if (ConnectionEvents[eventName] === ConnectionEvents.protocolError) {
          log.connection("[%s] ProtocolError is: %O.", this.id, context);
        }
        emitEvent(params);
      });
    }

    // Add event handlers for *_error and *_close events that can be propagated to the connection
    // object, if they are not handled at their level. * denotes - Sender, Receiver, Session

    // Sender
    this._connection.on(SenderEvents.senderError, (context) => {
      const params: EmitParameters = {
        rheaContext: context,
        emitter: this,
        eventName: SenderEvents.senderError,
        emitterType: "connection",
        connectionId: this.id
      };
      emitEvent(params);
    });
    this._connection.on(SenderEvents.senderClose, (context) => {
      const params: EmitParameters = {
        rheaContext: context,
        emitter: this,
        eventName: SenderEvents.senderClose,
        emitterType: "connection",
        connectionId: this.id
      };
      emitEvent(params);
    });

    // Receiver
    this._connection.on(ReceiverEvents.receiverError, (context) => {
      const params: EmitParameters = {
        rheaContext: context,
        emitter: this,
        eventName: ReceiverEvents.receiverError,
        emitterType: "connection",
        connectionId: this.id
      };
      emitEvent(params);
    });
    this._connection.on(ReceiverEvents.receiverClose, (context) => {
      const params: EmitParameters = {
        rheaContext: context,
        emitter: this,
        eventName: ReceiverEvents.receiverClose,
        emitterType: "connection",
        connectionId: this.id
      };
      emitEvent(params);
    });

    // Session
    this._connection.on(SessionEvents.sessionError, (context) => {
      const params: EmitParameters = {
        rheaContext: context,
        emitter: this,
        eventName: SessionEvents.sessionError,
        emitterType: "connection",
        connectionId: this.id
      };
      emitEvent(params);
    });
    this._connection.on(SessionEvents.sessionClose, (context) => {
      const params: EmitParameters = {
        rheaContext: context,
        emitter: this,
        eventName: SessionEvents.sessionClose,
        emitterType: "connection",
        connectionId: this.id
      };
      emitEvent(params);
    });
    if (typeof this._connection.eventNames === "function") {
      log.eventHandler("[%s] rhea-promise 'connection' object is listening for events: %o " +
        "emitted by rhea's 'connection' object.", this.id, this._connection.eventNames());
    }
  }
}
