const amqp = require("amqplib");

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672";
const QUEUE_NAME = process.env.QUEUE_NAME || "submit_jokes";

let connection;
let channel;

async function connectRabbitMQ() {
  if (channel) return channel;

  connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();

  await channel.assertQueue(QUEUE_NAME, { durable: true });

  console.log(`Connected to RabbitMQ, queue: ${QUEUE_NAME}`);
  return channel;
}

async function publishToQueue(message) {
  const ch = await connectRabbitMQ();
  const sent = ch.sendToQueue(
    QUEUE_NAME,
    Buffer.from(JSON.stringify(message)),
    { persistent: true }
  );
  return sent;
}

module.exports = {
  connectRabbitMQ,
  publishToQueue,
};