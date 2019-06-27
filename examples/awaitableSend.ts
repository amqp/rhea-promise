//  Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the Apache License. See License in the project root for license information.

import {
  Connection,
  Message,
  ConnectionOptions,
  Delivery,
  AwaitableSenderOptions,
  AwaitableSender
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
  const senderOptions: AwaitableSenderOptions = {
    name: senderName,
    target: {
      address: senderAddress
    },
    sendTimeoutInSeconds: 10
  };

  await connection.open();
  const sender: AwaitableSender = await connection.createAwaitableSender(
    senderOptions
  );

  for (let i = 0; i < 10; i++) {
    const message: Message = {
      body: `Hello World - ${i}`,
      message_id: i
    };
    // Please, note that we are awaiting on sender.send() to complete.
    // You will notice that `delivery.settled` will be `true`, irrespective of whether the promise resolves or rejects.
    const delivery: Delivery = await sender.send(message);
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
