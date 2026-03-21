/**
 * digi-downloader — standalone entry point
 * Run with: node downloader-bot.js
 * Railway start command: node downloader-bot.js
 */
require('dotenv').config();
const { Telegraf } = require('telegraf');
const http = require('http');
const fs = require('fs');
const { extractUrl, detectPlatform, download, downloadAudio, cleanup } = require('./downloader');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error('Missing required env var: TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

const bot = new Telegraf(TOKEN);

// /start
bot.start((ctx) => {
  ctx.reply(
    '👋 Send me any link and I\'ll download it for you.\n\n' +
    'Supported: YouTube, Instagram, TikTok, Twitter/X, Reddit, Facebook, Vimeo & more.\n\n' +
    '/audio <link> — download audio only (MP3)'
  );
});

// /audio — extract audio only
bot.command('audio', async (ctx) => {
  const text = ctx.message.text.replace('/audio', '').trim();
  const url = extractUrl(text);

  if (!url) {
    return ctx.reply('Send a link with the /audio command.\nExample: /audio https://youtube.com/watch?v=...');
  }

  const platform = detectPlatform(url);
  const status = await ctx.reply(`🎵 Downloading audio from ${platform}...`);

  try {
    const result = await downloadAudio(url);
    const sizeMB = (result.fileSize / 1024 / 1024).toFixed(1);

    await ctx.replyWithAudio(
      { source: fs.createReadStream(result.filePath), filename: `${sanitize(result.title)}.mp3` },
      { title: result.title, caption: `🎵 ${result.title}\n📦 ${sizeMB}MB` }
    );

    cleanup(result.filePath);
    del(ctx, status.message_id);
  } catch (err) {
    console.error('Audio download error:', err.message);
    edit(ctx, status.message_id, `❌ Failed: ${err.message.slice(0, 200)}`);
  }
});

// Any message with a URL → download
bot.on('text', async (ctx) => {
  const url = extractUrl(ctx.message.text);
  if (!url) return;

  const platform = detectPlatform(url);
  const status = await ctx.reply(`⬇️ Downloading from ${platform}...`);

  try {
    const result = await download(url);
    const sizeMB = (result.fileSize / 1024 / 1024).toFixed(1);
    const caption = `${result.title}\n📦 ${sizeMB}MB`;

    if (result.isVideo) {
      await ctx.replyWithVideo(
        { source: fs.createReadStream(result.filePath), filename: `${sanitize(result.title)}.${result.ext}` },
        { caption, supports_streaming: true }
      );
    } else if (result.isAudio) {
      await ctx.replyWithAudio(
        { source: fs.createReadStream(result.filePath), filename: `${sanitize(result.title)}.${result.ext}` },
        { title: result.title, caption }
      );
    } else {
      await ctx.replyWithDocument(
        { source: fs.createReadStream(result.filePath), filename: `${sanitize(result.title)}.${result.ext}` },
        { caption }
      );
    }

    cleanup(result.filePath);
    del(ctx, status.message_id);
  } catch (err) {
    console.error('Download error:', err.message);
    edit(ctx, status.message_id, `❌ Failed: ${err.message.slice(0, 200)}`);
  }
});

// Helpers
function sanitize(name) {
  return name.replace(/[^\w\s\-().]/g, '').slice(0, 100).trim() || 'download';
}
function del(ctx, id) { ctx.deleteMessage(id).catch(() => {}); }
function edit(ctx, id, text) { ctx.telegram.editMessageText(ctx.chat.id, id, null, text).catch(() => {}); }

// Launch
const RAILWAY_DOMAIN = process.env.RAILWAY_PUBLIC_DOMAIN;

if (RAILWAY_DOMAIN) {
  const PORT = process.env.PORT || 3000;
  const WEBHOOK_PATH = `/webhook/${TOKEN}`;

  bot.telegram.setWebhook(`https://${RAILWAY_DOMAIN}${WEBHOOK_PATH}`);

  http.createServer((req, res) => {
    if (req.url === WEBHOOK_PATH && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try { bot.handleUpdate(JSON.parse(body)); } catch (e) { console.error('Webhook error:', e); }
        res.writeHead(200);
        res.end('ok');
      });
    } else {
      res.writeHead(200);
      res.end('digi-downloader running');
    }
  }).listen(PORT, () => {
    console.log(`digi-downloader webhook on port ${PORT}`);
  });
} else {
  bot.launch().then(() => console.log('digi-downloader running (polling)'));
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
