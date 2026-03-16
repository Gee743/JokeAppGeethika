const amqp = require("amqplib");

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672";
const SUBMIT_QUEUE = process.env.SUBMIT_QUEUE || "submit_jokes";
const MODERATED_QUEUE = process.env.MODERATED_QUEUE || "moderated_jokes";

let connection;
let channel;

async function connectRabbitMQ() {
  if (channel) return channel;

  connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();

  await channel.assertQueue(SUBMIT_QUEUE, { durable: true });
  await channel.assertQueue(MODERATED_QUEUE, { durable: true });

  console.log(`Connected to RabbitMQ`);
  return channel;
}

async function getOnePendingJoke() {
  const ch = await connectRabbitMQ();
  const msg = await ch.get(SUBMIT_QUEUE, { noAck: false });

  if (!msg) return null;

  const content = JSON.parse(msg.content.toString());

  return {
    content,
    deliveryTag: msg.fields.deliveryTag
  };
}

async function ackPendingJoke(deliveryTag) {
  const ch = await connectRabbitMQ();
  ch.ack({ fields: { deliveryTag } });
}

async function nackPendingJoke(deliveryTag, requeue = true) {
  const ch = await connectRabbitMQ();
  ch.nack({ fields: { deliveryTag } }, false, requeue);
}

async function publishModeratedJoke(joke) {
  const ch = await connectRabbitMQ();
  ch.sendToQueue(
    MODERATED_QUEUE,
    Buffer.from(JSON.stringify(joke)),
    { persistent: true }
  );
}

module.exports = {
  connectRabbitMQ,
  getOnePendingJoke,
  ackPendingJoke,
  nackPendingJoke,
  publishModeratedJoke
};