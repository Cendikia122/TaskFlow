const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot TaskFlow AI with Groq is running!'));
app.listen(port, () => console.log(`Server nyala di port ${port}`));

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const { Groq } = require('groq-sdk'); 
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const steinUrl = process.env.STEIN_API_URL;

// ================= MEMORI ANTI-SPAM =================
const tugasSudahDiingatkan = new Set();

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('[-] SCAN QR CODE!');
});

// Helper Waktu WIB dengan Kalkulasi Menit
function getWIBTime() {
    const now = new Date();
    const jktDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    
    const tahun = jktDate.getFullYear();
    const bulan = String(jktDate.getMonth() + 1).padStart(2, '0');
    const tanggal = String(jktDate.getDate()).padStart(2, '0');
    const jam = String(jktDate.getHours()).padStart(2, '0');
    const menit = String(jktDate.getMinutes()).padStart(2, '0');

    const totalMenitSekarang = (jktDate.getHours() * 60) + jktDate.getMinutes();

    return {
        dateString: `${tahun}-${bulan}-${tanggal}`,
        timeString: `${jam}:${menit}`,
        totalMenitSekarang: totalMenitSekarang,
        fullDateObj: jktDate 
    };
}

// Fungsi Utama Pengecekan Alarm
async function jalankanSistemAlarm() {
    try {
        const { dateString, totalMenitSekarang } = getWIBTime();
        
        const { data } = await axios.get(steinUrl);
        const rows = Array.isArray(data) ? data : [];

        for (const row of rows) {
            if (!row['ID'] || !row['Waktu Deadline']) continue;

            const waktuSplit = row['Waktu Deadline'].split(':');
            if (waktuSplit.length < 2) continue; 

            const jamDL = parseInt(waktuSplit[0], 10);
            const menitDL = parseInt(waktuSplit[1], 10);
            const totalMenitDL = (jamDL * 60) + menitDL; 

            if (
                row['Status'] === 'Belum Selesai' && 
                row['Deadline'] === dateString && 
                totalMenitDL <= totalMenitSekarang && 
                !tugasSudahDiingatkan.has(row['ID']) 
            ) {
                try {
                    const pesanAlarm = `⏰ *PENGINGAT JADWAL/TUGAS!* ⏰\n\nHalo! Aktivitas ini sudah memasuki tenggat waktu:\n\n📚 *${row['Mata Pelajaran']}*\n📝 ${row['Deskripsi Tugas']}\n⚠️ Jadwal: ${row['Waktu Deadline']} WIB\n\n_Segera selesaikan ya!_`;
                    
                    await client.sendMessage(row['User'], pesanAlarm);
                    console.log(`[+] Alarm berhasil ditembakkan ke ${row['User']} untuk: ${row['Mata Pelajaran']}`);
                    
                    tugasSudahDiingatkan.add(row['ID']);
                } catch (errSend) {
                    console.error(`[-] Gagal kirim pesan ke ${row['User']}:`, errSend.message);
                }
            }
        }
    } catch (error) {
        console.error("[-] Error pada sistem alarm utama:", error.message);
    }
}

client.on('ready', () => {
    console.log('[+] BOT AKTIF!');
    jalankanSistemAlarm();
    setInterval(jalankanSistemAlarm, 60000); 
});

// ================= BLOK PENERIMAAN PESAN =================
client.on('message', async (msg) => {
    const teks = msg.body;
    const pengirim = msg.from; 

    // 1. Command: /help
    if (teks.toLowerCase() === '/help') {
        const pesanHelp = `🤖 *PANDUAN LENGKAP BOT TASKFLOW AI (GROQ)* 🤖

Halo! Aku adalah asisten AI yang siap mencatat tugas, pengingat, dan aktivitas harianmu secara otomatis ke Google Sheets, serta mengirimkan alarm tepat waktu.

---
📖 *CARA PENGGUNAAN (ALUR DARI AWAL)*

*Langkah 1: Menambahkan Jadwal Baru (Tanpa Format Kaku)*
Cukup kirimkan pesan teks biasa yang berisi detail aktivitas dan jamnya.
👉 *Contoh:* _"Ingetin mandi jam 15.30 nanti ya bot"_

*Langkah 2: Memeriksa Daftar Jadwal Aktif*
Ketik perintah dibawah ini untuk melihat daftar jadwalmu yang belum dikerjakan.
👉 *Ketik:* \`/list\`

*Langkah 3: Menyelesaikan Jadwal/Tugas*
Tandai jadwal tersebut agar statusnya berubah menjadi "Selesai" dan alarmnya mati.
👉 *Ketik:* \`/selesai [nomor_pada_list]\`
👉 *Ketik:* \`/selesai semua\` _(Untuk menyelesaikan seluruh jadwal aktif sekaligus!)_

---
📌 *DAFTAR PERINTAH RESMI (COMMANDS)*
🔹 \`/help\` - Menampilkan panduan lengkap dan FAQ ini.
🔹 \`/list\` - Melihat semua daftar jadwalmu yang belum selesai.
🔹 \`/selesai [nomor]\` - Mengubah status satu tugas menjadi Selesai.
🔹 \`/selesai semua\` - Menyelesaikan SEMUA jadwal aktif kamu sekaligus.
🔹 \`/testalarm\` - Simulasi instan untuk menguji apakah sistem alarm bekerja.

---
❓ *FAQ (FREQUENTLY ASKED QUESTIONS)*

*Q: Bagaimana cara kerja perintah "/selesai semua"?*
*A:* Perintah ini akan mencari semua jadwal dengan nomor WhatsApp kamu yang berstatus "Belum Selesai", lalu otomatis mengubah semuanya menjadi "Selesai" dalam satu kedipan mata tanpa mengganggu jadwal milik orang lain.`;
        
        return msg.reply(pesanHelp);
    }

    // 2. Command: /list
    else if (teks.toLowerCase() === '/list') {
        try {
            const { data } = await axios.get(steinUrl);
            let balasan = "*📋 DAFTAR JADWAL/TUGAS KAMU:*\n\n";
            let nomor = 1;

            data.forEach(row => {
                if (row['Status'] === 'Belum Selesai' && row['User'] === pengirim) {
                    balasan += `*${nomor++}. ${row['Mata Pelajaran']}*\n📝 ${row['Deskripsi Tugas']}\n⚠️ Deadline: ${row['Deadline']} (Jam ${row['Waktu Deadline']})\n\n`;
                }
            });

            if (nomor === 1) return msg.reply("🎉 Yeay! Kamu tidak memiliki jadwal yang belum selesai.");
            return msg.reply(balasan);
        } catch (e) { 
            return msg.reply("Gagal mengambil data jadwal."); 
        }
    }

    // 3. Command: /selesai [nomor] atau /selesai semua
    else if (teks.toLowerCase().startsWith('/selesai')) {
        const parts = teks.split(' ');
        if (parts.length < 2) {
            return msg.reply("⚠️ Format: */selesai [nomor tugas]* atau */selesai semua*");
        }

        const subCommand = parts[1].toLowerCase();

        // FITUR BARU: SELESAIKAN SEMUA
        if (subCommand === 'semua') {
            try {
                // Tembak update massal ke Stein dengan mencocokkan nomor pengirim dan status
                await axios.put(steinUrl, {
                    condition: { 
                        "User": pengirim,
                        "Status": "Belum Selesai" 
                    },
                    set: { "Status": "Selesai" }
                });
                return msg.reply("🧹 *Berhasil Bersih-Bersih!* Semua jadwal aktif kamu telah ditandai *Selesai*. Alarm dinonaktifkan! 🚀");
            } catch (errAll) {
                console.error("[-] Gagal update semua tugas:", errAll.message);
                return msg.reply("Gagal menyelesaikan semua jadwal.");
            }
        }

        // JIKA INPUTNYA NOMOR (FITUR LAMA)
        if (isNaN(subCommand)) {
            return msg.reply("⚠️ Format: */selesai [nomor tugas]* atau */selesai semua*");
        }

        const nomorTugas = parseInt(subCommand, 10);
        try {
            const { data } = await axios.get(steinUrl);
            const tugasUser = data.filter(row => row['Status'] === 'Belum Selesai' && row['User'] === pengirim);

            if (nomorTugas < 1 || nomorTugas > tugasUser.length) {
                return msg.reply(`❌ Nomor tugas *${nomorTugas}* tidak ditemukan.`);
            }
            const targetTask = tugasUser[nomorTugas - 1];
            await axios.put(steinUrl, {
                condition: { "ID": targetTask['ID'] },
                set: { "Status": "Selesai" }
            });
            return msg.reply(`✅ *Mantap!* Aktivitas *${targetTask['Deskripsi Tugas']}* berhasil diselesaikan. 👏`);
        } catch (e) {
            return msg.reply("Gagal mengupdate jadwal.");
        }
    }

    // 4. Command: /testalarm 
    else if (teks.toLowerCase() === '/testalarm') {
        try {
            const { fullDateObj, dateString } = getWIBTime();
            fullDateObj.setMinutes(fullDateObj.getMinutes() + 2);

            const tahun = fullDateObj.getFullYear();
            const bulan = String(fullDateObj.getMonth() + 1).padStart(2, '0');
            const tanggal = String(fullDateObj.getDate()).padStart(2, '0');
            const jam = String(fullDateObj.getHours()).padStart(2, '0');
            const menit = String(fullDateObj.getMinutes()).padStart(2, '0');

            const targetTanggal = `${tahun}-${bulan}-${tanggal}`;
            const targetJam = `${jam}:${menit}`;

            const { data } = await axios.get(steinUrl);
            const rows = Array.isArray(data) ? data : []; 
            const nextId = (rows.length + 1).toString();

            await axios.post(steinUrl, [{
                "ID": nextId, "User": pengirim, "Mata Pelajaran": "TEST ALARM",
                "Deskripsi Tugas": "Uji coba alarm.", "Tanggal Input": dateString, 
                "Deadline": targetTanggal, "Waktu Deadline": targetJam,
                "Status": "Belum Selesai", "Prioritas": "Tinggi"
            }]);

            return msg.reply(`⏳ *TES ALARM AKTIF!*\nTunggu sampai pukul *${targetJam} WIB*.`);
        } catch (e) {
            return msg.reply("Gagal membuat tes alarm.");
        }
    }

    // 5. Input AI MENGGUNAKAN GROQ (Model: Llama 3.1 8B)
    else if (!teks.startsWith('/')) {
        try {
            const { dateString } = getWIBTime();

            const prompt = `Hari ini adalah tanggal ${dateString}. Ekstrak jadwal dari pesan: "${teks}".
            Kembalikan JSON murni dengan format struktur key seperti ini:
            {
              "is_tugas": true,
              "mata_pelajaran": "Kategori Singkat",
              "deskripsi": "Detail aktivitas",
              "deadline": "YYYY-MM-DD",
              "waktu": "HH:MM",
              "prioritas": "Sedang"
            }
            Ketentuan wajib:
            1. Jika pesan TIDAK MENGANDUNG niat dicatat sebagai jadwal, tugas, pengingat, atau rutinitas aktivitas, set "is_tugas" menjadi false.
            2. Konversi format jam ke 24 jam (Misal "jam 9 malam" = "21:00") di key "waktu". Jika tidak ada jam yang disebutkan, set default menjadi "23:59".
            3. JANGAN berikan teks pengantar apa pun di luar JSON murni.`;
            
            const chatCompletion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'llama-3.1-8b-instant',
                response_format: { type: "json_object" } 
            });

            const dataAI = JSON.parse(chatCompletion.choices[0].message.content);
            
            if (!dataAI.is_tugas || !dataAI.mata_pelajaran) return;
            
            const { data } = await axios.get(steinUrl);
            const rows = Array.isArray(data) ? data : []; 
            const nextId = (rows.length + 1).toString();

            await axios.post(steinUrl, [{
                "ID": nextId, "User": pengirim, "Mata Pelajaran": dataAI.mata_pelajaran,
                "Deskripsi Tugas": dataAI.deskripsi, "Tanggal Input": dateString,
                "Deadline": dataAI.deadline, "Waktu Deadline": dataAI.waktu,
                "Status": "Belum Selesai", "Prioritas": dataAI.prioritas || "Sedang"
            }]);

            msg.reply(`✅ Jadwal dicatat!\n📚 *${dataAI.mata_pelajaran}*\n📝 ${dataAI.deskripsi}\n📅 Deadline: ${dataAI.deadline} pukul ${dataAI.waktu} WIB`);
        } catch (err) {
            console.error("[-] ERROR DETAIL GROQ/STEIN:", err.message);
            msg.reply('Maaf, ada masalah saat memproses jadwal.');
        }
    }
});

client.initialize();