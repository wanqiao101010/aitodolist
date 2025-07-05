const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/extract-todos', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }
  try {
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
    res.json({ todos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
}); 