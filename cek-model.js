const axios = require('axios');
require('dotenv').config();

async function cekDaftarModel() {
    console.log("Meminta daftar model dari server Google...");
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        
        console.log("\n✅ BERHASIL! Ini daftar model yang bisa kamu pakai:");
        response.data.models.forEach(model => {
            // Kita filter hanya model yang mendukung "generateContent"
            if (model.supportedGenerationMethods.includes('generateContent')) {
                console.log(`- ${model.name.replace('models/', '')}`);
            }
        });
    } catch (error) {
        console.error("❌ GAGAL CEK MODEL:", error.response ? error.response.data : error.message);
    }
}

cekDaftarModel();