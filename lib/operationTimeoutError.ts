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
  /**
   * Provides a logical amqp error condition.
   */
  readonly condition: string = "amqp:operation-timeout";
  /**
   * Provides a short description about the error.
   */
  description: string;

  constructor(message: string) {
    super(message);
    this.description = message;
  }
}
