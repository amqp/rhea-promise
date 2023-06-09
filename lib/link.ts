// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the Apache License. See License in the project root for license information.

import * as log from "./log";
import {
  link, LinkOptions, AmqpError, Dictionary, Source, TerminusOptions, SenderEvents, ReceiverEvents,
  EventContext as RheaEventContext, ConnectionEvents
} from "rhea";
import { Session } from "./session";
import { Connection } from "./connection";
import { emitEvent, EmitParameters } from './util/utils';
import { Entity } from "./entity";
import { OperationTimeoutError } from "./errorDefinitions";

export enum LinkType {
  sender = "sender",
  receiver = "receiver"
}

/**
 * @interface LinkCloseOptions
 * Describes the options that can be provided while closing the link.
 */
export interface LinkCloseOptions {
  /**
   * Indicates whether the underlying amqp session should also be closed when the
   * link is being closed.
   * - **Default: `true`**.
   */
  closeSession?: boolean;
}

export abstract class Link extends Entity {
  linkOptions?: LinkOptions;
  type: LinkType;
  protected _link: link;
  protected _session: Session;
  constructor(type: LinkType, session: Session, link: link, options?: LinkOptions) {
    super();
    this.type = type;
    this._session = session;
    this._link = link;
    this.linkOptions = options;
    this._initializeEventListeners();
  }

  get name(): string {
    return this._link.name;
  }

  get error(): AmqpError | Error | undefined {
    return this._link.error;
  }

  get properties(): Dictionary<any> {
    return this._link.properties;
  }

  get sendSettleMode(): 0 | 1 | 2 {
    return this._link.snd_settle_mode;
  }

  get receiveSettleMode(): 0 | 1 {
    return this._link.rcv_settle_mode;
  }

  get source(): Source {
    return this._link.source;
  }

  set source(fields: Source) {
    this._link.set_source(fields);
  }

  get target(): TerminusOptions {
    return this._link.target;
  }

  set target(fields: TerminusOptions) {
    this._link.set_source(fields);
  }

  get maxMessageSize(): number {
    return this._link.max_message_size;
  }

  get offeredCapabilities(): string | string[] {
    return this._link.offered_capabilities;
  }

  get desiredCapabilities(): string | string[] {
    return this._link.desired_capabilities;
  }

  get address(): string {
    return this.source.address;
  }

  get credit(): number {
    return (this._link as any).credit;
  }

  get session(): Session {
    return this._session;
  }

  get connection(): Connection {
    return this._session.connection;
  }

  /**
   * Determines whether the sender link and its underlying session is open.
   * @returns {boolean} `true` open. `false` closed.
   */
  isOpen(): boolean {
    let result = false;
    if (this._session.isOpen() && this._link.is_open()) {
      result = true;
    }
    return result;
  }

  /**
   * Determines whether the remote end of the link is open.
   * @return {boolean} boolean `true` - is open; `false` otherwise.
   */
  isRemoteOpen(): boolean {
    return this._link.is_remote_open();
  }

  /**
   * Determines whether the link has credit.
   * @return {boolean} boolean `true` - has credit; `false` otherwise.
   */
  hasCredit(): boolean {
    return this._link.has_credit();
  }

  /**
   * Determines whether the link is a sender.
   * @return {boolean} boolean `true` - sender; `false` otherwise.
   */
  isSender(): boolean {
    return this._link.is_sender();
  }

  /**
   * Determines whether the link is a receiver.
   * @return {boolean} boolean `true` - receiver; `false` otherwise.
   */
  isReceiver(): boolean {
    return this._link.is_receiver();
  }

  /**
   * Determines whether both local and remote endpoint for link or it's underlying session
   * or it's underlying connection are closed.
   * Within the "sender_close", "session_close" event handler, if this
   * method returns `false` it means that the local end is still open. It can be useful to
   * determine whether the close was initiated locally under such circumstances.
   *
   * @returns {boolean} `true` if closed, `false` otherwise.
   */
  isClosed(): boolean {
    return this._link.is_closed();
  }

  /**
   * Determines whether both local and remote endpoint for just the link itself are closed.
   * Within the "sender_close" event handler, if this method returns `false` it
   * means that the local end is still open. It can be useful to determine whether the close
   * was initiated locally under such circumstances.
   *
   * @returns {boolean} `true` - closed, `false` otherwise.
   */
  isItselfClosed(): boolean {
    return this._link.is_itself_closed();
  }

  /**
   * Determines whether both local and remote endpoint for session or it's underlying
   * connection are closed.
   *
   * Within the "session_close" event handler, if this method returns `false` it means that
   * the local end is still open. It can be useful to determine whether the close
   * was initiated locally under such circumstances.
   *
   * @returns {boolean} `true` - closed, `false` otherwise.
   */
  isSessionClosed(): boolean {
    return this._session.isClosed();
  }

  /**
   * Determines whether both local and remote endpoint for just the session itself are closed.
   * Within the "session_close" event handler, if this method returns `false` it means that
   * the local end is still open. It can be useful to determine whether the close
   * was initiated locally under such circumstances.
   *
   * @returns {boolean} `true` - closed, `false` otherwise.
   */
  isSessionItselfClosed(): boolean {
    return this._session.isItselfClosed();
  }

  /**
   * Removes the underlying amqp link and it's session from the internal map in rhea. Also removes
   * all the event handlers added in the rhea-promise library on the link and it's session.
   * @returns {void} void
   */
  remove(): void {
    if (this._link) {
      // Remove our listeners and listeners from rhea's link object.
      this.removeAllListeners();
      this._link.removeAllListeners();
      this._link.remove();
    }
    if (this._session) {
      this._session.remove();
    }
  }

  /**
   * Closes the underlying amqp link and optionally the session as well in rhea if open.
   * Also removes all the event handlers added in the rhea-promise library on the link
   * and optionally it's session.
   * @returns Promise<void>
   * - **Resolves** the promise when rhea emits the "sender_close" | "receiver_close" event.
   * - **Rejects** the promise with an AmqpError when rhea emits the
   * "sender_error" | "receiver_error" event while trying to close the amqp link.
   */
  async close(options?: LinkCloseOptions): Promise<void> {
    if (!options) options = {};
    if (options.closeSession == undefined) options.closeSession = true;

    const closePromise = new Promise<void>((resolve, reject) => {
      log.error("[%s] The %s '%s' on amqp session '%s' is open ? -> %s",
        this.connection.id, this.type, this.name, this.session.id, this.isOpen());
      if (this.isOpen()) {
        const errorEvent = this.type === LinkType.sender
          ? SenderEvents.senderError
          : ReceiverEvents.receiverError;
        const closeEvent = this.type === LinkType.sender
          ? SenderEvents.senderClose
          : ReceiverEvents.receiverClose;

        const removeListeners = () => {
          clearTimeout(waitTimer);
          this.actionInitiated--;
          this._link.removeListener(errorEvent, onError);
          this._link.removeListener(closeEvent, onClose);
          this._link.connection.removeListener(ConnectionEvents.disconnected, onDisconnected);
        };

        const onClose = (context: RheaEventContext) => {
          removeListeners();
          log[this.type]("[%s] Resolving the promise as the %s '%s' on amqp session '%s' " +
            "has been closed.", this.connection.id, this.type, this.name, this.session.id);
          return resolve();
        };

        const onError = (context: RheaEventContext) => {
          removeListeners();
          let error = context.session!.error;
          if (this.type === LinkType.sender && context.sender && context.sender.error) {
            error = context.sender.error;
          } else if (this.type === LinkType.receiver && context.receiver && context.receiver.error) {
            error = context.receiver.error;
          }

          log.error("[%s] Error occurred while closing %s '%s' on amqp session '%s': %O.",
            this.connection.id, this.type, this.name, this.session.id, error);
          return reject(error);
        };

        const onDisconnected = (context: RheaEventContext) => {
          removeListeners();
          const error = context.connection && context.connection.error
            ? context.connection.error
            : context.error;
          log.error("[%s] Connection got disconnected while closing amqp %s '%s' on amqp " +
            "session '%s': %O.", this.connection.id, this.type, this.name, this.session.id, error);
        };

        const actionAfterTimeout = () => {
          removeListeners();
          const msg: string = `Unable to close the ${this.type} '${this.name}' ` +
            `on amqp session '${this.session.id}' due to operation timeout.`;
          log.error("[%s] %s", this.connection.id, msg);
          return reject(new OperationTimeoutError(msg));
        };

        // listeners that we add for completing the operation are added directly to rhea's objects.
        this._link.once(closeEvent, onClose);
        this._link.once(errorEvent, onError);
        this._link.connection.once(ConnectionEvents.disconnected, onDisconnected);
        const waitTimer = setTimeout(actionAfterTimeout,
          this.connection.options!.operationTimeoutInSeconds! * 1000);
        this._link.close();
        this.actionInitiated++;
      } else {
        return resolve();
      }
    });

    try {
      await closePromise;
    } finally {
      this.removeAllListeners();
    }

    if (options.closeSession) {
      log[this.type]("[%s] %s '%s' has been closed, now closing it's amqp session '%s'.",
        this.connection.id, this.type, this.name, this.session.id);
      return this._session.close();
    }
  }

  /**
   * Adds event listeners for the possible events that can occur on the link object and
   * re-emits the same event back with the received arguments from rhea's event emitter.
   * @private
   * @returns {void} void
   */
  private _initializeEventListeners(): void {
    const events = this.type === LinkType.sender ? SenderEvents : ReceiverEvents;
    for (const eventName of Object.keys(events) as Array<keyof typeof events>) {
      this._link.on(events[eventName],
        (context: RheaEventContext) => {
          const params: EmitParameters = {
            rheaContext: context,
            emitter: this,
            eventName: events[eventName],
            emitterType: this.type,
            connectionId: this.connection.id
          };
          emitEvent(params);
        });
    }
    if (typeof this._link.eventNames === "function") {
      log.eventHandler("[%s] rhea-promise '%s' object is listening for events: %o " +
        "emitted by rhea's '%s' object.", this.connection.id, this.type,
        this._link.eventNames(), this.type);
    }
    if (typeof this._link.listenerCount === "function") {
      log.eventHandler("[%s] ListenerCount for event '%s_error' on rhea's '%s' object is: %d.",
        this.connection.id, this.type, this.type, this._link.listenerCount(`${this.type}_error`));
    }
  }
}
