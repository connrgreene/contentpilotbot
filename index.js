require("dotenv").config();
const http = require("http");
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

// ── Launch: explicit webhook on Railway, polling locally ──────────────────────
const WEBHOOK_URL = process.env.WEBHOOK_URL; // e.g. https://contentpilotbot-production.up.railway.app
const PORT = parseInt(process.env.PORT || "3000");

if (WEBHOOK_URL) {
  const webhookPath = "/webhook";
  const webhookFullUrl = `${WEBHOOK_URL}${webhookPath}`;

  // Minimal HTTP server — receives Telegram updates and passes to Telegraf
  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === webhookPath) {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          console.log("📨 Webhook update received");
          const update = JSON.parse(body);
          await bot.handleUpdate(update);
          res.writeHead(200);
          res.end("OK");
        } catch (err) {
          console.error("Webhook handler error:", err.message);
          res.writeHead(500);
          res.end("Error");
        }
      });
    } else {
      // Health check
      res.writeHead(200);
      res.end("Content Pilot Bot is running");
    }
  });

  server.listen(PORT, async () => {
    console.log(`✅ HTTP server listening on port ${PORT}`);
    try {
      await bot.telegram.setWebhook(webhookFullUrl);
      const info = await bot.telegram.getWebhookInfo();
      console.log(`✅ Webhook registered: ${info.url}`);
      if (info.last_error_message) {
        console.warn(`⚠️  Last webhook error: ${info.last_error_message}`);
      }
    } catch (err) {
      console.error("❌ Failed to register webhook:", err.message);
    }
  });
} else {
  // Local dev — use polling
  bot.launch().then(() => console.log("✅ Content Bot running via polling (local)"));
}

process.once("SIGINT",  () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
