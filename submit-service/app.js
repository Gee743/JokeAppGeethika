const express = require("express");
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3001;

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
    const [rows] = await db.query("SELECT name FROM types ORDER BY name");
    res.json(rows.map((row) => row.name));
  } catch (err) {
    console.error("Error fetching types:", err);
    res.status(500).json({ error: "Failed to fetch types" });
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

    if (!setup || !punchline) {
      return res.status(400).json({
        error: "Setup and punchline are required",
      });
    }

    const chosenType = (newType && newType.trim()) || (type && type.trim());

    if (!chosenType) {
      return res.status(400).json({
        error: "Please select a type or enter a new type",
      });
    }

    const normalizedType = chosenType.toLowerCase().trim();

    let [typeRows] = await db.query(
      "SELECT id FROM types WHERE LOWER(name) = ?",
      [normalizedType]
    );

    let typeId;

    if (typeRows.length > 0) {
      typeId = typeRows[0].id;
    } else {
      const [insertTypeResult] = await db.query(
        "INSERT INTO types (name) VALUES (?)",
        [normalizedType]
      );
      typeId = insertTypeResult.insertId;
    }

    const [result] = await db.query(
      "INSERT INTO jokes (setup, punchline, type_id) VALUES (?, ?, ?)",
      [setup.trim(), punchline.trim(), typeId]
    );

    res.status(201).json({
      message: "Joke submitted successfully",
      jokeId: result.insertId,
    });
  } catch (err) {
    console.error("Error submitting joke:", err);
    res.status(500).json({ error: "Failed to submit joke" });
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