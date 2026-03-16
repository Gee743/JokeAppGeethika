const express = require("express");
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const app = express();
const PORT = process.env.PORT || 3001;
const JOKE_SERVICE_URL = process.env.JOKE_SERVICE_URL || "http://joke-service:3000";
const { publishToQueue, connectRabbitMQ } = require("./rabbitmq");
const { saveTypesToCache, readTypesFromCache } = require("./typeCache");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Submit Service API",
      version: "1.0.0",
      description: "API for submitting jokes and retrieving joke types",
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
      },
    ],
    components: {
      schemas: {
        SubmitJokeRequest: {
          type: "object",
          properties: {
            setup: {
              type: "string",
              example: "Why did the developer go broke?",
            },
            punchline: {
              type: "string",
              example: "Because he used up all his cache.",
            },
            type: {
              type: "string",
              example: "programming",
            },
            newType: {
              type: "string",
              example: "office",
            },
          },
        },
      },
    },
  },
  apis: [__filename],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

/**
 * @swagger
 * /types:
 *   get:
 *     summary: Get all joke types
 *     description: Returns a list of all joke types from the database.
 *     responses:
 *       200:
 *         description: A list of joke types
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 */
app.get("/types", async (req, res) => {
  try {
    const response = await fetch(`${JOKE_SERVICE_URL}/types`);

    if (!response.ok) {
      throw new Error(`Joke service returned status ${response.status}`);
    }

    const types = await response.json();

    await saveTypesToCache(types);

    return res.json({
      source: "joke-service",
      types,
    });
  } catch (error) {
    console.error("Could not fetch types from joke-service:", error.message);

    const cachedTypes = await readTypesFromCache();

    return res.json({
      source: "cache",
      types: cachedTypes,
    });
  }
});
/**
 * @swagger
 * /submit:
 *   post:
 *     summary: Submit a new joke
 *     description: Adds a joke to the database using an existing type or a new type.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubmitJokeRequest'
 *     responses:
 *       201:
 *         description: Joke submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 jokeId:
 *                   type: integer
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
app.post("/submit", async (req, res) => {
  try {
    const { setup, punchline, type, newType } = req.body;

    const finalType = (newType && newType.trim()) ? newType.trim() : type?.trim();

    if (!setup || !setup.trim() || !punchline || !punchline.trim() || !finalType) {
      return res.status(400).json({
        error: "setup, punchline, and type are required"
      });
    }

    const jokePayload = {
      setup: setup.trim(),
      punchline: punchline.trim(),
      type: finalType.trim()
    };

    await publishToQueue(jokePayload);

    return res.status(202).json({
      message: "Joke submitted to queue successfully",
      queued: jokePayload
    });
  } catch (error) {
    console.error("Submit error:", error);
    return res.status(500).json({
      error: "Failed to submit joke to queue"
    });
  }
});

/**
 * @swagger
 * /docs:
 *   get:
 *     summary: Swagger documentation page
 *     description: Interactive API documentation for the Submit Service.
 *     responses:
 *       200:
 *         description: Swagger UI page
 */
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.listen(PORT, () => {
  console.log(`Submit service running on http://localhost:${PORT}`);
});