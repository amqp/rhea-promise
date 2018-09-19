# rhea-promise

A Promisified layer over rhea AMQP client.

## Pre-requisite ##
- **Node.js version: 8.x or higher.** We would encourage you to install the latest available LTS version at any given time from https://nodejs.org. Please **do not** use older LTS versions of node.js.

## Installation ##
```bash
npm install rhea-promise
```

## Debug logs ##

You can set the following environment variable to get the debug logs.

- Getting debug logs from the library
```bash
export DEBUG=rhea*
```
- If you are **not interested in viewing the message transformation** (which consumes lot of console/disk space) then you can set the `DEBUG` environment variable as follows:
```bash
export DEBUG=rhea*,-rhea:raw,-rhea:message
```

#### Logging to a file
- Set the `DEBUG` environment variable as shown above and then run your test script as follows:
  - Logging statements from you test script go to `out.log` and logging statement from the sdk go to `debug.log`.
    ```bash
    node your-test-script.js > out.log 2>debug.log
    ```
  - Logging statements from your test script and the sdk go to the same file `out.log` by redirecting stderr to stdout (&1), and then redirect stdout to a file:
    ```bash
    node your-test-script.js >out.log 2>&1
    ```
  - Logging statements from your test script and the sdk go to the same file `out.log`.
    ```bash
      node your-test-script.js &> out.log
    ```


## Examples

Please take a look at the [sample.env](https://github.com/amqp/rhea-promise/blob/master/sample.env) file for examples on how to provide the values for different 
parameters like host, username, password, port, senderAddress, receiverAddress, etc.

#### Sending a message.
- Running the example from terminal: `> ts-node ./examples/send.ts`.

**NOTE:** If you are running the sample with `.env` config file, then please run the sample from the directory that contains `.env` config file. 
```ts
import {
  Connection, Sender, EventContext, Message, ConnectionOptions, Delivery, SenderOptions
} from "rhea-promise";
import * as dotenv from "dotenv"; // Optional for loading environment configuration from a .env (config) file
dotenv.config();

const host = process.env.AMQP_HOST || "host";
const username = process.env.AMQP_USERNAME || "sharedAccessKeyName";
const password = process.env.AMQP_PASSWORD || "sharedAccessKeyValue";
const port = parseInt(process.env.AMQP_PORT || "5671");
const senderAddress = process.env.SENDER_ADDRESS || "address";

async function main(): Promise<void> {
  const connectionOptions: ConnectionOptions = {
    transport: "tls",
    host: host,
    hostname: host,
    username: username,
    password: password,
    port: port,
    reconnect: false
  };
  const connection: Connection = new Connection(connectionOptions);
  const senderName = "sender-1";
  const senderOptions: SenderOptions = {
    name: senderName,
    target: {
      address: senderAddress
    },
    onError: (context: EventContext) => {
      const senderError = context.sender && context.sender.error;
      if (senderError) {
        console.log(">>>>> [%s] An error occurred for sender '%s': %O.",
          connection.id, senderName, senderError);
      }
    },
    onSessionError: (context: EventContext) => {
      const sessionError = context.session && context.session.error;
      if (sessionError) {
        console.log(">>>>> [%s] An error occurred for session of sender '%s': %O.",
          connection.id, senderName, sessionError);
      }
    }
  };

  await connection.open();
  const sender: Sender = await connection.createSender(senderOptions);
  const message: Message = {
    body: "Hello World!!",
    message_id: "12343434343434"
  };

  const delivery: Delivery = await sender.send(message);
  console.log(">>>>>[%s] Delivery id: ", connection.id, delivery.id);

  await sender.close();
  await connection.close();
}

main().catch((err) => console.log(err));
```

### Receiving a message
- Running the example from terminal: `> ts-node ./examples/receive.ts`.

**NOTE:** If you are running the sample with `.env` config file, then please run the sample from the directory that contains `.env` config file. 
```ts
import {
  Connection, Receiver, EventContext, ConnectionOptions, ReceiverOptions, delay, ReceiverEvents
} from "rhea-promise";
import * as dotenv from "dotenv"; // Optional for loading environment configuration from a .env (config) file
dotenv.config();

const host = process.env.AMQP_HOST || "host";
const username = process.env.AMQP_USERNAME || "sharedAccessKeyName";
const password = process.env.AMQP_PASSWORD || "sharedAccessKeyValue";
const port = parseInt(process.env.AMQP_PORT || "5671");
const receiverAddress = process.env.RECEIVER_ADDRESS || "address";

async function main(): Promise<void> {
  const connectionOptions: ConnectionOptions = {
    transport: "tls",
    host: host,
    hostname: host,
    username: username,
    password: password,
    port: port,
    reconnect: false
  };
  const connection: Connection = new Connection(connectionOptions);
  const receiverName = "receiver-1";
  const receiverOptions: ReceiverOptions = {
    name: receiverName,
    source: {
      address: receiverAddress
    },
    onSessionError: (context: EventContext) => {
      const sessionError = context.session && context.session.error;
      if (sessionError) {
        console.log(">>>>> [%s] An error occurred for session of receiver '%s': %O.",
          connection.id, receiverName, sessionError);
      }
    }
  };

  await connection.open();
  const receiver: Receiver = await connection.createReceiver(receiverOptions);
  receiver.on(ReceiverEvents.message, (context: EventContext) => {
    console.log("Received message: %O", context.message);
  });
  receiver.on(ReceiverEvents.receiverError, (context: EventContext) => {
    const receiverError = context.receiver && context.receiver.error;
    if (receiverError) {
      console.log(">>>>> [%s] An error occurred for receiver '%s': %O.",
        connection.id, receiverName, receiverError);
    }
  });
  // sleeping for 2 mins to let the receiver receive messages and then closing it.
  await delay(120000);
  await receiver.close();
  await connection.close();
}

main().catch((err) => console.log(err));
```

## Design 
The library provides an easy to use promisfied API for creating connection, session, sender and 
receiver links. One can provide event handlers as optional properties while creating entities or 
can use the standard event emitter pattern to add listeners to the created entities.

For implementing the Event Emitter pattern, we considered different approaches like:
**extending rhea's objects** (Connection, Session, Sender, Receiver). However, this has an overhead 
of ensuring that there are no naming conflicts in the method names. Selecting different names for 
operations like `open` and `close` would add more confusion.

Hence we settled with, **wrapping rhea's objects** under our own equivalent objects. To ensure that 
user's can efficiently use different event emitter methods like `.once()`, `.on()`,
`.prependListeners()`, etc. we decided to add listeners to rhea's objects 
(connection, session, sender, receiver) for all the possible events that those objects can 
emit. From those listeners, equivalent `rhea-promise` objects emit the same events with same 
arguments as one would expect from an event emitted by one of the above mentioned objects from 
`rhea`. User's can add/remove listeners to `rhea-promise` objects. Whenever an event is emitted 
from an object from `rhea`, it's equivalent counterpart in `rhea-romise` would emit the same event.

`rhea` deals little differently with *_error and *_close events. If an event listener is **not added** 
to a link (sender, receiver) then it will emit the `sender_error, sender_close, receiver_error, receiver_close` 
events to the `session` object that the `link` belongs to. If there are no event listeners 
for thoe events at the `session` level then, it emits those events to the `connection` object. Still 
if it could not find listeners for those events then the events are bubbled up to the `container` 
object and eventually those events are transformed into `error` events, if there were no event 
listeners for those events at the container level. 

It does the same thing for `session_error, session_close` events. Events are bubbled up to the 
`connection`  and `container` objects and eventually emitted as `error` events if no listeners 
were found for those events at the respective levels.

This behavior of `rhea` will not be reciprocated by `rhea-promise` since, it adds event listeners 
to each of the equivalent rhea objects. Thus *_error and *_close events will never bubble up. 
If you do not add event listeners for those objects while using `rhea-promise` then you will not 
know why an `error` or a `close` event occurred. So please make sure that right kind of event 
listeners are added to the right objects. This enforces good practices to be followed while using 
the event emitter pattern.


## Building the library
- Clone the repo
```
git clone https://github.com/amqp/rhea-promise.git
```
- Install typescript, ts-node globally
```
npm i -g typescript
npm i -g ts-node
```
- NPM install from the root of the package
```
npm i
```
- Build the project
```
npm run build
```