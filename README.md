# rhea-promise

A Promisified layer over [rhea](https://github.com/amqp/rhea) AMQP client.

## Pre-requisite ##
- **Node.js version: 6.x or higher.** 
- We would **still encourage you** to install the latest available LTS version at any given time from https://nodejs.org. **It is a good practice to always install the latest available LTS version of node.js.**
- Installing node.js on **Windows or macOS** is very simple with available installers on the [node.js website](https://nodejs.org). If you are using a **linux based OS**, then you can find easy to follow, one step installation instructions over [here](https://nodejs.org/en/download/package-manager/).

## Installation ##
```bash
npm install rhea-promise
```

## Debug logs ##

You can set the following environment variable to get the debug logs.

- Getting debug logs from this library
```bash
export DEBUG=rhea-promise*
```
- Getting debug logs from this and the rhea library
```bash
export DEBUG=rhea*
```
- If you are **not interested in viewing the message transformation** (which consumes lot of console/disk space) then you can set the `DEBUG` environment variable as follows:
```bash
export DEBUG=rhea*,-rhea:raw,-rhea:message,-rhea-promise:eventhandler,-rhea-promise:translate
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

## Notable differences between rhea and rhea-promise

### Error propagation to the parent entity
- In `AMQP`, for two peers to communicate successfully, different entities (Container, Connection, Session, Link) need to be created. There is a relationship between those entities.
  - 1 Container can have 1..* Connections.
  - 1 Connection can have 1..* Sessions. 
  - 1 Session can have 1..* Links.
  - A Link can have the role of Receiver or Sender.
- Each entity (connection, session, link) maintains its own state to let other entities know about what it is doing. Thus,
  - if the connection goes down then, everything on the connection - sessions, links are down.
  - if a session goes down then, all the the links on that session are down.
- When an entity goes down rhea emits \*_error and \*_close events, where * can be "sender", "receiver", "session", "connection". If event listeners for the aforementioned events are not added at the appropriate level, then `rhea` propagates those events to its parent entity. 
If they are not handled at the `Container` level (uber parent), then they are transformed into an `error` event. This would cause your 
application to crash if there is no listener added for the `error` event.
- In `rhea-promise`, the library creates, equivalent objects `Connection, Session, Sender, Receiver` and wraps objects from `rhea` within them.
It adds event listeners to all the possible events that can occur at any level and re-emits those events with the same arguments as one would 
expect from rhea. This makes it easy for consumers of `rhea-promise` to use the **EventEmitter** pattern. Users can efficiently use different 
event emitter methods like `.once()`, `.on()`, `.prependListeners()`, etc. Since `rhea-promise` add those event listeners on `rhea` objects, 
the errors will never be propagated to the parent entity. This can be good as well as bad depending on what you do.
   - **Good** - `*_error` events and `*_close` events emitted on an entity will not be propagated to it's parent. Thus ensuring that errors are handled at the right level.
   - **Bad** - If you do not add listeners for `*_error` and `*_close` events at the right level, then you will never know why an entity shutdown.

We believe our design enforces good practices to be followed while using the event emitter pattern.

## Examples

Please take a look at the [sample.env](https://github.com/amqp/rhea-promise/blob/master/sample.env) file for examples on how to provide the values for different 
parameters like host, username, password, port, senderAddress, receiverAddress, etc.

#### Sending a message via `Sender`.
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

  // Please, note that we are not awaiting on sender.send()
  // You will notice that `delivery.settled` will be `false`.
  const delivery: Delivery = sender.send(message);
  console.log(">>>>>[%s] Delivery id: %d, settled: %s",
    connection.id,
    delivery.id,
    delivery.settled);

  await sender.close();
  await connection.close();
}

main().catch((err) => console.log(err));
```

### Sending a message via `AwaitableSender`
- Running the example from terminal: `> ts-node ./examples/awaitableSend.ts`.

```typescript
import {
  Connection, Message, ConnectionOptions, Delivery, AwaitableSenderOptions, AwaitableSender
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
  const awaitableSenderOptions: AwaitableSenderOptions = {
    name: senderName,
    target: {
      address: senderAddress
    },
  };

  await connection.open();
  // Notice that we are awaiting on the message being sent.
  const sender: AwaitableSender = await connection.createAwaitableSender(
    awaitableSenderOptions
  );

  for (let i = 0; i < 10; i++) {
    const message: Message = {
      body: `Hello World - ${i}`,
      message_id: i
    };
    // Note: Here we are awaiting for the send to complete.
    // You will notice that `delivery.settled` will be `true`, irrespective of whether the promise resolves or rejects.
    const delivery: Delivery = await sender.send(message, {
      timeoutInSeconds: 10
    });
    console.log(
      "[%s] await sendMessage -> Delivery id: %d, settled: %s",
      connection.id,
      delivery.id,
      delivery.settled
    );
  }

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


## AMQP Protocol specification
Amqp protocol specification can be found [here](http://www.amqp.org/sites/amqp.org/files/amqp.pdf).
