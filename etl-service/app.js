const express = require("express");
const amqp = require("amqplib");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3002;

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672";
const QUEUE_NAME = process.env.QUEUE_NAME || "moderated_jokes";

app.get("/alive", (req, res) => {
  res.json({ status: "etl-service alive" });
});

async function processMessage(messageContent) {
  const { setup, punchline, type } = JSON.parse(messageContent);

  if (!setup || !punchline || !type) {
    throw new Error("Invalid message: setup, punchline and type are required");
  }

  const cleanType = type.trim().toLowerCase();
  const cleanSetup = setup.trim();
  const cleanPunchline = punchline.trim();

  let typeId;

  const [existingTypes] = await db.query(
    "SELECT id FROM types WHERE LOWER(name) = ?",
    [cleanType]
  );

  if (existingTypes.length > 0) {
    typeId = existingTypes[0].id;
  } else {
    const [typeResult] = await db.query(
      "INSERT INTO types (name) VALUES (?)",
      [cleanType]
    );
    typeId = typeResult.insertId;
  }

  await db.query(
    "INSERT INTO jokes (setup, punchline, type_id) VALUES (?, ?, ?)",
    [cleanSetup, cleanPunchline, typeId]
  );

  console.log(`Inserted joke into DB with type "${cleanType}"`);
}

async function startConsumer() {
  while (true) {
    try {
      console.log("Trying to connect to RabbitMQ...");

      const connection = await amqp.connect(RABBITMQ_URL);
      const channel = await connection.createChannel();

      await channel.assertQueue(QUEUE_NAME, { durable: true });
      channel.prefetch(1);

      console.log(`ETL connected to RabbitMQ`);
      console.log(`ETL waiting for messages on queue: ${QUEUE_NAME}`);

      channel.consume(QUEUE_NAME, async (msg) => {
        if (!msg) return;

        try {
          await processMessage(msg.content.toString());
          channel.ack(msg);
        } catch (error) {
          console.error("ETL failed to process message:", error.message);
          channel.nack(msg, false, false);
        }
      });

      break;
    } catch (error) {
      console.error("RabbitMQ not ready yet:", error.message);
      console.log("Retrying in 5 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

app.listen(PORT, async () => {
  console.log(`ETL service running on port ${PORT}`);
  await startConsumer();
});