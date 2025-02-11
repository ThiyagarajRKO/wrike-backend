import { Kafka, logLevel } from "kafkajs";
import { BROKERS, CLIENT_ID } from "../../config/kafka";
import { logData } from "./wingston";
require("dotenv").config();

const kafkaConfig = {
  clientId: CLIENT_ID,
  brokers: BROKERS,
  logLevel: logLevel.ERROR,
};

const kafka = new Kafka(kafkaConfig);

export const produce = (topic, data) => {
  return new Promise(async (resolve, reject) => {
    try {
      const producer = kafka.producer();

      await producer.connect();
      await producer.send({
        topic,
        messages: [
          {
            value: typeof data != "string" ? JSON.stringify(data) : data,
          },
        ],
      });

      resolve();
    } catch (err) {
      reject({ message: err?.message || err });
    }
  });
};

export const consume = (topic, groupId) => {
  return new Promise(async (resolve, reject) => {
    try {
      const consumer = kafka.consumer({ groupId });

      await consumer.connect();
      await consumer.subscribe({
        topic,
        fromBeginning: process.env.FROM_BEGINNING == "true",
      });

      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          const value = message.value.toString();
          // callback(topic, partition, value);

          const payload = JsonParser(value);
          console.log(
            `Received payload:\nTopic: ${topic},\nMessage: ${JSON.stringify(payload, null, 4)}\n\n`
          );

          // if (process.env.NODE_ENV.toLowerCase() == "local") return;

          logData(
            payload?.status?.toLowerCase(),
            topic,
            payload,
            payload?.environment?.toLowerCase() ?? "test",
            ""
          );
        },
      });

      resolve();
    } catch (err) {
      reject({ message: err?.message || err });
    }
  });
};

const JsonParser = (value) => {
  try {
    const payload = JSON.parse(value);

    if (payload?.responseTimeInSeconds)
      payload.responseTimeInSeconds =
        typeof payload?.responseTimeInSeconds == "string"
          ? parseFloat(payload?.responseTimeInSeconds)
          : payload?.responseTimeInSeconds;

    return payload;
  } catch (err) {
    console.log(err?.message);
    return "";
  }
};
