// app.js
const express = require("express");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// GET /types -> list of type names
app.get("/types", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT name FROM types ORDER BY name");
    res.json(rows.map((r) => r.name));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load types" });
  }
});

// GET /joke/:type?count=2
app.get("/joke/:type", async (req, res) => {
  const type = (req.params.type || "any").toLowerCase();
  const countRaw = req.query.count;
  let count = 1;

  if (countRaw !== undefined) {
    const parsed = Number.parseInt(countRaw, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return res.status(400).json({ error: "count must be a positive integer" });
    }
    count = parsed;
  }

  try {
    let sql;
    let params = [];

    if (type === "any") {
      sql = `
        SELECT j.id, j.setup, j.punchline, t.name AS type
        FROM jokes j
        JOIN types t ON t.id = j.type_id
        ORDER BY RAND()
        LIMIT ?
      `;
      params = [count];
    } else {
      sql = `
        SELECT j.id, j.setup, j.punchline, t.name AS type
        FROM jokes j
        JOIN types t ON t.id = j.type_id
        WHERE LOWER(t.name) = ?
        ORDER BY RAND()
        LIMIT ?
      `;
      params = [type, count];
    }

    const [rows] = await db.query(sql, params);

    // Return single object when count not provided or count=1 (simple UI-friendly)
    if (count === 1) {
      if (rows.length === 0) return res.status(404).json({ error: "No jokes found" });
      return res.json(rows[0]);
    }

    // If not enough jokes exist, this naturally returns “as many as exist”
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load joke(s)" });
  }
});

app.listen(PORT, () => {
  console.log(`Joke service running on http://localhost:${PORT}`);
});