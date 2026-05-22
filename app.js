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
    // Text combine
    let combined = `Topic: ${topic || 'Trending'}\n\nAI Summary: ${trendingData.summary}\n\n`;
    trendingData.topics.slice(0, 4).forEach((item, i) => {
      combined += `Source ${i+1}: ${item.title}\n`;
      if (item.content) combined += `${item.content.substring(0, 300)}...\n\n`;
    });

    // Grok se text post
    const grokRes = await axios.post("https://api.x.ai/v1/chat/completions", {
      model: "grok-3",
      messages: [{
        role: "system",
        content: "You are a sharp X content writer for @inlast5mins. Combine multiple sources into ONE strong, natural and exciting X post. Max 260 characters. Use emojis naturally."
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

    // Grok Imagine ke liye best prompt
    //const grokImagePrompt = `Create a cinematic, high-quality, dramatic vertical image for X post about "${topic}". Modern news style, dark background, neon accents, high contrast, eye-catching and viral. Show relevant action, emotion or atmosphere related to ${topic}. Professional sports/news photography style.`;
    const grokImagePrompt = `Create a cinematic, high-quality, dramatic vertical image for an X post about "${topic}". 
        Modern premium editorial news style, clean sophisticated lighting, elegant rich color grading with natural tones, sharp focus, 
        beautiful depth of field, powerful and scroll-stopping composition. Show relevant dynamic action, genuine emotion or compelling 
        atmosphere directly related to ${topic}. Professional sports and news photography style, ultra-realistic, photorealistic, 8k resolution, 
        masterpiece, best quality, visually captivating and viral.`;


    // Best image from Tavily
    let bestImage = "";
    const searchTerm = (topic || "").toLowerCase();
    for (let item of trendingData.topics) {
      if (item.images && item.images.length > 0) {
        if (item.title.toLowerCase().includes(searchTerm)) {
          bestImage = item.images[0];
          break;
        }
      }
    }
    if (!bestImage && trendingData.topics[0]?.images?.length > 0) {
      bestImage = trendingData.topics[0].images[0];
    }

    res.json({
      success: true,
      post: finalPost,
      image: bestImage,
      grokImagePrompt: grokImagePrompt
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