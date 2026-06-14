const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot TaskFlow AI is running!'));
app.listen(port, () => console.log(`Server nyala di port ${port}`));

// ... (Lanjutkan dengan sisa kode whatsapp-web.js kamu di bawah sini)

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Setup AI Gemini
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const steinUrl = process.env.STEIN_API_URL;

// Setup WhatsApp Bot
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('[-] SCAN QR CODE INI DENGAN WHATSAPP KAMU!');
});

client.on('ready', () => {
    console.log('[+] BOT TASKFLOW (VERSI STEIN) SUDAH AKTIF!');
});

client.on('message', async (msg) => {
    const teks = msg.body;

    // 1. PERINTAH: /list (Melihat Tugas Belum Selesai)
    if (teks.toLowerCase() === '/list') {
        try {
            const { data } = await axios.get(steinUrl); // Ambil data dari Stein
            let pesanBalasan = "*📋 DAFTAR TUGAS BELUM SELESAI:*\n\n";
            let count = 0;
            
            data.forEach((row) => {
                if (row['Status'] === 'Belum Selesai') {
                    count++;
                    pesanBalasan += `*${row['ID']}. [${row['Mata Pelajaran']}]*\n📝 ${row['Deskripsi Tugas']}\n📅 Input: ${row['Tanggal Input']}\n⚠️ Deadline: ${row['Deadline']}\n🔥 Prioritas: ${row['Prioritas']}\n\n`;
                }
            });
            
            if (count === 0) pesanBalasan = "🎉 Yey! Tidak ada tugas yang menumpuk.";
            return msg.reply(pesanBalasan);
        } catch (error) {
            return msg.reply('❌ Gagal mengambil data dari database.');
        }
    }

    // 2. PERINTAH: /selesai [ID] (Menandai Tugas Beres)
    if (teks.toLowerCase().startsWith('/selesai ')) {
        const idTugas = teks.split(' ')[1];
        try {
            // Logika Update data di Stein
            await axios.put(steinUrl, {
                condition: { "ID": idTugas },
                set: { "Status": "Selesai" }
            });
            return msg.reply(`✅ Tugas ID *${idTugas}* berhasil ditandai Selesai!`);
        } catch (error) {
            return msg.reply(`❌ Gagal memperbarui status tugas ID *${idTugas}*.`);
        }
    }

    // 3. INPUT TEKS / GAMBAR UNTUK DICATAT AI
    try {
        const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
        let promptTugas = `Analisis pesan ini. Cari informasi instruksi tugas sekolah. Ekstrak data menjadi objek JSON dengan struktur pasti: {"mata_pelajaran": "string", "deskripsi": "string", "deadline": "YYYY-MM-DD", "prioritas": "Tinggi/Sedang/Rendah"}. Berikan HANYA JSON murni tanpa awalan/akhiran apapun.\n\nPesan user: "${teks}"`;
        let result;

        if (msg.hasMedia) {
            const media = await msg.downloadMedia();
            await msg.reply('📸 AI sedang membaca foto tugas kamu...');
            const imagePart = { inlineData: { data: media.data, mimeType: media.mimetype } };
            result = await model.generateContent([promptTugas, imagePart]);
        } else {
            if(teks.startsWith('/')) return; // Abaikan typo command
            result = await model.generateContent(promptTugas);
        }

        const jsonTeks = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const dataAI = JSON.parse(jsonTeks);

        // Ambil data untuk menentukan ID baru
        const responseData = await axios.get(steinUrl);
        const rows = responseData.data;
        const nextId = rows.length + 1;
        const hariIni = new Date().toISOString().split('T')[0];

        // Memasukkan baris baru ke Stein API
        await axios.post(steinUrl, [{
            "ID": nextId.toString(),
            "Mata Pelajaran": dataAI.mata_pelajaran || 'Umum',
            "Deskripsi Tugas": dataAI.deskripsi || 'Tidak ada deskripsi',
            "Tanggal Input": hariIni,
            "Deadline": dataAI.deadline || '-',
            "Status": "Belum Selesai",
            "Prioritas": dataAI.prioritas || "Sedang"
        }]);

        let balasan = `✅ *TUGAS BERHASIL DICATAT*\n\n🆔 ID: ${nextId}\n📚 Mapel: ${dataAI.mata_pelajaran}\n📝 Deskripsi: ${dataAI.deskripsi}\n📅 Tgl Input: ${hariIni}\n⚠️ Deadline: ${dataAI.deadline}\n🔥 Prioritas: ${dataAI.prioritas}\n\n_Ketik /list untuk melihat daftar._`;
        msg.reply(balasan);

    } catch (err) {
        console.error(err);
        if(!msg.hasMedia && !teks.startsWith('/')) {
             msg.reply('Maaf, AI belum mengenali tugas dari kalimatmu. Coba format yang lebih jelas.');
        }
    }
});

client.initialize();