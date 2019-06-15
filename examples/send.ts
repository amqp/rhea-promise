//  Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the Apache License. See License in the project root for license information.

import {
  Connection,
  Sender,
  EventContext,
  Message,
  ConnectionOptions,
  Delivery,
  SenderOptions
} from "../lib";

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
        console.log(
          ">>>>> [%s] An error occurred for sender '%s': %O.",
          connection.id,
          senderName,
          senderError
        );
      }
    },
    onSessionError: (context: EventContext) => {
      const sessionError = context.session && context.session.error;
      if (sessionError) {
        console.log(
          ">>>>> [%s] An error occurred for session of sender '%s': %O.",
          connection.id,
          senderName,
          sessionError
        );
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
  console.log(
    ">>>>>[%s] send -> Delivery id: %d, settled: %s",
    connection.id,
    delivery.id,
    delivery.settled
  );

  await sender.close();
  await connection.close();
}

main().catch((err) => console.log(err));
