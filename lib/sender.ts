/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as rhea from "rhea";
import * as log from "./log";
import { Session } from "./session";
import { Connection } from "./connection";
import { SenderEvents } from "rhea";
import { Func } from "./util/utils";

/**
 * Descibes the options that can be provided while creating an AMQP sender.
 * @interface SenderOptions
 */
export interface SenderOptions extends rhea.SenderOptions {
  /**
   * @property {rhea.OnAmqpEvent} [onAccepted] The handler that can be provided for receiving the
   * "accepted" event after a message is sent from the underlying rhea sender.
   */
  onAccepted?: rhea.OnAmqpEvent;
  /**
   * @property {rhea.OnAmqpEvent} [onRejected] The handler that can be provided for receiving the
   * "rejected" event after a message is sent from the underlying rhea sender.
   */
  onRejected?: rhea.OnAmqpEvent;
  /**
   * @property {rhea.OnAmqpEvent} [onReleased] The handler that can be provided for receiving the
   * "released" event after a message is sent from the underlying rhea sender.
   */
  onReleased?: rhea.OnAmqpEvent;
  /**
   * @property {rhea.OnAmqpEvent} [onModified] The handler that can be provided for receiving the
   * "modified" event after a message is sent from the underlying rhea sender.
   */
  onModified?: rhea.OnAmqpEvent;
  /**
   * @property {rhea.OnAmqpEvent} [onError] The handler that can be provided for receiving any
   * errors that occur on the "sender_error" event.
   */
  onError?: rhea.OnAmqpEvent;
  /**
   * @property {rhea.OnAmqpEvent} [onClose] The handler that can be provided for receiving the
   * "sender_close" event.
   */
  onClose?: rhea.OnAmqpEvent;
  /**
   * @property {rhea.OnAmqpEvent} [onSessionError] The handler that can be provided for receiving
   * the "session_error" event that occurs on the underlying session.
   */
  onSessionError?: rhea.OnAmqpEvent;
  /**
   * @property {rhea.OnAmqpEvent} [onSessionClose] The handler that can be provided for receiving the
   * "session_close" event that occurs on the underlying session.
   */
  onSessionClose?: rhea.OnAmqpEvent;
}

/**
 * Describes the sender that wraps the rhea sender.
 * @class Sender
 */
export class Sender {
  senderOptions?: SenderOptions;
  private _session: Session;
  private _sender: rhea.Sender;

  constructor(session: Session, sender: rhea.Sender, options?: SenderOptions) {
    this._session = session;
    this._sender = sender;
    this.senderOptions = options;
  }

  get name(): string {
    return this._sender.name;
  }

  get error(): rhea.AmqpError | Error | undefined {
    return this._sender.error;
  }

  get properties(): rhea.Dictionary<any> {
    return this._sender.properties;
  }

  get source(): rhea.Source {
    return this._sender.source;
  }

  get target(): rhea.TerminusOptions {
    return this._sender.target;
  }

  get address(): string {
    return this.source.address;
  }
  get credit(): number {
    return (this._sender as any).credit;
  }

  get session(): Session {
    return this._session;
  }

  get connection(): Connection {
    return this._session.connection;
  }

  /**
   * Determines whether the message is sendable.
   * @returns {boolean} `true` Sendable. `false` Not Sendable.
   */
  sendable(): boolean {
    return this._sender.sendable();
  }

  /**
   * Sends the message
   * @param {rhea.Message | Buffer} msg The AMQP message to be sent.
   * @param {Buffer | string} [tag] The optional tag that can be sent
   * @param {number} [format] The format in which the message needs to be sent.
   * @returns {rhea.Delivery} Delivery The delivery information about the sent message.
   */
  send(msg: rhea.Message | Buffer, tag?: Buffer | string, format?: number): rhea.Delivery {
    return this._sender.send(msg, tag, format);
  }

  /**
   * Determines whether the sender link and its underlying session is open.
   * @returns {boolean} `true` open. `false` closed.
   */
  isOpen(): boolean {
    let result = false;
    if (this._session.isOpen() && this._sender.is_open()) {
      result = true;
    }
    return result;
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
    return this._sender.is_closed();
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
    return this._sender.is_itself_closed();
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
   * Removes the sender and it's underlying session from the internal map.
   * @returns {void} void
   */
  remove(): void {
    if (this._sender) {
      this._sender.remove();
    }
    if (this._session) {
      this._session.remove();
    }
  }

  /**
   * Closes the amqp sender.
   * @return {Promise<void>} Promise<void>
   * - **Resolves** the promise when rhea emits the "sender_close" event.
   * - **Rejects** the promise with an AmqpError when rhea emits the
   * "sender_error" event while trying to close an amqp sender.
   */
  close(): Promise<void> {
    const senderClose = new Promise<void>((resolve, reject) => {
      log.error("[%s] The sender is open ? -> %s", this.connection.id, this.isOpen());
      if (this.isOpen()) {
        let onError: Func<rhea.EventContext, void>;
        let onClose: Func<rhea.EventContext, void>;
        let waitTimer: any;

        const removeListeners = () => {
          clearTimeout(waitTimer);
          this._sender.removeListener(SenderEvents.senderError, onError);
          this._sender.removeListener(SenderEvents.senderClose, onClose);
        };

        onClose = (context: rhea.EventContext) => {
          removeListeners();
          setImmediate(() => {
            log.sender("[%s] Resolving the promise as the amqp sender has been closed.",
              this.connection.id);
            resolve();
          });
        };

        onError = (context: rhea.EventContext) => {
          removeListeners();
          log.error("[%s] Error occurred while closing amqp sender: %O.",
            this.connection.id, context.session!.error);
          reject(context.session!.error);
        };

        const actionAfterTimeout = () => {
          removeListeners();
          const msg: string = `Unable to close the amqp sender ${this.name} due to operation timeout.`;
          log.error("[%s] %s", this.connection.id, msg);
          reject(new Error(msg));
        };

        this._sender.once(SenderEvents.senderClose, onClose);
        this._sender.once(SenderEvents.senderError, onError);
        waitTimer = setTimeout(actionAfterTimeout, this.connection.options!.promiseTimeoutInSeconds! * 1000);
        this._sender.close();
      } else {
        resolve();
      }
    });

    return senderClose.then(() => {
      log.sender("[%s] sender has been closed, now closing it's session.", this.connection.id);
      return this._session.close();
    });
  }

  setMaxListeners(count: number): void {
    this._sender.setMaxListeners(count);
  }

  getMaxListeners(): number {
    return this._sender.getMaxListeners();
  }

  /**
   * Registers the given handler for the specified event.
   * @param {rhea.SenderEvents} event The event for which the handler needs to be registered.
   * @param {rhea.OnAmqpEvent} handler The handler function that needs to be executed when the event
   * occurs
   * @returns {void} void.
   */
  registerHandler(event: SenderEvents, handler: rhea.OnAmqpEvent): void {
    this._sender.on(event, handler);
  }

  /**
   * Removes the given handler for the specified event.
   * @param {rhea.SenderEvents} event The event for which the handler needs to be removed.
   * @param {rhea.OnAmqpEvent} handler The handler function that needs to be removed.
   * @returns {void} void.
   */
  removeHandler(event: SenderEvents, handler: rhea.OnAmqpEvent): void {
    this._sender.removeListener(event, handler);
  }

  /**
   * Registers the given handler for the specified event on the session object.
   * @param {rhea.SessionEvents} event The event for which the handler needs to be registered.
   * @param {rhea.OnAmqpEvent} handler The handler function that needs to be executed when the event
   * occurs
   * @returns {void} void.
   */
  registerSessionHandler(event: rhea.SessionEvents, handler: rhea.OnAmqpEvent): void {
    this._session.registerHandler(event, handler);
  }

  /**
   * Removes the given handler for the specified event from the session object.
   * @param {rhea.SessionEvents} event The event for which the handler needs to be removed.
   * @param {rhea.OnAmqpEvent} handler The handler function that needs to be removed.
   * @returns {void} void.
   */
  removeSessionHandler(event: rhea.SessionEvents, handler: rhea.OnAmqpEvent): void {
    this._session.removeHandler(event, handler);
  }
}
