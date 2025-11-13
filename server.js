const express = require("express");
const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const { buildTranslationPrompt } = require("./prompt");

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// Directories
const CACHE_DIR = path.join(__dirname, "cache");
const OUTPUT_DIR = path.join(__dirname, "translations");
const CLEANED_DIR = path.join(__dirname, "cleaned_texts");
const BACKUP_DIR = path.join(__dirname, "backups");
const LOGS_DIR = path.join(__dirname, "logs");

// Configuration
const CONFIG = {
  chunkSize: 2000,
  maxRetries: 3,
  retryDelay: 2000,
  requestTimeout: 300000,
  batchDelay: 2500,
  ollamaUrl: "http://127.0.0.1:11434/api/generate",
  ollamaModel: "deepseek-v3.1:671b-cloud",
  autoBackup: true,
  backupInterval: 10, // Backup every 10 chunks
};

// Initialize directories
async function initDirs() {
  const dirs = [CACHE_DIR, OUTPUT_DIR, CLEANED_DIR, BACKUP_DIR, LOGS_DIR];
  if (CONFIG.debugMode) {
    dirs.push(DEBUG_DIR);
  }
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
}

// Logger
class Logger {
  static async log(bookName, level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      bookName,
      message,
      data,
    };

    const logFile = path.join(
      LOGS_DIR,
      `${bookName}_${new Date().toISOString().split("T")[0]}.log`
    );
    await fs.appendFile(logFile, JSON.stringify(logEntry) + "\n", "utf8");

    const emoji =
      { INFO: "ℹ️", SUCCESS: "✅", ERROR: "❌", WARNING: "⚠️", DEBUG: "🔍" }[
        level
      ] || "📝";
    console.log(`${emoji} [${timestamp}] ${message}`);
    if (data) console.log(data);
  }
}

// Smart text chunking - respects sentence boundaries
function smartChunk(text, maxSize = CONFIG.chunkSize) {
  const chunks = [];
  let currentChunk = "";

  // Split by sentences (., !, ?, ।)
  const sentences = text.match(/[^.!?।]+[.!?।]+/g) || [text];

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();

    // If adding this sentence exceeds maxSize and we have content, save current chunk
    if (
      currentChunk.length + trimmedSentence.length > maxSize &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.trim());
      currentChunk = trimmedSentence;
    } else {
      currentChunk += (currentChunk ? " " : "") + trimmedSentence;
    }
  }

  // Add the last chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.map((chunk, index) => ({
    number: index + 1,
    text: chunk,
    hash: crypto.createHash("md5").update(chunk).digest("hex").substring(0, 8),
  }));
}

// Validate chunk ends properly
function validateChunk(chunk) {
  const text = chunk.text.trim();
  const lastChar = text[text.length - 1];

  // Check if ends with proper punctuation
  const validEndings = [".", "!", "?", "।", ")", '"', "'", ":", ";"];
  const endsProperlyEnglish = validEndings.includes(lastChar);

  // Check for incomplete sentences
  const hasOpenQuote = (text.match(/"/g) || []).length % 2 !== 0;
  const hasOpenParenthesis =
    (text.match(/\(/g) || []).length !== (text.match(/\)/g) || []).length;

  return {
    isValid: endsProperlyEnglish && !hasOpenQuote && !hasOpenParenthesis,
    endsProperlyEnglish,
    hasOpenQuote,
    hasOpenParenthesis,
    lastChar,
  };
}

// Load cached progress
async function loadProgress(bookName) {
  try {
    const progressFile = path.join(CACHE_DIR, `${bookName}_progress.json`);
    const data = await fs.readFile(progressFile, "utf8");
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

// Save progress with atomic write
async function saveProgress(bookName, progress) {
  const progressFile = path.join(CACHE_DIR, `${bookName}_progress.json`);
  const tempFile = progressFile + ".tmp";

  await fs.writeFile(tempFile, JSON.stringify(progress, null, 2), "utf8");
  await fs.rename(tempFile, progressFile);

  await Logger.log(bookName, "DEBUG", "Progress saved", {
    completed: progress.completedChunks.length,
    total: progress.totalChunks,
  });
}

// Load cached text
async function loadCachedText(bookName) {
  try {
    const textFile = path.join(CACHE_DIR, `${bookName}_text.txt`);
    return await fs.readFile(textFile, "utf8");
  } catch (error) {
    return null;
  }
}

// Save text to cache
async function cacheText(bookName, text) {
  const textFile = path.join(CACHE_DIR, `${bookName}_text.txt`);
  await fs.writeFile(textFile, text, "utf8");
}

// Load cached chunks
async function loadCachedChunks(bookName) {
  try {
    const chunksFile = path.join(CACHE_DIR, `${bookName}_chunks.json`);
    const data = await fs.readFile(chunksFile, "utf8");
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

// Save chunks to cache
async function cacheChunks(bookName, chunks) {
  const chunksFile = path.join(CACHE_DIR, `${bookName}_chunks.json`);
  await fs.writeFile(chunksFile, JSON.stringify(chunks, null, 2), "utf8");
}

// Create backup
async function createBackup(bookName, chunkNumber) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = path.join(
      BACKUP_DIR,
      `${bookName}_chunk${chunkNumber}_${timestamp}.txt`
    );
    const outputFile = path.join(OUTPUT_DIR, `${bookName}_translation.txt`);

    await fs.copyFile(outputFile, backupFile);
    await Logger.log(
      bookName,
      "INFO",
      `Backup created at chunk ${chunkNumber}`
    );
  } catch (error) {
    await Logger.log(bookName, "WARNING", "Backup failed", error.message);
  }
}

// Fetch FAST free proxies from multiple sources
async function fetchFastProxies() {
  console.log("🔍 Fetching fast free proxies...");

  try {
    // Method 1: ProxyScrape API (Fast & Reliable)
    const response = await axios.get(ROTATING_PROXY_APIS.proxyScrape, {
      timeout: 10000,
    });

    const proxies = response.data
      .split("\n")
      .filter((p) => p.trim())
      .slice(0, 30) // Top 30 fastest
      .map((proxy) => {
        const [host, port] = proxy.split(":");
        return { host: host.trim(), port: parseInt(port) };
      });

    proxyList = [...FAST_FREE_PROXIES, ...proxies];
    console.log(`✅ Loaded ${proxyList.length} fast proxies`);
  } catch (error) {
    console.log("⚠️  API fetch failed, using default fast proxies");
    proxyList = FAST_FREE_PROXIES;
  }
}

// Get working proxy with health check
async function getWorkingProxy() {
  if (proxyList.length === 0) {
    return null;
  }

  // Try current proxy
  let attempts = 0;
  while (attempts < proxyList.length) {
    const proxy = proxyList[currentProxyIndex];

    try {
      // Quick health check (1 second timeout)
      const proxyUrl = `http://${proxy.host}:${proxy.port}`;
      const agent = new HttpsProxyAgent.HttpsProxyAgent(proxyUrl);

      await axios.get("https://cloudflare.com/cdn-cgi/trace", {
        httpsAgent: agent,
        timeout: 2000, // 2 second timeout for health check
      });

      // Proxy works!
      return agent;
    } catch (error) {
      // Proxy failed, try next one
      console.log(
        `⚠️  Proxy ${proxy.host}:${proxy.port} failed, trying next...`
      );
      currentProxyIndex = (currentProxyIndex + 1) % proxyList.length;
      attempts++;
    }
  }

  console.log("⚠️  All proxies failed, using direct connection");
  return null;
}

// Get proxy agent (fast method)
function getProxyAgent() {
  if (!CONFIG.rotateIP) {
    return null;
  }

  if (proxyList.length === 0) {
    return null;
  }

  const proxy = proxyList[currentProxyIndex];
  const proxyUrl = `http://${proxy.host}:${proxy.port}`;
  return new HttpsProxyAgent.HttpsProxyAgent(proxyUrl);
}

// Rotate to next proxy
function rotateProxy() {
  currentProxyIndex = (currentProxyIndex + 1) % proxyList.length;
  const proxy = proxyList[currentProxyIndex];
  console.log(`🔄 Rotated to proxy: ${proxy.host}:${proxy.port}`);
}

// Retry mechanism for API calls
async function callOllamaWithRetry(
  prompt,
  bookName,
  chunkNumber,
  retries = CONFIG.maxRetries
) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await Logger.log(
        bookName,
        "DEBUG",
        `API call attempt ${attempt}/${retries} for chunk ${chunkNumber}`
      );

      const response = await axios.post(
        CONFIG.ollamaUrl,
        {
          model: CONFIG.ollamaModel,
          prompt: prompt,
          stream: false,
        },
        {
          timeout: CONFIG.requestTimeout,
        }
      );

      return response.data.response || "";
    } catch (error) {
      await Logger.log(
        bookName,
        "ERROR",
        `API call failed (attempt ${attempt}/${retries})`,
        {
          chunk: chunkNumber,
          error: error.message,
        }
      );

      if (attempt === retries) {
        throw error;
      }

      // Exponential backoff
      const delay = CONFIG.retryDelay * Math.pow(2, attempt - 1);
      await Logger.log(bookName, "INFO", `Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// Validate translation quality
function validateTranslation(original, translation) {
  const issues = [];

  // Check if translation is empty
  if (!translation || translation.trim().length === 0) {
    issues.push("Translation is empty");
  }

  // Check if translation is too short (less than 30% of original)
  if (translation.length < original.length * 0.3) {
    issues.push("Translation seems too short");
  }

  // Check for common error patterns
  if (translation.includes("I cannot") || translation.includes("I apologize")) {
    issues.push("AI refused to translate");
  }

  // Check for incomplete Hindi text (should contain Devanagari characters)
  const hasHindi = /[\u0900-\u097F]/.test(translation);
  if (!hasHindi) {
    issues.push("Translation does not contain Hindi characters");
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

// Note: buildTranslationPrompt is now imported from prompt.js
// No need to define it here anymore

// Main translation endpoint
app.post("/save-and-translate", async (req, res) => {
  let { text, bookName } = req.body;

  try {
    if (!bookName) {
      return res.status(400).json({ error: "Book name is required" });
    }

    // Sanitize book name
    bookName = bookName.replace(/[^a-zA-Z0-9_-]/g, "_");

    console.log(`\n${"=".repeat(80)}`);
    console.log(`📚 Processing: ${bookName}`);
    console.log(`${"=".repeat(80)}\n`);

    await initDirs();
    await Logger.log(bookName, "INFO", "Translation process started");

    // Check for existing progress
    let progress = await loadProgress(bookName);
    let cachedText = await loadCachedText(bookName);
    let cachedChunks = await loadCachedChunks(bookName);

    let isResume = false;
    let textToProcess = text;
    let chunks = [];

    if (progress && cachedText && cachedChunks) {
      // Resume mode
      isResume = true;
      textToProcess = cachedText;
      chunks = cachedChunks;

      await Logger.log(bookName, "INFO", "RESUME MODE ACTIVATED", {
        total: progress.totalChunks,
        completed: progress.completedChunks.length,
        remaining: progress.totalChunks - progress.completedChunks.length,
      });

      console.log(`🔄 RESUME MODE`);
      console.log(
        `📊 Progress: ${progress.completedChunks.length}/${progress.totalChunks}`
      );
      console.log(
        `⏱️  Last updated: ${new Date(progress.lastUpdated).toLocaleString()}\n`
      );
    } else {
      // New translation
      if (!text) {
        return res
          .status(400)
          .json({ error: "No text provided for new translation" });
      }

      await Logger.log(bookName, "INFO", "NEW TRANSLATION", {
        textLength: text.length,
      });

      console.log(`✨ NEW TRANSLATION`);
      console.log(`📊 Text length: ${text.length} characters`);

      // Save to cache and cleaned folder
      await cacheText(bookName, text);
      const cleanedFile = path.join(CLEANED_DIR, `${bookName}_cleaned.txt`);
      await fs.writeFile(cleanedFile, text, "utf8");

      console.log(`💾 Text cached and saved\n`);

      // Smart chunking with validation
      chunks = smartChunk(text, CONFIG.chunkSize);

      // Validate chunks
      let invalidChunks = 0;
      for (const chunk of chunks) {
        const validation = validateChunk(chunk);
        if (!validation.isValid) {
          invalidChunks++;
          await Logger.log(
            bookName,
            "WARNING",
            `Chunk ${chunk.number} validation warning`,
            validation
          );
        }
      }

      console.log(`✂️  Created ${chunks.length} smart chunks`);
      if (invalidChunks > 0) {
        console.log(
          `⚠️  ${invalidChunks} chunks have minor validation warnings`
        );
      }

      // Save chunks
      await cacheChunks(bookName, chunks);

      // DEBUG MODE: Save individual chunk files for verification
      if (CONFIG.debugMode) {
        console.log(`\n🔍 DEBUG MODE: Saving chunk files for verification...`);
        for (const chunk of chunks) {
          const debugFile = path.join(
            DEBUG_DIR,
            `${bookName}_chunk_${String(chunk.number).padStart(4, "0")}.txt`
          );
          const debugContent = `=== CHUNK ${chunk.number} of ${
            chunks.length
          } ===
Hash: ${chunk.hash}
Length: ${chunk.length} chars
Validation: ${validateChunk(chunk).isValid ? "VALID" : "WARNING"}

${chunk.text}

=== END CHUNK ${chunk.number} ===`;
          await fs.writeFile(debugFile, debugContent, "utf8");
        }
        console.log(`✅ Saved ${chunks.length} chunk files to ${DEBUG_DIR}`);
        console.log(`   Review these files to verify no text is missing!\n`);
      }

      // Initialize progress
      progress = {
        bookName,
        totalChunks: chunks.length,
        completedChunks: [],
        failedChunks: [],
        retriedChunks: {},
        qualityIssues: [],
        startedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        textHash: crypto.createHash("md5").update(text).digest("hex"),
      };

      await saveProgress(bookName, progress);
      console.log(`📝 Progress tracker initialized\n`);
    }

    // Output file
    const outputFile = path.join(OUTPUT_DIR, `${bookName}_translation.txt`);

    // Create output file if doesn't exist
    try {
      await fs.access(outputFile);
    } catch {
      await fs.writeFile(
        outputFile,
        `# ${bookName} - Hindi Translation\n# Generated: ${new Date().toISOString()}\n\n`,
        "utf8"
      );
    }

    const results = [];
    let newlyProcessed = 0;
    let qualityIssuesCount = 0;

    // Process chunks
    for (const chunk of chunks) {
      const chunkNumber = chunk.number;

      // Skip completed chunks
      if (progress.completedChunks.includes(chunkNumber)) {
        console.log(
          `⏭️  Skipping chunk ${chunkNumber}/${chunks.length} (already completed)`
        );
        continue;
      }

      console.log(`\n${"─".repeat(60)}`);
      console.log(`🔄 Processing chunk ${chunkNumber}/${chunks.length}`);
      console.log(
        `📝 Hash: ${chunk.hash} | Length: ${chunk.text.length} chars`
      );

      try {
        const prompt = buildTranslationPrompt(
          chunk.text,
          chunkNumber,
          chunks.length
        );
        const translation = await callOllamaWithRetry(
          prompt,
          bookName,
          chunkNumber
        );

        // Validate translation quality
        const validation = validateTranslation(chunk.text, translation);

        if (!validation.isValid) {
          qualityIssuesCount++;
          await Logger.log(
            bookName,
            "WARNING",
            `Quality issues in chunk ${chunkNumber}`,
            validation.issues
          );

          progress.qualityIssues.push({
            chunkNumber,
            issues: validation.issues,
          });
        }

        if (translation && translation.trim()) {
          // Add chunk separator for clarity
          const separator = `\n\n--- Chunk ${chunkNumber} ---\n\n`;
          await fs.appendFile(
            outputFile,
            separator + translation.trim() + "\n\n",
            "utf8"
          );

          console.log(
            `✅ Chunk ${chunkNumber} translated (${translation.length} chars)`
          );
          if (!validation.isValid) {
            console.log(
              `⚠️  Quality warnings: ${validation.issues.join(", ")}`
            );
          }
        }

        // Update progress
        progress.completedChunks.push(chunkNumber);
        progress.lastUpdated = new Date().toISOString();

        // Remove from failed if it was there
        progress.failedChunks = progress.failedChunks.filter(
          (n) => n !== chunkNumber
        );

        await saveProgress(bookName, progress);

        results.push({
          chunkNumber,
          status: "success",
          length: translation.length,
          hash: chunk.hash,
          qualityIssues: validation.issues,
        });

        newlyProcessed++;

        // Auto-backup at intervals
        if (CONFIG.autoBackup && newlyProcessed % CONFIG.backupInterval === 0) {
          await createBackup(bookName, chunkNumber);
        }

        // Delay between requests
        await new Promise((resolve) => setTimeout(resolve, CONFIG.batchDelay));
      } catch (error) {
        console.error(`❌ Error on chunk ${chunkNumber}: ${error.message}`);

        await Logger.log(bookName, "ERROR", `Chunk ${chunkNumber} failed`, {
          error: error.message,
          stack: error.stack,
        });

        // Track retries
        if (!progress.retriedChunks[chunkNumber]) {
          progress.retriedChunks[chunkNumber] = 0;
        }
        progress.retriedChunks[chunkNumber]++;

        // Add to failed chunks
        if (!progress.failedChunks.includes(chunkNumber)) {
          progress.failedChunks.push(chunkNumber);
        }

        progress.lastUpdated = new Date().toISOString();
        await saveProgress(bookName, progress);

        results.push({
          chunkNumber,
          status: "failed",
          error: error.message,
          retries: progress.retriedChunks[chunkNumber],
        });

        await fs.appendFile(
          outputFile,
          `\n\n[ERROR: Chunk ${chunkNumber} failed after ${progress.retriedChunks[chunkNumber]} retries - ${error.message}]\n\n`,
          "utf8"
        );

        console.log(`⚠️  Continuing with next chunk...`);
      }
    }

    // Check completion
    const isComplete = progress.completedChunks.length === progress.totalChunks;

    if (isComplete) {
      progress.completedAt = new Date().toISOString();
      await saveProgress(bookName, progress);
      await createBackup(bookName, "final");
      await Logger.log(
        bookName,
        "SUCCESS",
        "Translation completed successfully"
      );
    }

    // Get file stats for response
    let fileSize = 0;
    try {
      const stats = await fs.stat(outputFile);
      fileSize = stats.size;
    } catch (error) {
      // Ignore error
    }

    // Generate summary
    const summary = {
      bookName,
      mode: isResume ? "resume" : "new",
      status: isComplete ? "completed" : "in_progress",
      isComplete,
      message: isComplete
        ? `🎉 Translation COMPLETE! All ${progress.totalChunks} chunks done`
        : `✅ Progress saved! ${progress.completedChunks.length}/${progress.totalChunks} chunks done`,
      statistics: {
        totalChunks: progress.totalChunks,
        completedChunks: progress.completedChunks.length,
        failedChunks: progress.failedChunks.length,
        newlyProcessed,
        qualityIssues: qualityIssuesCount,
        completionPercentage: (
          (progress.completedChunks.length / progress.totalChunks) *
          100
        ).toFixed(2),
        fileSizeKB: (fileSize / 1024).toFixed(2),
      },
      timing: {
        startedAt: progress.startedAt,
        lastUpdated: progress.lastUpdated,
        completedAt: progress.completedAt || null,
      },
      files: {
        translation: outputFile,
        translationFileName: `${bookName}_translation.txt`,
        cleaned: path.join(CLEANED_DIR, `${bookName}_cleaned.txt`),
        log: path.join(
          LOGS_DIR,
          `${bookName}_${new Date().toISOString().split("T")[0]}.log`
        ),
      },
      cache: {
        text: path.join(CACHE_DIR, `${bookName}_text.txt`),
        chunks: path.join(CACHE_DIR, `${bookName}_chunks.json`),
        progress: path.join(CACHE_DIR, `${bookName}_progress.json`),
      },
      results,
    };

    console.log(`\n${"=".repeat(80)}`);
    console.log(`📊 SUMMARY:`);
    console.log(`   Book: ${bookName}`);
    console.log(`   Mode: ${summary.mode.toUpperCase()}`);
    console.log(`   Status: ${isComplete ? "✅ COMPLETE" : "⏸️  IN PROGRESS"}`);
    console.log(
      `   Progress: ${progress.completedChunks.length}/${progress.totalChunks} (${summary.statistics.completionPercentage}%)`
    );
    console.log(`   Failed: ${progress.failedChunks.length}`);
    console.log(`   Quality Issues: ${qualityIssuesCount}`);
    console.log(`   Output: ${outputFile}`);
    console.log(`${"=".repeat(80)}\n`);

    res.json(summary);
  } catch (error) {
    console.error("❌ Critical server error:", error);
    await Logger.log(bookName || "unknown", "ERROR", "Critical error", {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: "Translation failed",
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// Get progress endpoint
app.get("/progress/:bookName", async (req, res) => {
  try {
    const { bookName } = req.params;
    const progress = await loadProgress(bookName);

    if (!progress) {
      return res.status(404).json({ error: "No progress found for this book" });
    }

    const percentage = (
      (progress.completedChunks.length / progress.totalChunks) *
      100
    ).toFixed(2);

    res.json({
      ...progress,
      completionPercentage: percentage,
      remainingChunks: progress.totalChunks - progress.completedChunks.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List all books
app.get("/books", async (req, res) => {
  try {
    const files = await fs.readdir(CACHE_DIR);
    const progressFiles = files.filter((f) => f.endsWith("_progress.json"));

    const books = await Promise.all(
      progressFiles.map(async (file) => {
        const bookName = file.replace("_progress.json", "");
        const progress = await loadProgress(bookName);
        const percentage = (
          (progress.completedChunks.length / progress.totalChunks) *
          100
        ).toFixed(2);

        return {
          bookName,
          totalChunks: progress.totalChunks,
          completedChunks: progress.completedChunks.length,
          failedChunks: progress.failedChunks.length,
          qualityIssues: progress.qualityIssues?.length || 0,
          completionPercentage: percentage,
          isComplete: progress.completedChunks.length === progress.totalChunks,
          startedAt: progress.startedAt,
          lastUpdated: progress.lastUpdated,
          completedAt: progress.completedAt,
        };
      })
    );

    res.json({
      books,
      total: books.length,
      completed: books.filter((b) => b.isComplete).length,
      inProgress: books.filter((b) => !b.isComplete).length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete book cache
app.delete("/books/:bookName", async (req, res) => {
  try {
    const { bookName } = req.params;

    const filesToDelete = [
      path.join(CACHE_DIR, `${bookName}_text.txt`),
      path.join(CACHE_DIR, `${bookName}_chunks.json`),
      path.join(CACHE_DIR, `${bookName}_progress.json`),
    ];

    for (const file of filesToDelete) {
      try {
        await fs.unlink(file);
      } catch (err) {
        // File might not exist
      }
    }

    res.json({ message: `Cache cleared for ${bookName}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get("/health", async (req, res) => {
  try {
    // Check Ollama connection
    let ollamaStatus = "unknown";
    try {
      await axios.get("http://127.0.0.1:11434/api/tags", { timeout: 5000 });
      ollamaStatus = "connected";
    } catch {
      ollamaStatus = "disconnected";
    }

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      ollama: ollamaStatus,
      directories: {
        cache: CACHE_DIR,
        translations: OUTPUT_DIR,
        cleaned: CLEANED_DIR,
        backups: BACKUP_DIR,
        logs: LOGS_DIR,
      },
      config: CONFIG,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get logs
app.get("/logs/:bookName", async (req, res) => {
  try {
    const { bookName } = req.params;
    const date = req.query.date || new Date().toISOString().split("T")[0];
    const logFile = path.join(LOGS_DIR, `${bookName}_${date}.log`);

    const logs = await fs.readFile(logFile, "utf8");
    const logEntries = logs
      .split("\n")
      .filter((l) => l)
      .map((l) => JSON.parse(l));

    res.json({ logs: logEntries });
  } catch (error) {
    res.status(404).json({ error: "Log file not found" });
  }
});

// Start server
app.listen(PORT, async () => {
  await initDirs();
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🚀 SUPER TRANSLATION SERVER v2.0`);
  console.log(`${"=".repeat(80)}`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`\n📁 Directories:`);
  console.log(`   ├─ Cache: ${CACHE_DIR}`);
  console.log(`   ├─ Translations: ${OUTPUT_DIR}`);
  console.log(`   ├─ Cleaned: ${CLEANED_DIR}`);
  console.log(`   ├─ Backups: ${BACKUP_DIR}`);
  console.log(`   └─ Logs: ${LOGS_DIR}`);
  console.log(`\n⚙️  Configuration:`);
  console.log(`   ├─ Chunk Size: ${CONFIG.chunkSize} chars`);
  console.log(`   ├─ Max Retries: ${CONFIG.maxRetries}`);
  console.log(
    `   ├─ Auto Backup: ${CONFIG.autoBackup ? "Enabled" : "Disabled"}`
  );
  console.log(`   └─ Model: ${CONFIG.ollamaModel}`);
  console.log(`${"=".repeat(80)}\n`);
});
