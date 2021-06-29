### 2.1.0 - (2021-06-30)

- Exposes a new `receiver.drainCredit()` method that calls through to rhea's
  `receiver.drain_credit()` method.
- Update rhea minimum version to 2.0.3

### 2.0.0 - (2021-06-03)

- Updates rhea dependency to the 2.x major version, and the tslib dependency to the 2.x major version.
- Adds `CreateRequestResponseLinkOptions` as an exported interface.

#### Breaking changes

- rhea has 1 breaking change introduced in version 2.x: timestamps are not deserialized as Date objects instead of numbers.
- Updates `AwaitableSendOptions` to include the optional fields `tag` and `format` which were previously passed to `AwaitableSender.send()`. These fields are no longer positional arguments on `AwaitableSender.send()`.
- Adds `SenderSendOptions` to include the optional fields `tag` and `format` which were previously passed to `Sender.send()`. These fields are no longer positional arguments on `Sender.send()`.
- Removes `sendTimeoutInSeconds` from the `AwaitableSendOptions` that is passed to the `AwaitableSender` constructor. `timeoutInSeconds` on `AwaitableSenderOptions` can still be used to set the timeout for individual `AwaitableSender.send()` invocations.
- Renames the following TypeScript interfaces to better match the methods they apply to:
  - SenderOptionsWithSession -> CreateSenderOptions
  - AwaitableSenderOptionsWithSession -> CreateAwaitableSenderOptions
  - ReceiverOptionsWithSession -> CreateReceiverOptions

### 1.2.1 - (2021-04-15)

- `createSession`, `createReceiver`, and `createSender` methods now only close underlying rhea analogue when cancelled if the resource has already been opened.

### 1.2.0 - 2021-03-25

- Exposes the `incoming` getter on the `Session` that lets accessing size and capacity of the incoming deliveries [#79](https://github.com/amqp/rhea-promise/pull/79).
- Updates the error message for the `AbortError` to be a standard message `The operation was aborted.`.

### 1.1.0 - 2021-02-08

- All async methods now take a signal that can be used to cancel the operation. Fixes [#48](https://github.com/amqp/rhea-promise/issues/48)
- Added a `timeoutInSeconds` parameter to the `send` method on the `AwaitableSender` that overrides the timeout value for the send operation set when creating the sender.
- When the `error` event is fired when closing the sender/receiver link, surface errors occurring on the sender/receiver context if none are found on the session context. Details can be found in [PR #55](https://github.com/amqp/rhea-promise/pull/55)
- Updated minimum version of `rhea` to `^1.0.24`. Details can be found in [PR 68](https://github.com/amqp/rhea-promise/pull/68)

### 1.0.0 - 2019-06-27

- Updated minimum version of `rhea` to `^1.0.8`.
- Added a read only property `id` to the `Session` object. The id property is created by concatenating session's local channel, remote channel and the connection id `"local-<number>_remote-<number>_<connection-id>"`, thus making it unique for that connection.
- Improved log statements by adding the session `id` and the sender, receiver `name` to help while debugging applications.
- Added `options` to `Link.close({closeSession: true | false})`, thus the user can specify whether the underlying session should be closed while closing the `Sender|Receiver`. Default is `true`.
- Improved `open` and `close` operations on `Connection`, `Session` and `Link` by creating timer in case the connection gets disconnected. Fixes [#41](https://github.com/amqp/rhea-promise/issues/41).
- The current `Sender` does not have a provision of **"awaiting"** on sending a message. The user needs to add handlers on the `Sender` for `accepted`, `rejected`, `released`, `modified` to ensure whether the message was successfully sent.
  Now, we have added a new `AwaitableSender` which adds the handlers internally and provides an **awaitable** `send()` operation to the customer. Fixes [#45](https://github.com/amqp/rhea-promise/issues/45).
- Exporting new Errors:
  - `InsufficientCreditError`: Defines the error that occurs when the Sender does not have enough credit.
  - `SendOperationFailedError`: Defines the error that occurs when the Sender fails to send a message.

### 0.2.0 - 2019-05-17

- Updated `OperationTimeoutError` to be a non-AMQP Error as pointed out in [#42](https://github.com/amqp/rhea-promise/issues/42). Fixed in [PR](https://github.com/amqp/rhea-promise/pull/43).

### 0.1.15 - 2019-04-10

- Export rhea types for `Typed`. [PR](https://github.com/amqp/rhea-promise/pull/36).
- Export rhea types for `WebSocketImpl` and `WebSocketInstance`. [PR](https://github.com/amqp/rhea-promise/pull/38).
- When opening a connection fails with no error, use standard error message. [PR](https://github.com/amqp/rhea-promise/pull/27).

### 0.1.14 - 2019-03-19

- Allow websockets usage on a connection without creating a container first. [PR](https://github.com/amqp/rhea-promise/pull/32).
- New function `removeAllSessions()` on the connection to clear the internal map in rhea to ensure
  sessions are not reconnected on the next `connection.open()` call. [PR](https://github.com/amqp/rhea-promise/pull/33).
- Remove all event listeners on link and session objects when `close()` is called on them. [PR](https://github.com/amqp/rhea-promise/pull/34)

### 0.1.13 - 2018-12-11

- Throw `OperationTimeoutError` when a Promise to create/close an entity is rejected.

### 0.1.12 - 2018-11-16

- Fix a minor bug in receiver creation.

### 0.1.11 - 2018-11-15

- Added checks for some event handler methods to exist before logging information that uses node's
  event handlers inbuilt functions.
- Improved error checking while creating the receiver.

### 0.1.10 - 2018-11-01

- Provided an option to add an event handler for "settled" event on the Receiver.

### 0.1.9 - 2018-10-24

- With the usage of `importHelpers`, the tslib will be needed in package.json for installers using older versions of npm (or using yarn). [PR](https://github.com/amqp/rhea-promise/pull/16).

### 0.1.8 - 2018-10-22

- Allow setting drain property on the receiver [PR](https://github.com/amqp/rhea-promise/pull/14).

### 0.1.7 - 2018-10-19

- Fixed a bug while populating the connectionId [PR](https://github.com/amqp/rhea-promise/pull/11).

### 0.1.6 - 2018-09-28

- property `actionInitiated` is now of type `number` which is incremented when the `create`, `close`
  action on an entity is under process and decremented when the action completes (succeeeded or failed).

### 0.1.5 - 2018-09-27

- Improved log statements for better debugging.
- Any type of `error` event will be emitted with a tick delay. This would give enough time for the
  `create()` methods to resolve the promise.
- Added a new `boolean` property `actionInitiated` which indicates whether the `create`, `close`
  action on an entity is under process.

### 0.1.4 - 2018-09-25

- `options` is a required property of `Connection` and `Container`.

### 0.1.3 - 2018-09-25

- Transform relevant objects in rhea EventContext to rhea-promise objects.
- Ensure that `container.createConnection()` creates a connection on that container and not on
  the default container.

### 0.1.2 - 2018-09-20

- TS target to ES2015. This should help us support node.js version 6.x and above.

### 0.1.1 - 2018-09-20

- Update homepage, repository and bug urls in package.json

### 0.1.0 - 2018-09-20

- Initial version of rhea-promise.
