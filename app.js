require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ==================== DISCOVER TRENDING ====================
async function discoverTrending(userTopic = "") {
  try {
    const now = new Date();
    const monthName = now.toLocaleString('default', { month: 'long' });
    const year = now.getFullYear();
    const currentPeriod = `${monthName} ${year}`;

    let query = "";

    if (userTopic && userTopic.trim() !== "") {
      query = `"${userTopic}"`;
    } else {
      query = `trending celebrities India ${currentPeriod} OR trending news India ${currentPeriod} OR Bollywood trending ${currentPeriod} OR IPL ${currentPeriod} OR Met Gala ${currentPeriod} OR Fifa world cup ${currentPeriod}`;
    }
   // console.log("Tavily query:", query);

    const res = await axios.post("https://api.tavily.com/search", {
      api_key: process.env.TAVILY_API_KEY,
      query: query,
      search_depth: "advanced",
      topic: "news",
      time_range: "day",
      max_results: 4,
      include_answer: "advanced",
      include_images: true          // ← Images enable kiya
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

// ==================== GENERATE ONE COMBINED POST + BEST IMAGE ====================
app.post('/generate-post', async (req, res) => {
  const { trendingData, topic } = req.body;

  if (!trendingData || !trendingData.topics) {
    return res.json({ success: false, post: "No data received" });
  }

  try {
    // Combine text for Grok
    let combined = `Topic: ${topic || 'Trending'}\n\nAI Summary: ${trendingData.summary}\n\n`;
    trendingData.topics.slice(0, 4).forEach((item, i) => {
      combined += `Source ${i+1}: ${item.title}\n`;
      if (item.content) combined += `${item.content.substring(0, 300)}...\n\n`;
    });

    // Grok se strong post generate
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
    //console.log("Grok response:", grokRes.data);
    const finalPost = grokRes.data.choices[0].message.content.trim();

    // ==================== BEST IMAGE SELECT ====================
    let bestImage = "";
    const searchTerm = (topic || "").toLowerCase();

    for (let item of trendingData.topics) {
      if (item.images && item.images.length > 0) {
        const titleLower = item.title.toLowerCase();
        const contentLower = (item.content || "").toLowerCase();

        if (titleLower.includes(searchTerm) || contentLower.includes(searchTerm)) {
          bestImage = item.images[0];
          break;
        }
      }
    }

    // Fallback: Pehli image le lo
    if (!bestImage && trendingData.topics[0]?.images?.length > 0) {
      bestImage = trendingData.topics[0].images[0];
    }

    res.json({
      success: true,
      post: finalPost,
      image: bestImage
    });

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