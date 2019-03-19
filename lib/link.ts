// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the Apache License. See License in the project root for license information.

import * as log from "./log";
import {
  link, LinkOptions, AmqpError, Dictionary, Source, TerminusOptions, SenderEvents, ReceiverEvents,
  EventContext as RheaEventContext
} from "rhea";
import { Session } from "./session";
import { Connection } from "./connection";
import { Func, emitEvent, EmitParameters } from './util/utils';
import { Entity } from "./entity";
import { OperationTimeoutError } from "./operationTimeoutError";

export enum LinkType {
  sender = "sender",
  receiver = "receiver"
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
   * Closes the underlying amqp link and session in rhea if open. Also removes all the event
   * handlers added in the rhea-promise library on the link and it's session
   * @return {Promise<void>} Promise<void>
   * - **Resolves** the promise when rhea emits the "sender_close" | "receiver_close" event.
   * - **Rejects** the promise with an AmqpError when rhea emits the
   * "sender_error" | "receiver_error" event while trying to close the amqp link.
   */
  async close(): Promise<void> {
    this.removeAllListeners();
    await new Promise<void>((resolve, reject) => {
      log.error("[%s] The %s is open ? -> %s", this.connection.id, this.type, this.isOpen());
      if (this.isOpen()) {
        const errorEvent = this.type === LinkType.sender
          ? SenderEvents.senderError
          : ReceiverEvents.receiverError;
        const closeEvent = this.type === LinkType.sender
          ? SenderEvents.senderClose
          : ReceiverEvents.receiverClose;
        let onError: Func<RheaEventContext, void>;
        let onClose: Func<RheaEventContext, void>;
        let waitTimer: any;

        const removeListeners = () => {
          clearTimeout(waitTimer);
          this.actionInitiated--;
          this._link.removeListener(errorEvent, onError);
          this._link.removeListener(closeEvent, onClose);
        };

        onClose = (context: RheaEventContext) => {
          removeListeners();
          log[this.type]("[%s] Resolving the promise as the amqp %s has been closed.",
            this.connection.id, this.type);
          return resolve();
        };

        onError = (context: RheaEventContext) => {
          removeListeners();
          log.error("[%s] Error occurred while closing amqp %s: %O.",
            this.connection.id, this.type, context.session!.error);
          return reject(context.session!.error);
        };

        const actionAfterTimeout = () => {
          removeListeners();
          const msg: string = `Unable to close the amqp %s ${this.name} due to operation timeout.`;
          log.error("[%s] %s", this.connection.id, this.type, msg);
          return reject(new OperationTimeoutError(msg));
        };

        // listeners that we add for completing the operation are added directly to rhea's objects.
        this._link.once(closeEvent, onClose);
        this._link.once(errorEvent, onError);
        waitTimer = setTimeout(actionAfterTimeout,
          this.connection.options!.operationTimeoutInSeconds! * 1000);
        this._link.close();
        this.actionInitiated++;
      } else {
        return resolve();
      }
    });
    log[this.type]("[%s] %s has been closed, now closing it's session.",
      this.connection.id, this.type);
    return this._session.close();
  }

  /**
   * Adds event listeners for the possible events that can occur on the link object and
   * re-emits the same event back with the received arguments from rhea's event emitter.
   * @private
   * @returns {void} void
   */
  private _initializeEventListeners(): void {
    const events = this.type === LinkType.sender ? SenderEvents : ReceiverEvents;
    for (const eventName in events) {
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
