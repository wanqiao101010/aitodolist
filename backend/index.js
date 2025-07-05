const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');
const { Pool } = require('pg');

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Postgres connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render') ? { rejectUnauthorized: false } : false
});

// Create users table if not exists
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      google_id VARCHAR(128) UNIQUE,
      email VARCHAR(256),
      name VARCHAR(256),
      avatar_url VARCHAR(512),
      daily_count INTEGER DEFAULT 0,
      last_generation_date DATE
    );
  `);
})();

// Helper: upsert user and check/update daily limit
async function upsertAndCheckUser({ google_id, email, name, avatar_url }) {
  const today = new Date().toISOString().slice(0, 10);
  let user = (await pool.query('SELECT * FROM users WHERE google_id = $1', [google_id])).rows[0];
  if (!user) {
    // New user
    await pool.query(
      'INSERT INTO users (google_id, email, name, avatar_url, daily_count, last_generation_date) VALUES ($1, $2, $3, $4, $5, $6)',
      [google_id, email, name, avatar_url, 0, today]
    );
    user = (await pool.query('SELECT * FROM users WHERE google_id = $1', [google_id])).rows[0];
  }
  // Reset daily count if date changed
  if (user.last_generation_date !== today) {
    await pool.query('UPDATE users SET daily_count = 0, last_generation_date = $1 WHERE google_id = $2', [today, google_id]);
    user.daily_count = 0;
    user.last_generation_date = today;
  }
  return user;
}

async function incrementUserCount(google_id) {
  await pool.query('UPDATE users SET daily_count = daily_count + 1 WHERE google_id = $1', [google_id]);
}

app.post('/extract-todos', async (req, res) => {
  const { text, user } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }
  if (!user || !user.google_id) {
    return res.status(401).json({ error: 'User info required' });
  }
  try {
    // Upsert user and check limit
    const dbUser = await upsertAndCheckUser(user);
    if (dbUser.daily_count >= 3) {
      return res.status(403).json({ error: 'You have reached your daily limit of 3 to-do generations.' });
    }
    const prompt = `Extract a clear, actionable to-do list from the following text. Respond with a JSON array of strings, each string being a to-do item.\n\nText: "${text}"\n\nTo-Do List:`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that extracts to-do items from text.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 256,
    });
    const responseText = completion.choices[0].message.content;
    let todos;
    try {
      todos = JSON.parse(responseText);
    } catch (e) {
      // fallback: try to extract JSON array from text
      const match = responseText.match(/\[.*\]/s);
      if (match) {
        todos = JSON.parse(match[0]);
      } else {
        return res.status(500).json({ error: 'Failed to parse to-do list from AI response', aiResponse: responseText });
      }
    }
    await incrementUserCount(user.google_id);
    res.json({ todos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
}); 