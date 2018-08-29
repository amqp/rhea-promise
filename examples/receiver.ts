
import {
  Connection, Receiver, EventContext, ConnectionOptions, ReceiverOptions, delay
} from "../lib";

import * as dotenv from "dotenv";
dotenv.config();

const host = process.env.AMQP_HOST || "host";
const username = process.env.AMQP_USERNAME || "username";
const port = parseInt(process.env.AMQP_PORT || "5671");
const receiverAddress = process.env.RECEIVER_ADDRESS || "address";
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
  const receiverName = "receiver-1";
  const receiverOptions: ReceiverOptions = {
    name: receiverName,
    target: {
      address: receiverAddress
    },
    onMessage: (context: EventContext) => {
      console.log("Received message: %O", context.message);
    },
    onError: (context: EventContext) => {
      const receiverError = context.receiver && context.receiver.error;
      if (receiverError) {
        console.log("[%s] An error occurred for receiver '%s': %O.",
          connection.id, receiverName, receiverError);
      }
    },
    onSessionError: (context: EventContext) => {
      const sessionError = context.session && context.session.error;
      if (sessionError) {
        console.log("[%s] An error occurred for session of receiver '%s': %O.",
          connection.id, receiverName, sessionError);
      }
    }
  };
  const receiver: Receiver = await connection.createReceiver(receiverOptions);
  // sleeping for 2 mins to let the receiver receive messages and then closing it.
  await delay(120000);
  await receiver.close();
  await connection.close();
}

main().catch((err) => console.log(err));
