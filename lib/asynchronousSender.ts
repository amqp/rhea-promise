// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the Apache License. See License in the project root for license information.

import {
   Delivery, Message, Sender as RheaSender, SessionEvents
} from "rhea";
import * as log from "./log";
import { Sender, SenderOptionsBase } from "./sender";
import { SenderEvents } from "rhea";
import { OnAmqpEvent, EventContext } from "./eventContext";
import { Session } from "./session";
import { OperationTimeoutError } from "./operationTimeoutError";

/**
 * @internal
 */
export interface PromiseLike {
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
  timer: NodeJS.Timer;
}

/**
 * Describes the event listeners that can be added to the AsynchronousSender.
 * @interface Sender
 */
export declare interface AsynchronousSender {
  on(event: SenderEvents, listener: OnAmqpEvent): this;
}

export interface AsynchronousSenderOptions extends SenderOptionsBase {
  /**
   * The duration in which the promise to send the message should complete (resolve/reject).
   * If it is not completed, then the Promise will be rejected after timeout occurs.
   * Default: `20 seconds`.
   */
  messageTimeoutInSeconds?: number;
}

/**
 * Describes the async version of the sender where one can await on the message being sent.
 * @class AsynchronousSender
 */
export class AsynchronousSender extends Sender {
  /**
   * Options that can be provided to the asynchronous sender.
   */
  asyncSenderOptions?: AsynchronousSenderOptions;
  /**
   * The duration in which the promise to send the message should complete (resolve/reject).
   * If it is not completed, then the Promise will be rejected after timeout occurs.
   * Default: `20 seconds`.
   */
  messageTimeoutInSeconds: number;
  /**
   * @property {Map<number, PromiseLike} deliveryDispositionMap Maintains a map of delivery of
   * messages that are being sent. It acts as a store for correlating the dispositions received
   * for sent messages.
   */
  deliveryDispositionMap: Map<number, PromiseLike> = new Map<number, PromiseLike>();

  constructor(session: Session, sender: RheaSender, options: AsynchronousSenderOptions = {}) {
    super(session, sender, options);
    this.messageTimeoutInSeconds = options.messageTimeoutInSeconds || 20;

    const onSuccess = (context: EventContext) => {
      const id = context.delivery!.id;
      if (this.deliveryDispositionMap.has(context.delivery!.id)) {
        const promise = this.deliveryDispositionMap.get(id) as PromiseLike;
        clearTimeout(promise.timer);
        log.sender(
          "[%s] Event: 'Accepted', Found the delivery with id %d in the map of " +
          "sender '%s' on amqp session '%s' and cleared the timer.",
          this.connection.id, id, this.name, this.session.id
        );
        const deleteResult = this.deliveryDispositionMap.delete(id);
        log.sender(
          "[%s] Event: 'Accepted', Successfully deleted the delivery with id %d from " +
          "the map of sender '%s' on amqp session '%s' and cleared the timer: %s.",
          this.connection.id, id, this.name, this.session.id, deleteResult
        );
        return promise.resolve(context.delivery);
      }
    };

    const onFailure = (eventName: string, id: number, error?: Error) => {
      if (this.deliveryDispositionMap.has(id)) {
        log.sender(
          "[%s] Event: '%s', Found the delivery with id %d in the map of " +
          "sender '%s' on amqp session '%s' and cleared the timer.",
          this.connection.id, eventName, id, this.name, this.session.id
        );
        const promise = this.deliveryDispositionMap.get(id) as PromiseLike;
        clearTimeout(promise.timer);
        const deleteResult = this.deliveryDispositionMap.delete(id);
        log.sender(
          "[%s] Event: '%s', Successfully deleted the delivery with id %d from the " +
          " map of sender '%s' on amqp session '%s' and cleared the timer: %s.",
          this.connection.id, eventName, id, this.name, this.session.id, deleteResult
        );
        const msg = `Sender '${this.name}' on amqp session ${this.session.id}, received a ` +
          `${eventName} disposition. Hence we are rejecting the promise.`;
        const err = error || new Error(msg);
        return promise.reject(err);
      }
    };

    const onError = (eventName: string, error?: Error) => {
      for (const id of this.deliveryDispositionMap.keys()) {
        onFailure(eventName, id, error);
      }
    };

    this.on(SenderEvents.accepted, onSuccess);
    this.on(SenderEvents.rejected, (context: EventContext) => {
      onFailure(SenderEvents.rejected, context.delivery!.id, context!.delivery!.remote_state!.error);
    });
    this.on(SenderEvents.released, (context: EventContext) => {
      onFailure(SenderEvents.released, context.delivery!.id, context!.delivery!.remote_state!.error);
    });
    this.on(SenderEvents.modified, (context: EventContext) => {
      onFailure(SenderEvents.modified, context.delivery!.id, context!.delivery!.remote_state!.error);
    });
    if (!options.onError) {
      this.on(SenderEvents.senderError, (context: EventContext) => {
        onError(SenderEvents.senderError, context.sender!.error as Error);
      });
    }
    if (!options.onSessionError) {
      this.session.on(SessionEvents.sessionError, (context: EventContext) => {
        onError(SessionEvents.sessionError, context.sender!.error as Error);
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
  sendMessage(msg: Message | Buffer, tag?: Buffer | string, format?: number): Promise<Delivery> {
    return new Promise<Delivery>((resolve, reject) => {
      if (this.sendable()) {
        const timer = setTimeout(() => {
          this.deliveryDispositionMap.delete(delivery.id);
          const message = `[${this.connection.id}] Sender '${this.name}' on amqp session ` +
            `'${this.session.id}', with address '${this.address}' was not able to send the ` +
            `message with delivery id ${delivery.id} right now, due to operation timeout.`;
          log.sender(message);
          return reject(new OperationTimeoutError(message));
        }, this.messageTimeoutInSeconds * 1000);

        const delivery = super.send(msg, tag, format);
        this.deliveryDispositionMap.set(delivery.id, {
          resolve: resolve,
          reject: reject,
          timer: timer
        });
      } else {
        // Please send the message after some time.
        const msg =
          `[${this.connection.id}] Sender "${this.name}" on amqp session "${this.session.id}", ` +
          `with address ${this.address} cannot send the message right now as it does not have ` +
          `enough credit. Please try later.`;
        log.error(msg);
        reject(new Error(msg));
      }
    });
  }
}
