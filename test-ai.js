const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Memanggil API Key dari file .env kamu
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testJalan() {
    console.log("Menghubungi Google Gemini...");
    try {
        const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Halo, tolong balas dengan kata 'SIAP!' jika kamu bisa membaca pesan ini.");
        console.log("✅ BERHASIL! Balasan AI:", result.response.text());
    } catch (error) {
        console.error("❌ GAGAL! Detail error:", error.message);
    }
}

testJalan();
