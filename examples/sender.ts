
import {
  Connection, Sender, EventContext, Message, ConnectionOptions, Delivery, SenderOptions
} from "../lib";

import * as dotenv from "dotenv";
dotenv.config();

const host = process.env.AMQP_HOST || "host";
const username = process.env.AMQP_USERNAME || "username";
const port = parseInt(process.env.AMQP_PORT || "5671");
const senderAddress = process.env.SENDER_ADDRESS || "address";
async function main(): Promise<void> {
  const connectionOptions: ConnectionOptions = {
    transport: "tls",
    host: host,
    hostname: host,
    username: username,
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
        console.log("[%s] An error occurred for sender '%s': %O.",
          connection.id, senderName, senderError);
      }
    },
    onSessionError: (context: EventContext) => {
      const sessionError = context.session && context.session.error;
      if (sessionError) {
        console.log("[%s] An error occurred for session of sender '%s': %O.",
          connection.id, senderName, sessionError);
      }
    }
  };
  const sender: Sender = await connection.createSender(senderOptions);
  const message: Message = {
    body: "Hello World!!",
    message_id: "12343434343434"
  };

  const delivery: Delivery = await sender.send(message);
  console.log(delivery);

  await sender.close();
  await connection.close();
}

main().catch((err) => console.log(err));
