// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the Apache License. See License in the project root for license information.

import {
  Delivery, Message, Sender as RheaSender, SessionEvents
} from "rhea";
import * as log from "./log";
import { BaseSender, BaseSenderOptions } from "./sender";
import { SenderEvents } from "rhea";
import { OnAmqpEvent, EventContext } from "./eventContext";
import { Session } from "./session";
import {
  OperationTimeoutError, InsufficientCreditError, SendOperationFailedError
} from "./errorDefinitions";

/**
 * Describes the interface for the send operation Promise which contains a reference to resolve,
 * reject functions and the timer for that Promise.
 * @interface PromiseLike
 */
export interface PromiseLike {
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
  timer: NodeJS.Timer;
}

/**
 * Describes the event listeners that can be added to the AwaitableSender.
 * @interface Sender
 */
export declare interface AwaitableSender {
  on(event: SenderEvents, listener: OnAmqpEvent): this;
}

export interface AwaitableSenderOptions extends BaseSenderOptions {
  /**
   * The duration in which the promise to send the message should complete (resolve/reject).
   * If it is not completed, then the Promise will be rejected after timeout occurs.
   * Default: `20 seconds`.
   */
  sendTimeoutInSeconds?: number;
}

/**
 * Describes the sender where one can await on the message being sent.
 * @class AwaitableSender
 */
export class AwaitableSender extends BaseSender {
  /**
   * The duration in which the promise to send the message should complete (resolve/reject).
   * If it is not completed, then the Promise will be rejected after timeout occurs.
   * Default: `20 seconds`.
   */
  sendTimeoutInSeconds: number;
  /**
   * @property {Map<number, PromiseLike} deliveryDispositionMap Maintains a map of delivery of
   * messages that are being sent. It acts as a store for correlating the dispositions received
   * for sent messages.
   */
  deliveryDispositionMap: Map<number, PromiseLike> = new Map<number, PromiseLike>();

  constructor(session: Session, sender: RheaSender, options: AwaitableSenderOptions = {}) {
    super(session, sender, options);
    this.sendTimeoutInSeconds = options.sendTimeoutInSeconds || 20;
    /**
     * The handler that will be added on the Sender for `accepted` event. If the delivery id is
     * present in the disposition map then it will clear the timer and resolve the promise with the
     * delivery.
     * @param delivery Delivery associated with message that was sent.
     */
    const onSendSuccess = (delivery: Delivery) => {
      const id = delivery.id;
      if (this.deliveryDispositionMap.has(delivery.id)) {
        const promise = this.deliveryDispositionMap.get(id) as PromiseLike;
        clearTimeout(promise.timer);
        const deleteResult = this.deliveryDispositionMap.delete(id);
        log.sender(
          "[%s] Event: 'Accepted', Successfully deleted the delivery with id %d from " +
          "the map of sender '%s' on amqp session '%s' and cleared the timer: %s.",
          this.connection.id, id, this.name, this.session.id, deleteResult
        );
        return promise.resolve(delivery);
      }
    };

    /**
     * The handler is added on the Sender for `rejected`, `released` and `modified` events.
     * If the delivery is found in the disposition map then the timer will be cleared and the
     * promise will be rejected with an appropriate error message.
     * @param eventName Name of the event that was raised.
     * @param id Delivery id.
     * @param error Error from the context if any.
     */
    const onSendFailure = (
      eventName: "rejected" | "released" | "modified" | "sender_error" | "session_error",
      id: number,
      error?: Error) => {
      if (this.deliveryDispositionMap.has(id)) {
        const promise = this.deliveryDispositionMap.get(id) as PromiseLike;
        clearTimeout(promise.timer);
        const deleteResult = this.deliveryDispositionMap.delete(id);
        log.sender(
          "[%s] Event: '%s', Successfully deleted the delivery with id %d from the " +
          " map of sender '%s' on amqp session '%s' and cleared the timer: %s.",
          this.connection.id, eventName, id, this.name, this.session.id, deleteResult
        );
        const msg = `Sender '${this.name}' on amqp session '${this.session.id}', received a ` +
          `'${eventName}' disposition. Hence we are rejecting the promise.`;
        const err = new SendOperationFailedError(msg, eventName, error);
        log.error("[%s] %s", this.connection.id, msg);
        return promise.reject(err);
      }
    };

    /**
     * The handler that will be added on the Sender link for `sender_error` and on it's underlying
     * session for `session_error` event. These events are raised when the sender link or it's
     * underlying session get disconnected.
     * The handler will clear the timer and reject the promise for every pending send in the map.
     * @param eventName Name of the event that was raised.
     * @param error Error from the context if any
     */
    const onError = (eventName: "sender_error" | "session_error", error?: Error) => {
      for (const id of this.deliveryDispositionMap.keys()) {
        onSendFailure(eventName, id, error);
      }
    };

    this.on(SenderEvents.accepted, (context: EventContext) => {
      onSendSuccess(context.delivery!);
    });
    this.on(SenderEvents.rejected, (context: EventContext) => {
      const delivery = context.delivery!;
      onSendFailure(SenderEvents.rejected, delivery.id, delivery.remote_state && delivery.remote_state.error);
    });
    this.on(SenderEvents.released, (context: EventContext) => {
      const delivery = context.delivery!;
      onSendFailure(SenderEvents.released, delivery.id, delivery.remote_state && delivery.remote_state.error);
    });
    this.on(SenderEvents.modified, (context: EventContext) => {
      const delivery = context.delivery!;
      onSendFailure(SenderEvents.modified, delivery.id, delivery.remote_state && delivery.remote_state.error);
    });

    // The user may have it's custom reconnect logic for bringing the sender link back online and
    // retry logic for sending messages on failures hence they can provide their error handlers
    // for `sender_error` and `session_error`.
    // If the user did not provide its error handler for `sender_error` and `session_error`,
    // then we add our handlers and make sure we clear the timer and reject the promise for sending
    // messages with appropriate Error.
    if (!options.onError) {
      this.on(SenderEvents.senderError, (context: EventContext) => {
        onError(SenderEvents.senderError, context.sender!.error as Error);
      });
    }
    if (!options.onSessionError) {
      this.session.on(SessionEvents.sessionError, (context: EventContext) => {
        onError(SessionEvents.sessionError, context.session!.error as Error);
      });
    }
  }

  /**
   * Sends the message on which one can await to ensure that the message has been successfully
   * delivered.
   * @param {Message | Buffer} msg The message to be sent. For default AMQP format msg parameter
   * should be of type Message interface. For a custom format, the msg parameter should be a Buffer
   * and a valid value should be passed to the `format` argument.
   * @param {Buffer | string} [tag] The message tag if any.
   * @param {number} [format] The message format. Specify this if a message with custom format needs
   * to be sent. `0` implies the standard AMQP 1.0 defined format. If no value is provided, then the
   * given message is assumed to be of type Message interface and encoded appropriately.
   * @returns {Promise<Delivery>} Promise<Delivery> The delivery information about the sent message.
   */
  send(msg: Message | Buffer, tag?: Buffer | string, format?: number): Promise<Delivery> {
    return new Promise<Delivery>((resolve, reject) => {
      log.sender("[%s] Sender '%s' on amqp session '%s', credit: %d available: %d",
        this.connection.id, this.name, this.session.id, this.credit,
        this.session.outgoing.available());
      if (this.sendable()) {
        const timer = setTimeout(() => {
          this.deliveryDispositionMap.delete(delivery.id);
          const message = `Sender '${this.name}' on amqp session ` +
            `'${this.session.id}', with address '${this.address}' was not able to send the ` +
            `message with delivery id ${delivery.id} right now, due to operation timeout.`;
          log.error("[%s] %s", this.connection.id, message);
          return reject(new OperationTimeoutError(message));
        }, this.sendTimeoutInSeconds * 1000);

        const delivery = (this._link as RheaSender).send(msg, tag, format);
        this.deliveryDispositionMap.set(delivery.id, {
          resolve: resolve,
          reject: reject,
          timer: timer
        });
      } else {
        // Please send the message after some time.
        const msg =
          `Sender "${this.name}" on amqp session "${this.session.id}", with address ` +
          `${this.address} cannot send the message right now as it does not have ` +
          `enough credit. Please try later.`;
        log.error("[%s] %s", this.connection.id, msg);
        reject(new InsufficientCreditError(msg));
      }
    });
  }
}
