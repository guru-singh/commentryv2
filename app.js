require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // JSON body ke liye

// ==================== DISCOVER TRENDING ====================
async function discoverTrending(userTopic = "") {
  try {
   
    const now = new Date();
    const monthName = now.toLocaleString('default', { month: 'long' });   // May
    const year = now.getFullYear();                                      // 2026
    const currentPeriod = `${monthName} ${year}`;                        // "May 2026"
    let query = "";

    if (userTopic && userTopic.trim() !== "") {
      // User ne kuch topic daala hai
      query = `"${userTopic}"`;
    } else {
      // Blank chhoda hai toh general trending
      query = "trending celebrities India today OR trending news India OR Bollywood trending OR IPL OR Met Gala ${currentPeriod}";
    }
    
    const res = await axios.post("https://api.tavily.com/search", {
      api_key: process.env.TAVILY_API_KEY,
      query: query,
      search_depth: "advanced",
      topic: "news",
      time_range: "day",
      max_results: 8,
      include_answer: true
    });

    return {
      summary: res.data.answer || "No summary available",
      topics: res.data.results || []
    };
  } catch (e) {
    console.log("Trending error:", e.message);
    return { summary: "Error fetching trends", topics: [] };
  }
}

// ==================== GENERATE ONE COMBINED POST ====================
app.post('/generate-post', async (req, res) => {
  const { trendingData, topic } = req.body;

  if (!trendingData || !trendingData.topics) {
    return res.json({ success: false, post: "No data received" });
  }

  try {
    let combined = `Topic: ${topic || 'Trending'}\n\nAI Summary: ${trendingData.summary}\n\n`;

    trendingData.topics.slice(0, 4).forEach((item, i) => {
      combined += `Source ${i+1}: ${item.title}\n`;
      if (item.content) combined += `${item.content.substring(0, 300)}...\n\n`;
    });

    const grokRes = await axios.post("https://api.x.ai/v1/chat/completions", {
      model: "grok-3",
      messages: [{
        role: "system",
        content: "You are a sharp X content writer for @inlast5mins. Combine multiple sources + AI summary into ONE strong, natural and exciting X post. Max 260 characters. Use emojis naturally. Make it feel like 'In Last 5 Mins' breaking news."
      }, {
        role: "user",
        content: combined + "\n\nEk hi bahut powerful X post banao."
      }],
      temperature: 0.8,
      max_tokens: 320
    }, {
      headers: { Authorization: `Bearer ${process.env.GROK_API_KEY}` }
    });

    const finalPost = grokRes.data.choices[0].message.content.trim();

    res.json({ success: true, post: finalPost });
  } catch (e) {
    console.log("Generate post error:", e.message);
    res.json({ success: false, post: "Error generating post" });
  }
});

// Routes
app.get('/', (req, res) => {
  res.render('dashboard', { trending: null, posts: [], topic: '' });
});

app.post('/discover', async (req, res) => {
  const userTopic = req.body.topic || '';
  const trending = await discoverTrending(userTopic);
  res.render('dashboard', { trending, posts: [], topic: userTopic });
});

app.listen(8080, () => {
  console.log("🚀 @inlast5mins Dashboard running at http://localhost:8080");
}); 