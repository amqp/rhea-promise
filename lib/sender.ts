// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the Apache License. See License in the project root for license information.

import {
  SenderOptions as RheaSenderOptions, Delivery, Message, Sender as RheaSender
} from "rhea";
import { Session } from "./session";
import { SenderEvents } from "rhea";
import { Link, LinkType } from './link';
import { OnAmqpEvent, EventContext } from "./eventContext";
import * as log from "./log";
import { Func } from "./util/utils";
import { OperationTimeoutError } from "./operationTimeoutError";

/**
 * Descibes the options that can be provided while creating an AMQP sender.
 * @interface SenderOptions
 */
export interface SenderOptions extends RheaSenderOptions {
  /**
   * @property {OnAmqpEvent} [onAccepted] The handler that can be provided for receiving the
   * "accepted" event after a message is sent from the underlying rhea sender.
   */
  onAccepted?: OnAmqpEvent;
  /**
   * @property {OnAmqpEvent} [onRejected] The handler that can be provided for receiving the
   * "rejected" event after a message is sent from the underlying rhea sender.
   */
  onRejected?: OnAmqpEvent;
  /**
   * @property {OnAmqpEvent} [onReleased] The handler that can be provided for receiving the
   * "released" event after a message is sent from the underlying rhea sender.
   */
  onReleased?: OnAmqpEvent;
  /**
   * @property {OnAmqpEvent} [onModified] The handler that can be provided for receiving the
   * "modified" event after a message is sent from the underlying rhea sender.
   */
  onModified?: OnAmqpEvent;
  /**
   * @property {OnAmqpEvent} [onError] The handler that can be provided for receiving any
   * errors that occur on the "sender_error" event.
   */
  onError?: OnAmqpEvent;
  /**
   * @property {OnAmqpEvent} [onClose] The handler that can be provided for receiving the
   * "sender_close" event.
   */
  onClose?: OnAmqpEvent;
  /**
   * @property {OnAmqpEvent} [onSessionError] The handler that can be provided for receiving
   * the "session_error" event that occurs on the underlying session.
   */
  onSessionError?: OnAmqpEvent;
  /**
   * @property {OnAmqpEvent} [onSessionClose] The handler that can be provided for receiving the
   * "session_close" event that occurs on the underlying session.
   */
  onSessionClose?: OnAmqpEvent;
}

/**
 * Describes the event listeners that can be added to the Sender.
 * @interface Sender
 */
export declare interface Sender {
  on(event: SenderEvents, listener: OnAmqpEvent): this;
}

/**
 * Describes the sender that wraps the rhea sender.
 * @class Sender
 */
export class Sender extends Link {
  senderOptions?: SenderOptions;

  constructor(session: Session, sender: RheaSender, options?: SenderOptions) {
    super(LinkType.sender, session, sender, options);
  }

  setDrained(drained: boolean): void {
    (this._link as RheaSender).set_drained(drained);
  }

  /**
   * Determines whether the message is sendable.
   * @returns {boolean} `true` Sendable. `false` Not Sendable.
   */
  sendable(): boolean {
    return (this._link as RheaSender).sendable();
  }

  /**
   * Sends the message
   * @param {Message | Buffer} msg The message to be sent. For default AMQP format msg parameter
   * should be of type Message interface. For a custom format, the msg parameter should be a Buffer
   * and a valid value should be passed to the `format` argument.
   * @param {Buffer | string} [tag] The message tag if any.
   * @param {number} [format] The message format. Specify this if a message with custom format needs
   * to be sent. `0` implies the standard AMQP 1.0 defined format. If no value is provided, then the
   * given message is assumed to be of type Message interface and encoded appropriately.
   * @returns {Delivery} Delivery The delivery information about the sent message.
   */
  send(msg: Message | Buffer, tag?: Buffer | string, format?: number): Delivery {
    return (this._link as RheaSender).send(msg, tag, format);
  }

  /**
   * Async send that returns a Promise<Delivery> after a message has been sent successfully else
   * rejects the promise with an error.
   *
   * @param msg The message to be sent. For default AMQP format msg parameter
   * should be of type Message interface. For a custom format, the msg parameter should be a Buffer
   * and a valid value should be passed to the `format` argument.
   * @param tag The message tag if any.
   * @param format The message format. Specify this if a message with custom format needs
   * to be sent. `0` implies the standard AMQP 1.0 defined format. If no value is provided, then the
   * given message is assumed to be of type Message interface and encoded appropriately.
   *
   * @returns Promise<Delivery>
   */
  sendAsync(msg: Message | Buffer, tag?: Buffer | string, format?: number): Promise<Delivery> {
    return new Promise<Delivery>((resolve, reject) => {
      let waitTimer: any;
      log.sender(
        "[%s] Sender '%s', credit: %d available: %d",
        this.connection.id,
        this.name,
        this.credit,
        this.session.outgoing.available()
      );
      if (this.sendable()) {
        let onRejected: Func<EventContext, void>;
        let onReleased: Func<EventContext, void>;
        let onModified: Func<EventContext, void>;
        let onAccepted: Func<EventContext, void>;
        const removeListeners = (): void => {
          clearTimeout(waitTimer);
          this.removeListener(SenderEvents.rejected, onRejected);
          this.removeListener(SenderEvents.accepted, onAccepted);
          this.removeListener(SenderEvents.released, onReleased);
          this.removeListener(SenderEvents.modified, onModified);
        };

        onAccepted = (context: EventContext) => {
          // Since we will be adding listener for accepted and rejected event every time
          // we send a message, we need to remove listener for both the events.
          // This will ensure duplicate listeners are not added for the same event.
          removeListeners();
          log.sender(
            "[%s] Sender '%s', got event accepted.",
            this.connection.id,
            this.name
          );
          resolve();
        };
        onRejected = (context: EventContext) => {
          removeListeners();
          log.error(
            "[%s] Sender '%s', got event rejected.",
            this.connection.id,
            this.name
          );
          const err = context!.delivery!.remote_state!.error;
          reject(err);
        };
        onReleased = (context: EventContext) => {
          removeListeners();
          log.error(
            "[%s] Sender '%s', got event released.",
            this.connection.id,
            this.name
          );
          let err: Error;
          if (context!.delivery!.remote_state!.error) {
            err = context!.delivery!.remote_state!.error;
          } else {
            err = new Error(
              `[${this.connection.id}]Sender '${this.name}', ` +
              `received a release disposition.Hence we are rejecting the promise.`
            );
          }
          reject(err);
        };
        onModified = (context: EventContext) => {
          removeListeners();
          log.error(
            "[%s] Sender '%s', got event modified.",
            this.connection.id,
            this.name
          );
          let err: Error;
          if (context!.delivery!.remote_state!.error) {
            err = context!.delivery!.remote_state!.error;
          } else {
            err = new Error(
              `[${this.connection.id}] Sender "${this.name}", ` +
              `received a modified disposition. Hence we are rejecting the promise.`
            );
          }
          reject(err);
        };

        const actionAfterTimeout = () => {
          removeListeners();
          const desc: string =
            `[${this.connection.id}] Sender "${this.name}" on amqp session "${this.session.id}"` +
            `with address "${this.address}", was not able to send the message right now, due ` +
            `to operation timeout.`;
          log.error(desc);
          return reject(new OperationTimeoutError(desc));
        };

        this.on(SenderEvents.accepted, onAccepted);
        this.on(SenderEvents.rejected, onRejected);
        this.on(SenderEvents.modified, onModified);
        this.on(SenderEvents.released, onReleased);
        waitTimer = setTimeout(
          actionAfterTimeout,
          this.connection.options!.operationTimeoutInSeconds! * 1000
        );
        try {
          const delivery = this.send(msg, tag, format);
          log.sender(
            "[%s] Sender '%s', sent message with delivery id: %d",
            this.connection.id,
            this.name,
            delivery.id
          );
        } catch (error) {
          removeListeners();
          return reject(error);
        }
      } else {
        // let us retry to send the message after some time.
        const msg =
          `[${this.connection.id}] Sender "${this.name}" on amqp session "${this.session.id}", ` +
          `cannot send the message right now as it does not have enough credit. Please try later.`;
        log.error(msg);
        reject(new Error(msg));
      }
    });
  }
}
