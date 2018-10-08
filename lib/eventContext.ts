// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the Apache License. See License in the project root for license information.

import { Connection } from "./connection";
import { Container } from "./container";
import { Session } from "./session";
import {
  Delivery, Message, ConnectionError, EventContext as RheaEventContext
} from "rhea";
import { Receiver } from "./receiver";
import { Sender } from "./sender";
import { Link, LinkType } from './link';
import * as log from "./log";

/**
 * Describes the signature of the event handler for any event emitted by rhea-promise.
 * @type OnAmqpEvent
 * @param {EventContext} context The rhea-promise event context.
 */
export type OnAmqpEvent = (context: EventContext) => void;

/**
 * Defines the AMQP Connection context. This context is provided when you add an
 * event handler to any of the objects.
 * @interface EventContext
 */
export interface EventContext {
  /**
   * @property {Connection} connection The amqp connection.
   */
  connection: Connection;
  /**
   * @property {Container} container The amqp container
   */
  container: Container;
  /**
   * @property {Session} [session] The amqp session link that was created on the amqp connection.
   */
  session?: Session;
  /**
   * @property {Delivery} [delivery] The amqp delivery that is received after sending a message.
   */
  delivery?: Delivery;
  /**
   * @property {AmqpMessage} [message] The amqp message that is received in the message event
   * handler when rhea emits a message event on a receiver.
   */
  message?: Message;
  /**
   * @property {Receiver} [receiver] The amqp receiver link that was created on the amqp connection.
   */
  receiver?: Receiver;
  /**
   * @property {Sender} [sender] The amqp sender link that was created on the amqp connection.
   */
  sender?: Sender;
  /**
   * @property {Error | ConnectionError} [error] An optional error object.
   * - On `connection_error` event this property will be present. It will have the same information as
   * `connection.error` but the type will be `ConnectionError`.
   * - An error with SASL will be available through this property, but not through `connection.error`
   * (as the amqp connection was never established).
   * - On `disconnected` event the context will have an error property that will be of type
   * `Error` (or some subclass) as emitted by the underlying socket.
   * - The `session_error`, `sender_error` and `receiver_error` events will not have this (`error`)
   * property on the EventContext.
   */
  error?: Error | ConnectionError;
  /**
   * @property {boolean} [reconnecting] The value is true if the library is attempting to automatically
   * reconnect and false if it has reached the reconnect limit. If reconnect has not been enabled
   * or if the connection is a tcp server, then the reconnecting property is undefined. This property
   * is used in conjunction with "disconnected" event.
   */
  reconnecting?: boolean;
  /**
   * @property {RheaEventContext} _context The EventContext emitted by objects from rhea. This
   * can be used as a fallback mechanism when the translated EventContext provided by this library
   * has any issues.
   */
  _context: RheaEventContext;
}

export module EventContext {
  /**
   * Translates rhea's EventContext into rhea-promise EventContext
   * @param rheaContext The received context from rhea's event emitter
   * @param emitter The rhea-promise equivalent object that is supposed emit the same event
   * @param eventName The name of the event for which the context will be translated
   *
   * @returns EventContext The translated EventContext.
   */
  export function translate(
    rheaContext: RheaEventContext,
    emitter: Link | Session | Connection,
    eventName: string): EventContext {
    const connectionId = (rheaContext.connection && rheaContext.connection.options) ? rheaContext.connection.options.id : "";
    log.contextTranslator("[%s] Translating the context for event: '%s'.", connectionId, eventName);
    // initialize the result
    const result: EventContext = {
      _context: rheaContext,
      ...rheaContext
    } as any;

    const connection: Connection = emitter instanceof Connection
      ? emitter
      : (emitter as Link | Session).connection;

    // set rhea-promise connection and container
    result.connection = connection;
    result.container = connection.container;

    // set rhea-promise session, sender/receiver.
    if (emitter instanceof Link) {
      result.session = emitter.session;
      if (emitter.type === LinkType.receiver && rheaContext.receiver) {
        result.receiver = emitter as Receiver;
      } else if (emitter.type === LinkType.sender && rheaContext.sender) {
        result.sender = emitter as Sender;
      }
    } else if (emitter instanceof Session) {
      result.session = emitter;
    }

    return result;
  }
}
