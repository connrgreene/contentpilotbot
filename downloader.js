const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DOWNLOADS_DIR = '/tmp/digi-downloads';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB Telegram limit

// Ensure downloads dir exists
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Extract URL from message text
 */
function extractUrl(text) {
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
}

/**
 * Detect platform from URL
 */
function detectPlatform(url) {
  if (/youtube\.com|youtu\.be/i.test(url)) return 'YouTube';
  if (/instagram\.com/i.test(url)) return 'Instagram';
  if (/tiktok\.com/i.test(url)) return 'TikTok';
  if (/twitter\.com|x\.com/i.test(url)) return 'Twitter/X';
  if (/reddit\.com/i.test(url)) return 'Reddit';
  if (/facebook\.com|fb\.watch/i.test(url)) return 'Facebook';
  if (/vimeo\.com/i.test(url)) return 'Vimeo';
  if (/twitch\.tv/i.test(url)) return 'Twitch';
  return 'Unknown';
}

/**
 * Get media info without downloading
 */
function getInfo(url) {
  return new Promise((resolve, reject) => {
    execFile('yt-dlp', [
      '--dump-json',
      '--no-playlist',
      url,
    ], { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(new Error('Failed to parse media info'));
      }
    });
  });
}

/**
 * Download media file. Returns { filePath, title, ext, isVideo }
 */
function download(url) {
  return new Promise((resolve, reject) => {
    const id = generateId();
    const outputTemplate = path.join(DOWNLOADS_DIR, `${id}.%(ext)s`);

    // yt-dlp args: best quality that fits under 50MB for Telegram
    const args = [
      '--no-playlist',
      // Best video+audio under 50MB, or best audio-only if no video
      '-f', 'bestvideo[filesize<50M]+bestaudio[filesize<20M]/best[filesize<50M]/bestvideo+bestaudio/best',
      '--merge-output-format', 'mp4',
      '--output', outputTemplate,
      // Embed metadata
      '--embed-thumbnail',
      '--add-metadata',
      // Limit just in case
      '--max-filesize', '50m',
      // Output json for parsing
      '--print-json',
      url,
    ];

    execFile('yt-dlp', args, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));

      try {
        const info = JSON.parse(stdout);
        const filename = info._filename || info.filename;

        // Find the actual downloaded file (might have been merged to .mp4)
        const dir = DOWNLOADS_DIR;
        const files = fs.readdirSync(dir).filter(f => f.startsWith(id));

        if (files.length === 0) {
          return reject(new Error('Download completed but file not found'));
        }

        // Prefer .mp4, then whatever exists
        const mp4 = files.find(f => f.endsWith('.mp4'));
        const chosen = mp4 || files[0];
        const filePath = path.join(dir, chosen);
        const ext = path.extname(chosen).slice(1);
        const stats = fs.statSync(filePath);

        if (stats.size > MAX_FILE_SIZE) {
          fs.unlinkSync(filePath);
          return reject(new Error(`File too large (${(stats.size / 1024 / 1024).toFixed(1)}MB). Telegram limit is 50MB.`));
        }

        resolve({
          filePath,
          title: info.title || 'download',
          ext,
          isVideo: ['mp4', 'webm', 'mkv', 'mov'].includes(ext),
          isAudio: ['mp3', 'm4a', 'ogg', 'opus', 'wav'].includes(ext),
          duration: info.duration,
          fileSize: stats.size,
          platform: detectPlatform(url),
        });
      } catch (e) {
        // Fallback: find file by id prefix
        const files = fs.readdirSync(DOWNLOADS_DIR).filter(f => f.startsWith(id));
        if (files.length > 0) {
          const filePath = path.join(DOWNLOADS_DIR, files[0]);
          const ext = path.extname(files[0]).slice(1);
          resolve({
            filePath,
            title: 'download',
            ext,
            isVideo: ['mp4', 'webm', 'mkv', 'mov'].includes(ext),
            isAudio: ['mp3', 'm4a', 'ogg', 'opus', 'wav'].includes(ext),
            fileSize: fs.statSync(filePath).size,
            platform: detectPlatform(url),
          });
        } else {
          reject(new Error('Download failed'));
        }
      }
    });
  });
}

/**
 * Download audio only (for YouTube music, etc.)
 */
function downloadAudio(url) {
  return new Promise((resolve, reject) => {
    const id = generateId();
    const outputTemplate = path.join(DOWNLOADS_DIR, `${id}.%(ext)s`);

    const args = [
      '--no-playlist',
      '-x', // extract audio
      '--audio-format', 'mp3',
      '--audio-quality', '0', // best
      '--output', outputTemplate,
      '--embed-thumbnail',
      '--add-metadata',
      '--print-json',
      url,
    ];

    execFile('yt-dlp', args, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));

      const files = fs.readdirSync(DOWNLOADS_DIR).filter(f => f.startsWith(id));
      if (files.length === 0) return reject(new Error('Audio download failed'));

      const chosen = files.find(f => f.endsWith('.mp3')) || files[0];
      const filePath = path.join(DOWNLOADS_DIR, chosen);
      const stats = fs.statSync(filePath);

      let title = 'audio';
      try {
        const info = JSON.parse(stdout);
        title = info.title || 'audio';
      } catch (e) {}

      if (stats.size > MAX_FILE_SIZE) {
        fs.unlinkSync(filePath);
        return reject(new Error(`File too large (${(stats.size / 1024 / 1024).toFixed(1)}MB). Telegram limit is 50MB.`));
      }

      resolve({
        filePath,
        title,
        ext: 'mp3',
        isVideo: false,
        isAudio: true,
        fileSize: stats.size,
        platform: detectPlatform(url),
      });
    });
  });
}

/**
 * Clean up a downloaded file
 */
function cleanup(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {}
}

module.exports = { extractUrl, detectPlatform, getInfo, download, downloadAudio, cleanup };
