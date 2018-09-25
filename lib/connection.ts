// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the Apache License. See License in the project root for license information.

import { EventEmitter } from "events";
import { PeerCertificate } from "tls";
import { Socket } from "net";
import * as log from "./log";
import { Session } from "./session";
import { Sender, SenderOptions } from "./sender";
import { Receiver, ReceiverOptions } from "./receiver";
import { Container } from "./container";
import { defaultOperationTimeoutInSeconds } from "./util/constants";
import { Func } from "./util/utils";
import {
  ConnectionEvents, SessionEvents, SenderEvents, ReceiverEvents, create_connection,
  ConnectionOptions as RheaConnectionOptions, Connection as RheaConnection, AmqpError, Dictionary,
  ConnectionError, EventContext as RheaEventContext
} from "rhea";
import { EventContext, OnAmqpEvent } from "./eventContext";

/**
 * Describes the options that can be provided while creating an AMQP sender. One can also provide a
 * session if it was already created.
 * @interface SenderOptionsWithSession
 */
export interface SenderOptionsWithSession extends SenderOptions {
  session?: Session;
}

/**
 * Describes the options that can be provided while creating an AMQP receiver. One can also provide a
 * session if it was already created.
 * @interface ReceiverOptionsWithSession
 */
export interface ReceiverOptionsWithSession extends ReceiverOptions {
  session?: Session;
}

/**
 * Describes the options that can be provided while creating an AMQP connection.
 * @interface ConnectionOptions
 */
export interface ConnectionOptions extends RheaConnectionOptions {
  /**
   * @property {number} [operationTimeoutInSeconds] - The duration in which the promise should
   * complete (resolve/reject). If it is not completed, then the Promise will be rejected after
   * timeout occurs. Default: `60 seconds`.
   */
  operationTimeoutInSeconds?: number;
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

/**
 * Descibes the AQMP Connection.
 * @class Connection
 */
export class Connection extends EventEmitter {
  /**
   * @property {ConnectionOptions} [options] Options that can be provided while creating the
   * connection.
   */
  options?: ConnectionOptions;
  /**
   * @property {Container} container The underlying Container instance on which the connection exists.
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
  constructor(options?: ConnectionOptions) {
    if (!options) options = {};
    if (options.operationTimeoutInSeconds == undefined) {
      options.operationTimeoutInSeconds = defaultOperationTimeoutInSeconds;
    }
    super();
    this.options = options;
    this._connection = create_connection(options);
    this.container = Container.copyFromContainerInstance(this._connection.container);
    this._initializeEventListeners();
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
   * Removes the provided session from the internal map.
   * @param {Session} session The session to be removed.
   */
  removeSession(session: Session): void {
    return session.remove();
  }

  /**
   * Creates a new amqp connection.
   * @return {Promise<Connection>} Promise<Connection>
   * - **Resolves** the promise with the Connection object when rhea emits the "connection_open" event.
   * - **Rejects** the promise with an AmqpError when rhea emits the "connection_close" event
   * while trying to establish an amqp connection.
   */
  open(): Promise<Connection> {
    return new Promise((resolve, reject) => {
      if (!this.isOpen()) {

        let onOpen: Func<RheaEventContext, void>;
        let onClose: Func<RheaEventContext, void>;
        let waitTimer: any;

        const removeListeners: Function = () => {
          clearTimeout(waitTimer);
          this._connection.removeListener(ConnectionEvents.connectionOpen, onOpen);
          this._connection.removeListener(ConnectionEvents.connectionClose, onClose);
          this._connection.removeListener(ConnectionEvents.disconnected, onClose);
        };

        onOpen = (context: RheaEventContext) => {
          removeListeners();
          setTimeout(() => {
            log.connection("[%s] Resolving the promise with amqp connection.", this.id);
            resolve(this);
          });
        };

        onClose = (context: RheaEventContext) => {
          removeListeners();
          const err = context.error || context.connection.error;
          log.error("[%s] Error occurred while establishing amqp connection: %O",
            this.id, err);
          reject(err);
        };

        const actionAfterTimeout = () => {
          removeListeners();
          const msg: string = `Unable to open the amqp connection "${this.id}" due to operation timeout.`;
          log.error("[%s] %s", this.id, msg);
          reject(new Error(msg));
        };

        // listeners that we add for completing the operation are added directly to rhea's objects.
        this._connection.once(ConnectionEvents.connectionOpen, onOpen);
        this._connection.once(ConnectionEvents.connectionClose, onClose);
        this._connection.once(ConnectionEvents.disconnected, onClose);
        waitTimer = setTimeout(actionAfterTimeout, this.options!.operationTimeoutInSeconds! * 1000);
        log.connection("[%s] Trying to create a new amqp connection.", this.id);
        this._connection.connect();
      } else {
        resolve(this);
      }
    });
  }


  /**
   * Closes the amqp connection.
   * @return {Promise<void>} Promise<void>
   * - **Resolves** the promise when rhea emits the "connection_close" event.
   * - **Rejects** the promise with an AmqpError when rhea emits the "connection_error" event while trying
   * to close an amqp connection.
   */
  close(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      log.error("[%s] The connection is open ? -> %s", this.id, this.isOpen());
      if (this.isOpen()) {
        let onClose: Func<RheaEventContext, void>;
        let onError: Func<RheaEventContext, void>;
        let waitTimer: any;
        const removeListeners = () => {
          clearTimeout(waitTimer);
          this._connection.removeListener(ConnectionEvents.connectionError, onError);
          this._connection.removeListener(ConnectionEvents.connectionClose, onClose);
        };

        onClose = (context: RheaEventContext) => {
          removeListeners();
          setTimeout(() => {
            log.connection("[%s] Resolving the promise as the connection has been successfully closed.",
              this.id);
            resolve();
          });
        };

        onError = (context: RheaEventContext) => {
          removeListeners();
          log.error("[%s] Error occurred while closing amqp connection: %O.",
            this.id, context.connection.error);
          reject(context.connection.error);
        };

        const actionAfterTimeout = () => {
          removeListeners();
          const msg: string = `Unable to close the amqp connection "${this.id}" due to operation timeout.`;
          log.error("[%s] %s", this.id, msg);
          reject(new Error(msg));
        };

        // listeners that we add for completing the operation are added directly to rhea's objects.
        this._connection.once(ConnectionEvents.connectionClose, onClose);
        this._connection.once(ConnectionEvents.connectionError, onError);
        waitTimer = setTimeout(actionAfterTimeout, this.options!.operationTimeoutInSeconds! * 1000);
        this._connection.close();
      } else {
        resolve();
      }
    });
  }

  /**
   * Determines whether the connection is open.
   * @returns {boolean} result `true` - is open; `false` otherwise.
   */
  isOpen(): boolean {
    let result: boolean = false;
    if (this._connection && this._connection.is_open && this._connection.is_open()) {
      result = true;
    }
    return result;
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
   * @return {Promise<Session>} Promise<Session>
   * - **Resolves** the promise with the Session object when rhea emits the "session_open" event.
   * - **Rejects** the promise with an AmqpError when rhea emits the "session_close" event while trying
   * to create an amqp session.
   */
  createSession(): Promise<Session> {
    return new Promise((resolve, reject) => {
      const rheaSession = this._connection.create_session();
      const session = new Session(this, rheaSession);
      let onOpen: Func<RheaEventContext, void>;
      let onClose: Func<RheaEventContext, void>;
      let waitTimer: any;

      const removeListeners = () => {
        clearTimeout(waitTimer);
        rheaSession.removeListener(SessionEvents.sessionOpen, onOpen);
        rheaSession.removeListener(SessionEvents.sessionClose, onClose);
      };

      onOpen = (context: RheaEventContext) => {
        removeListeners();
        setTimeout(() => {
          log.connection("[%s] Resolving the promise with amqp session.", this.id);
          resolve(session);
        });
      };

      onClose = (context: RheaEventContext) => {
        removeListeners();
        log.error("[%s] Error occurred while establishing a session over amqp connection: %O.",
          this.id, context.session!.error);
        reject(context.session!.error);
      };

      const actionAfterTimeout = () => {
        removeListeners();
        const msg: string = `Unable to create the amqp session due to operation timeout.`;
        log.error("[%s] %s", this.id, msg);
        reject(new Error(msg));
      };

      // listeners that we add for completing the operation are added directly to rhea's objects.
      rheaSession.once(SessionEvents.sessionOpen, onOpen);
      rheaSession.once(SessionEvents.sessionClose, onClose);
      log.connection("[%s] Calling amqp session.begin().", this.id);
      waitTimer = setTimeout(actionAfterTimeout, this.options!.operationTimeoutInSeconds! * 1000);
      rheaSession.begin();
    });
  }

  /**
   * Creates an amqp sender link. It either uses the provided session or creates a new one.
   * @param {SenderOptionsWithSession} options Optional parameters to create a sender link.
   * @return {Promise<Sender>} Promise<Sender>.
   */
  async createSender(options?: SenderOptionsWithSession): Promise<Sender> {
    if (options && options.session && options.session.createSender) {
      return await options.session.createSender(options);
    }
    const session = await this.createSession();
    return await session.createSender(options);
  }

  /**
   * Creates an amqp receiver link. It either uses the provided session or creates a new one.
   * @param {ReceiverOptionsWithSession} options Optional parameters to create a receiver link.
   * @return {Promise<Receiver>} Promise<Receiver>.
   */
  async createReceiver(options?: ReceiverOptionsWithSession): Promise<Receiver> {
    if (options && options.session && options.session.createReceiver) {
      return await options.session.createReceiver(options);
    }
    const session = await this.createSession();
    return await session.createReceiver(options);
  }

  /**
   * Creates an amqp sender-receiver link. It either uses the provided session or creates a new one.
   * This method creates a sender-receiver link on the same session. It is useful for management
   * style operations where one may want to send a request and await for response.
   * @param {SenderOptions} senderOptions Parameters to create a sender.
   * @param {ReceiverOptions} receiverOptions Parameters to create a receiver.
   * @param {Session} [session] The optional session on which the sender and receiver links will be
   * created.
   * @return {Promise<ReqResLink>} Promise<ReqResLink>
   */
  async createRequestResponseLink(senderOptions: SenderOptions, receiverOptions: ReceiverOptions, providedSession?: Session): Promise<ReqResLink> {
    if (!senderOptions) {
      throw new Error(`Please provide sender options.`);
    }
    if (!receiverOptions) {
      throw new Error(`Please provide receiver options.`);
    }
    const session = providedSession || await this.createSession();
    const [sender, receiver] = await Promise.all([
      session.createSender(senderOptions),
      session.createReceiver(receiverOptions)
    ]);
    log.connection("[%s] Successfully created the sender and receiver links on the same session.", this.id);
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
    for (const eventName in ConnectionEvents) {
      this._connection.on(ConnectionEvents[eventName],
        (context) => this.emit(ConnectionEvents[eventName], EventContext.translate(context, this)));
    }

    // Add event handlers for *_error and *_close events that can be propogated to the connection
    // object, if they are not handled at their level. * denotes - Sender, Receiver, Session
    // Sender
    this._connection.on(SenderEvents.senderError,
      (context) => this.emit(SenderEvents.senderError, EventContext.translate(context, this)));
    this._connection.on(SenderEvents.senderClose,
      (context) => this.emit(SenderEvents.senderClose, EventContext.translate(context, this)));
    // Receiver
    this._connection.on(ReceiverEvents.receiverError,
      (context) => this.emit(ReceiverEvents.receiverError, EventContext.translate(context, this)));
    this._connection.on(ReceiverEvents.receiverClose,
      (context) => this.emit(ReceiverEvents.receiverClose, EventContext.translate(context, this)));
    // Session
    this._connection.on(SessionEvents.sessionError,
      (context) => this.emit(SessionEvents.sessionError, EventContext.translate(context, this)));
    this._connection.on(SessionEvents.sessionClose,
      (context) => this.emit(SessionEvents.sessionClose, EventContext.translate(context, this)));
  }
}
