// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the Apache License. See License in the project root for license information.

import { EventEmitter } from "events";

export abstract class Entity extends EventEmitter {
  isBeingCreated: boolean = false;
  constructor() {
    super();
  }
}
