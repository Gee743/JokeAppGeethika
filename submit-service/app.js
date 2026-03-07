const express = require("express");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Get all joke types
app.get("/types", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT name FROM types ORDER BY name");
    res.json(rows.map((row) => row.name));
  } catch (err) {
    console.error("Error fetching types:", err);
    res.status(500).json({ error: "Failed to fetch types" });
  }
});

// Submit a new joke
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

    // Check if type already exists
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

    // Insert joke
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

app.listen(PORT, () => {
  console.log(`Submit service running on http://localhost:${PORT}`);
});