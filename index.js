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

// ── Launch ────────────────────────────────────────────────────────────────────
bot.launch().then(() => console.log("✅ Internal Network Content Bot running"));

process.once("SIGINT",  () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

