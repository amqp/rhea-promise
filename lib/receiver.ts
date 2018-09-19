// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the Apache License. See License in the project root for license information.

import * as rhea from "rhea";

import { Session } from "./session";

import { ReceiverEvents, Receiver as RheaReceiver } from "rhea";

import { Link, LinkType } from "./link";

/**
 * Descibes the options that can be provided while creating an AMQP sender.
 * @interface ReceiverOptions
 */
export interface ReceiverOptions extends rhea.ReceiverOptions {
  /**
   * @property {rhea.OnAmqpEvent} [onMessage] The handler that can be provided for receiving the
   * "message" event when a message is received on the underling rhea receiver.
   */
  onMessage?: rhea.OnAmqpEvent;
  /**
   * @property {rhea.OnAmqpEvent} [onError] The handler that can be provided for receiving any
   * errors that occur on the "receiver_error" event on the underlying rhea receiver.
   */
  onError?: rhea.OnAmqpEvent;
  /**
   * @property {rhea.OnAmqpEvent} [onClose] The handler that can be provided for receiving the
   * "receiver_close" event on the underlying rhea receiver.
   */
  onClose?: rhea.OnAmqpEvent;
  /**
   * @property {rhea.OnAmqpEvent} [onSessionError] The handler that can be provided for receiving
   * the "session_error" event that occurs on the underlying rhea session.
   */
  onSessionError?: rhea.OnAmqpEvent;
  /**
   * @property {rhea.OnAmqpEvent} [onSessionClose] The handler that can be provided for receiving the
   * "session_close" event that occurs on the underlying rhea session.
   */
  onSessionClose?: rhea.OnAmqpEvent;
}

/**
 * Describes the event listeners that can be added to the Receiver.
 * @interface Receiver
 */
export declare interface Receiver {
  on(event: ReceiverEvents, listener: rhea.OnAmqpEvent): this;
}

/**
 * Describes the receiver that wraps the rhea receiver.
 * @class Receiver.
 */
export class Receiver extends Link {
  constructor(session: Session, receiver: rhea.Receiver, options?: ReceiverOptions) {
    super(LinkType.receiver, session, receiver, options);
  }

  get drain(): boolean {
    return (this._link as RheaReceiver).drain;
  }

  addCredit(credit: number): void {
    (this._link as RheaReceiver).add_credit(credit);
  }

  setCreditWindow(creditWindow: number): void {
    (this._link as RheaReceiver).set_credit_window(creditWindow);
  }
}
