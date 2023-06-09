// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the Apache License. See License in the project root for license information.

import {
  SenderOptions as RheaSenderOptions, Delivery, Message, Sender as RheaSender
} from "rhea";
import { Session } from "./session";
import { SenderEvents } from "rhea";
import { Link, LinkType } from './link';
import { OnAmqpEvent } from "./eventContext";

/**
 * Descibes the options that can be provided while creating an AMQP Basesender.
 * @interface BaseSenderOptions
 */
export interface BaseSenderOptions extends RheaSenderOptions {
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
 * Descibes the options that can be provided while creating an AMQP sender.
 * @interface SenderOptions
 */
export interface SenderOptions extends BaseSenderOptions {
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
}

/**
 * Describes the event listeners that can be added to the Sender.
 * @interface Sender
 */
export declare interface Sender {
  on(event: SenderEvents, listener: OnAmqpEvent): this;
}

/**
 * Describes the base sender that wraps the rhea sender.
 * @class BaseSender
 */
export class BaseSender extends Link {

  constructor(session: Session, sender: RheaSender, options?: BaseSenderOptions) {
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
}

export class SenderSendOptions {
  /**
   * The message format. Specify this if a message with custom format needs to be sent.
   * `0` implies the standard AMQP 1.0 defined format. If no value is provided, then the
   * given message is assumed to be of type Message interface and encoded appropriately.
   */
  format?: number;
  /**
   * The message tag if any.
   */
  tag?: Buffer | string;
}

/**
 * Describes the AMQP Sender.
 * @class Sender
 */
export class Sender extends BaseSender {

  constructor(session: Session, sender: RheaSender, options?: SenderOptions) {
    super(session, sender, options);
  }

  /**
   * Sends the message
   * @param {Message | Buffer} msg The message to be sent. For default AMQP format msg parameter
   * should be of type Message interface. For a custom format, the msg parameter should be a Buffer
   * and a valid value should be passed to the `format` argument.
   * @param {SenderSendOptions} [options] Options to configure the tag and message format of the message.
   * @returns {Delivery} Delivery The delivery information about the sent message.
   */
  send(msg: Message | Buffer, options: SenderSendOptions = {}): Delivery {
    return (this._link as RheaSender).send(msg, options.tag, options.format);
  }
}
