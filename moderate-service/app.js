const express = require("express");
const path = require("path");
const {
  connectRabbitMQ,
  getOnePendingJoke,
  ackPendingJoke,
  nackPendingJoke,
  publishModeratedJoke
} = require("./rabbitmq");
const { readTypesFromCache, saveTypesToCache } = require("./typeCache");

const app = express();
const PORT = process.env.PORT || 3003;
const JOKE_SERVICE_URL = process.env.JOKE_SERVICE_URL || "http://joke-service:3000";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const pendingMap = new Map();

app.get("/types", async (req, res) => {
  try {
    const response = await fetch(`${JOKE_SERVICE_URL}/types`);
    if (!response.ok) throw new Error(`Joke service returned ${response.status}`);

    const types = await response.json();
    await saveTypesToCache(types);

    return res.json({
      source: "joke-service",
      types
    });
  } catch (error) {
    const cachedTypes = await readTypesFromCache();
    return res.json({
      source: "cache",
      types: cachedTypes
    });
  }
});

app.get("/moderate", async (req, res) => {
  try {
    const pending = await getOnePendingJoke();

    if (!pending) {
      return res.json({
        message: "No jokes currently available for moderation"
      });
    }

    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    pendingMap.set(token, pending.deliveryTag);

    return res.json({
      token,
      joke: pending.content
    });
  } catch (error) {
    console.error("Failed to fetch pending joke:", error);
    return res.status(500).json({ error: "Failed to fetch joke for moderation" });
  }
});

app.post("/moderated", async (req, res) => {
  try {
    const { token, setup, punchline, type, action } = req.body;

    if (!token) {
      return res.status(400).json({ error: "token is required" });
    }

    const deliveryTag = pendingMap.get(token);

    if (!deliveryTag) {
      return res.status(400).json({ error: "Invalid or expired moderation token" });
    }

    if (action === "reject") {
      await ackPendingJoke(deliveryTag);
      pendingMap.delete(token);

      return res.json({ message: "Joke rejected" });
    }

    if (!setup || !punchline || !type) {
      return res.status(400).json({ error: "setup, punchline and type are required" });
    }

    const moderatedJoke = {
      setup: setup.trim(),
      punchline: punchline.trim(),
      type: type.trim()
    };

    await publishModeratedJoke(moderatedJoke);
    await ackPendingJoke(deliveryTag);
    pendingMap.delete(token);

    return res.json({
      message: "Joke approved and sent to moderated queue",
      joke: moderatedJoke
    });
  } catch (error) {
    console.error("Failed to moderate joke:", error);
    return res.status(500).json({ error: "Failed to process moderated joke" });
  }
});

app.listen(PORT, async () => {
  console.log(`Moderate service listening on port ${PORT}`);
  try {
    await connectRabbitMQ();
    console.log("Moderate service connected to RabbitMQ");
  } catch (error) {
    console.error("RabbitMQ connection failed:", error.message);
  }
});