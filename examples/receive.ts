// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the Apache License. See License in the project root for license information.

import {
  Connection, Receiver, EventContext, ConnectionOptions, ReceiverOptions, delay, ReceiverEvents, types
} from "../lib";

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
  const filterClause = `amqp.annotation.x-opt-enqueued-time > '${Date.now()}'`;
  const receiverOptions: ReceiverOptions = {
    name: receiverName,
    source: {
      address: receiverAddress,
      filter: {
        "apache.org:selector-filter:string": types.wrap_described(filterClause, 0x468C00000004)
      }
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
