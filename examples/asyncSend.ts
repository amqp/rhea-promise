//  Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the Apache License. See License in the project root for license information.

import {
  Connection, Message, ConnectionOptions, Delivery, SenderOptions
} from "../lib";

import * as dotenv from "dotenv"; // Optional for loading environment configuration from a .env (config) file
import { AsynchronousSender } from "../lib/asynchronousSender";
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
    }
  };

  await connection.open();
  const sender: AsynchronousSender = await connection.createAsynchronousSender(senderOptions);
  const message: Message = {
    body: "Hello World!!",
    message_id: "12343434343434"
  };

  const delivery: Delivery = await sender.sendMessage(message);
  console.log(">>>>>[%s] await sendMessage -> Delivery id: %d, settled: %s",
    connection.id, delivery.id, delivery.settled);
  const delivery2: Delivery = sender.send(message);
  console.log(">>>>>[%s] send -> Delivery id: %d, settled: %s",
    connection.id, delivery2.id, delivery2.settled);

  await sender.close();
  await connection.close();
}

main().catch((err) => console.log(err));
