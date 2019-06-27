// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the Apache License. See License in the project root for license information.

/**
 * Defines the error that occurs when an operation timeout occurs.
 */
export class OperationTimeoutError extends Error {
  /**
   * Describes the name of the error.
   */
  readonly name: string = "OperationTimeoutError";

  constructor(message: string) {
    super(message);
  }
}

/**
 * Defines the error that occurs when the Sender does not have enough credit.
 */
export class InsufficientCreditError extends Error {
  /**
   * Describes the name of the error.
   */
  readonly name: string = "InsufficientCreditError";

  constructor(message: string) {
    super(message);
  }
}

/**
 * Defines the error that occurs when the Sender fails to send a message.
 */
export class SendOperationFailedError extends Error {
  /**
   * Describes the name of the error.
   */
  readonly name: string = "SendOperationFailedError";

  constructor(
    /**
     * Provides descriptive information about the error.
     */
    readonly message: string,
    /**
     * Provides the corresponding event associated with the `SendOperationFailedError`.
     * - If the code is `"sender_error"` | `"session_error"`, then the send operation failed
     * due to the sender link getting disconnected.
     * - If the code is `"rejected"` | `"released"` | `"modified"`, then the send operation failed
     * because the server is currently unable to accept the message being sent. Please take a look
     * at the [AMQP 1.0 specification - "Section 3.4 Delivery State"](http://www.amqp.org/sites/amqp.org/files/amqp.pdf)
     * for details about `"rejected"` | `"released"` | `"modified"` disposition.
     */
    readonly code: "rejected" | "released" | "modified" | "sender_error" | "session_error",
    /**
     * Describes the underlying error that caused the send operation to fail.
     */
    readonly innerError?: Error) {
    super(message);
    this.code = code;
    this.innerError = innerError;
  }
}
