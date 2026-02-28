require("dotenv").config();
const { Telegraf } = require("telegraf");
const { handleMessage }  = require("./handlers/messageHandler");
const { handleGenerate } = require("./handlers/generateHandler");
const { handleAddPage }  = require("./handlers/addPageHandler");
const { handleStatus }   = require("./handlers/statusHandler");

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// ── Commands ──────────────────────────────────────────────────────────────────
bot.command("generate",  (ctx) => handleGenerate(ctx));
bot.command("addpage",   (ctx) => handleAddPage(ctx));
bot.command("status",    (ctx) => handleStatus(ctx));

// ── Passive listener ──────────────────────────────────────────────────────────
bot.on("message", (ctx) => handleMessage(ctx));

// ── Launch: webhook on Railway, polling locally ───────────────────────────────
const WEBHOOK_URL = process.env.WEBHOOK_URL; // e.g. https://mybot.up.railway.app
const PORT = parseInt(process.env.PORT || "3000");

if (WEBHOOK_URL) {
  bot.launch({
    webhook: {
      domain: WEBHOOK_URL,
      port: PORT,
    },
  }).then(() => console.log(`✅ Content Bot running via webhook on port ${PORT}`));
} else {
  bot.launch().then(() => console.log("✅ Content Bot running via polling (local)"));
}

process.once("SIGINT",  () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
