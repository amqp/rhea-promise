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
