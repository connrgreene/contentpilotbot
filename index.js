require("dotenv").config();
const http = require("http");
const cron = require("node-cron");
const { Telegraf } = require("telegraf");
const { handleMessage }   = require("./handlers/messageHandler");
const { handleGenerate }  = require("./handlers/generateHandler");
const { handleAddPage }   = require("./handlers/addPageHandler");
const { handleStatus }    = require("./handlers/statusHandler");
const { handleSyncPage }  = require("./handlers/syncPageHandler");
const { syncPageIntelligence } = require("./intelligence");
const { getAllPages }      = require("./supabase");

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// ── Commands ──────────────────────────────────────────────────────────────────
bot.command("generate",  (ctx) => handleGenerate(ctx));
bot.command("addpage",   (ctx) => handleAddPage(ctx));
bot.command("status",    (ctx) => handleStatus(ctx));
bot.command("syncpage",  (ctx) => handleSyncPage(ctx));

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
        // Always 200 immediately — prevents Telegram from retrying failed updates
        res.writeHead(200);
        res.end("OK");
        try {
          console.log("📨 Webhook update received");
          const update = JSON.parse(body);
          await bot.handleUpdate(update);
        } catch (err) {
          console.error("Webhook handler error:", err.message);
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
      await bot.telegram.setWebhook(webhookFullUrl, { drop_pending_updates: true });
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

// ── Weekly intelligence sync — every Sunday at 3am UTC ───────────────────────
cron.schedule("0 3 * * 0", async () => {
  console.log("[cron] 🔄 Weekly page intelligence sync starting...");
  try {
    const pages = await getAllPages();
    console.log(`[cron] Syncing ${pages.length} page(s)...`);
    for (const page of pages) {
      await syncPageIntelligence(page);
      // Small gap between pages to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    console.log("[cron] ✅ Weekly sync complete");
  } catch (err) {
    console.error("[cron] Weekly sync error:", err.message);
  }
});

process.once("SIGINT",  () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
