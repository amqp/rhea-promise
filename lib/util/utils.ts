// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the Apache License. See License in the project root for license information.

import { EventContext as RheaEventContext } from "rhea";
import { Link } from "../link";
import { Session } from "../session";
import { Connection } from "../connection";
import * as log from "../log";
import { EventContext } from '../eventContext';

/**
 * Defines a mapping for Http like response status codes for different status-code values
 * provided by an AMQP broker.
 * @enum AmqpResponseStatusCode
 */
export enum AmqpResponseStatusCode {
  Continue = 100,
  SwitchingProtocols = 101,
  OK = 200,
  Created = 201,
  Accepted = 202,
  NonAuthoritativeInformation = 203,
  NoContent = 204,
  ResetContent = 205,
  PartialContent = 206,
  Ambiguous = 300,
  MultipleChoices = 300,
  Moved = 301,
  MovedPermanently = 301,
  Found = 302,
  Redirect = 302,
  RedirectMethod = 303,
  SeeOther = 303,
  NotModified = 304,
  UseProxy = 305,
  Unused = 306,
  RedirectKeepVerb = 307,
  TemporaryRedirect = 307,
  BadRequest = 400,
  Unauthorized = 401,
  PaymentRequired = 402,
  Forbidden = 403,
  NotFound = 404,
  MethodNotAllowed = 405,
  NotAcceptable = 406,
  ProxyAuthenticationRequired = 407,
  RequestTimeout = 408,
  Conflict = 409,
  Gone = 410,
  LengthRequired = 411,
  PreconditionFailed = 412,
  RequestEntityTooLarge = 413,
  RequestUriTooLong = 414,
  UnsupportedMediaType = 415,
  RequestedRangeNotSatisfiable = 416,
  ExpectationFailed = 417,
  UpgradeRequired = 426,
  InternalServerError = 500,
  NotImplemented = 501,
  BadGateway = 502,
  ServiceUnavailable = 503,
  GatewayTimeout = 504,
  HttpVersionNotSupported = 505
}

/**
 * Provides a list of predefined (amqp) protocol level properties for an amqp message.
 */
export const messageProperties: string[] = [
  "message_id", "reply_to", "to", "correlation_id", "content_type", "absolute_expiry_time",
  "group_id", "group_sequence", "reply_to_group_id", "content_encoding", "creation_time", "subject",
  "user_id"
];

/**
 * Provides a list of predefined (amqp) protocol level properties for an amqp message header.
 */
export const messageHeader: string[] = [
  "first_acquirer", "delivery_count", "ttl", "durable", "priority"
];

/**
 * Type declaration for a Function type where T is the input to the function and V is the output of the function.
 */
export type Func<T, V> = (a: T) => V;

/**
 * Determines whether the given error object is like an AmqpError object.
 * @param {object} err The AmqpError object
 * @returns {boolean} result - `true` if it is an AMQP Error; `false` otherwise.
 */
export function isAmqpError(err: any): boolean {
  if (!err || typeof err !== "object") {
    throw new Error("err is a required parameter and must be of type 'object'.");
  }
  let result = false;
  if (((err.condition && typeof err.condition === "string") && (err.description && typeof err.description === "string"))
    || (err.value && Array.isArray(err.value))
    || (err.constructor && err.constructor.name === "c")) {
    result = true;
  }
  return result;
}

/**
 * Describes the options that can be provided while parsing connection strings.
 * The connection string usually looks like `{A}={B};{C}={D}`.
 * @interface ConnectionStringParseOptions
 */
export interface ConnectionStringParseOptions {
  /**
   * @property {string} [entitySeperator] Describes the separator that separates different parts/
   * entities in a connection string. Default value `;`.
   */
  entitySeperator?: string;
  /**
   * @property {string} [keyValueSeparator] Describes the separator that separates the key/value
   * pair for an entity/part in a connection string; Default value `=`.
   */
  keyValueSeparator?: string;
}

/**
 * Defines an object with possible properties defined in T.
 * @type ParsedOutput<T>
 */
export type ParsedOutput<T> = {
  [P in keyof T]: T[P];
};

/**
 * A wrapper for setTimeout that resolves a promise after t milliseconds.
 * @param {number} t - The number of milliseconds to be delayed.
 * @param {T} value - The value to be resolved with after a timeout of t milliseconds.
 * @returns {Promise<T | void>} - Resolved promise
 */
export function delay<T>(t: number, value?: T): Promise<T | void> {
  return new Promise((resolve) => setTimeout(() => resolve(value), t));
}

/**
 * Parses the connection string and returns an object of type T.
 * @param {string} connectionString The connection string to be parsed.
 * @returns {ParsedOutput<T>} ParsedOutput<T>.
 */
export function parseConnectionString<T>(connectionString: string, options?: ConnectionStringParseOptions): ParsedOutput<T> {
  if (!options) options = {};
  const entitySeperator = options.entitySeperator || ";";
  const keyValueSeparator = options.keyValueSeparator || "=";

  return connectionString.split(entitySeperator).reduce((acc, part) => {
    const splitIndex = part.indexOf(keyValueSeparator);
    return {
      ...acc,
      [part.substring(0, splitIndex)]: part.substring(splitIndex + 1)
    };
  }, {} as any);
}

/**
 * @ignore
 * Describes the parameters to be provided to the function `emitEvent()`.
 * @interface EmitParameters
 */
export interface EmitParameters {
  rheaContext: RheaEventContext;
  emitter: Link | Session | Connection;
  eventName: string;
  connectionId: string;
  emitterType: "sender" | "receiver" | "session" | "connection";
}

/**
 * @ignore
 * Emits an event.
 * @param params parameters needed to emit an event from one of the rhea-promise objects.
 * @returns void
 */
export function emitEvent(params: EmitParameters): void {
  const emit = () => {
    const id = params.emitter &&
      ((params.emitter as Connection | Session).id || (params.emitter as Link).name);
    log[params.emitterType]("[%s] %s '%s' got event: '%s'. Re-emitting the translated context.",
      params.connectionId, params.emitterType, id, params.eventName);
    params.emitter.emit(params.eventName,
      EventContext.translate(params.rheaContext, params.emitter, params.eventName));
  };
  if (params.eventName.indexOf("error") !== -1 && params.emitter.actionInitiated > 0) {
    log[params.emitterType]("[%s] %s got event: '%s'. Will re-emit in the next tick, since " +
      "this happened before the promise for create/close was resolved.", params.connectionId,
    params.emitterType, params.eventName);
    // setTimeout() without any time is equivalent to process.nextTick() and works in node.js and
    // browsers. We wait for a tick to emit error events in general. This should give enough
    // time for promises to resolve on *_open (create) and *_close (close).
    setTimeout(emit);
  } else {
    emit();
  }
}

export interface AbortSignalLike {
  /**
   * Indicates if the signal has already been aborted.
   */
  readonly aborted: boolean;
  /**
   * Add new "abort" event listener, only support "abort" event.
   */
  addEventListener(
    type: "abort",
    listener: (this: AbortSignalLike, ev: any) => any,
    options?: any
  ): void;
  /**
   * Remove "abort" event listener, only support "abort" event.
   */
  removeEventListener(
    type: "abort",
    listener: (this: AbortSignalLike, ev: any) => any,
    options?: any
  ): void;
}

export const abortErrorName = "AbortError";

/**
 * Helper method to return an Error to be used when an operation is cancelled
 * using an AbortSignalLike
 */
export function createAbortError(): Error {
  const error = new Error("The operation was aborted.");
  error.name = abortErrorName;
  return error;
}
