/**
 * Media helper — download Telegram files and extract video frames.
 * Uses ffmpeg-static (bundled binary, no system install needed).
 */

const ffmpegPath = require("ffmpeg-static");
const { execFile }  = require("child_process");
const { promisify } = require("util");
const fs   = require("fs");
const path = require("path");
const os   = require("os");

const execFileAsync = promisify(execFile);

/**
 * Download any Telegram file by file_id. Returns a Buffer.
 */
async function downloadTelegramFile(telegram, fileId) {
  const file  = await telegram.getFile(fileId);
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url   = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
  const res   = await fetch(url);
  if (!res.ok) throw new Error(`Telegram download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Extract up to `numFrames` evenly-spaced frames from a video buffer.
 * Samples 1 frame every 12 seconds (0s, 12s, 24s, 36s, 48s for a ~60s clip).
 * Returns array of base64 JPEG strings.
 */
async function extractVideoFrames(videoBuffer, numFrames = 5) {
  const tmpId    = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const videoPath = path.join(os.tmpdir(), `cpb_${tmpId}.mp4`);
  const frames   = [];

  try {
    fs.writeFileSync(videoPath, videoBuffer);

    for (let i = 0; i < numFrames; i++) {
      const timestamp  = i * 12; // 0s, 12s, 24s, 36s, 48s
      const framePath  = path.join(os.tmpdir(), `cpb_${tmpId}_f${i}.jpg`);

      try {
        await execFileAsync(ffmpegPath, [
          "-ss", String(timestamp),
          "-i",  videoPath,
          "-frames:v", "1",
          "-q:v", "3",
          "-vf", "scale=720:-1",
          framePath,
        ], { timeout: 30_000 });

        if (fs.existsSync(framePath)) {
          frames.push(fs.readFileSync(framePath).toString("base64"));
          fs.unlinkSync(framePath);
        }
      } catch {
        // Frame at this timestamp may not exist (video shorter than expected) — skip
      }
    }
  } catch (err) {
    console.error("extractVideoFrames error:", err.message);
  } finally {
    if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
  }

  return frames;
}

/**
 * Get base64 JPEG from a Telegram photo message.
 * Picks the largest available size.
 */
async function getPhotoBase64(telegram, photoArray) {
  const largest = photoArray[photoArray.length - 1];
  const buf = await downloadTelegramFile(telegram, largest.file_id);
  return buf.toString("base64");
}

module.exports = { downloadTelegramFile, extractVideoFrames, getPhotoBase64 };
