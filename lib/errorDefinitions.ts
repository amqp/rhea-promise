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
  /**
   * Describes the underlying error that caused the send operation to fail.
   */
  readonly innerError?: Error;
  constructor(message: string, innerError?: Error) {
    super(message);
    this.innerError = innerError;
  }
}
