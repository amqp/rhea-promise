// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the Apache License. See License in the project root for license information.

import { EventEmitter } from "events";

/**
 * Abstract base class for all the entities like Connection, Session, Sender, Receiver in the
 * AMQP protocol.
 * @class Entity
 */
export abstract class Entity extends EventEmitter {
  /**
   * @property actionInitiated Indicates whether the action of creating or closing an entity has
   * been initiated. Whenever an action has been initiated, the count will be incremented by 1.
   * Whenever the action completes (succeeds/fails) the count will be decremented by 1.
   * Default value: `0`.
   */
  actionInitiated: number = 0;
  constructor() {
    super();
  }
}
