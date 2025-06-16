// keepAlive.js - Render.com serverni uxlatmaslik uchun sodda ping script
const https = require("https");

const TARGET_URL = "https://yuldagilar-backend.onrender.com"; // 🔁 O'Z SERVERING URL'ini yoz

function pingServer() {
  https.get(TARGET_URL, (res) => {
    const timestamp = new Date().toISOString();
    console.log(`✅ [${timestamp}] Server pinged. Status: ${res.statusCode}`);
  }).on("error", (err) => {
    const timestamp = new Date().toISOString();
    console.error(`❌ [${timestamp}] Ping failed:`, err.message);
  });
}

// Har 10 daqiqada bir marta ping yuborish (10 * 60 * 1000 ms)
setInterval(pingServer, 10 * 60 * 1000);

// Dastlab ham ping bo'lsin
pingServer();
