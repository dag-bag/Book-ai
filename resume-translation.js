const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const readline = require("readline");

const SERVER_URL = "http://localhost:3000";

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) =>
  new Promise((resolve) => rl.question(query, resolve));

// Colors for terminal
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

// Resume translation
async function resumeTranslation(bookName) {
  try {
    console.log(
      colorize(`\n🔄 Resuming translation for: ${bookName}\n`, "cyan")
    );

    const response = await axios.post(`${SERVER_URL}/save-and-translate`, {
      bookName: bookName,
    });

    console.log(colorize("\n✅ Resume request successful!", "green"));
    console.log("\n" + "=".repeat(80));
    console.log(colorize("SUMMARY:", "bright"));
    console.log(`  Status: ${response.data.status}`);
    console.log(`  Mode: ${response.data.mode}`);
    console.log(
      `  Progress: ${response.data.statistics.completedChunks}/${response.data.statistics.totalChunks}`
    );
    console.log(
      `  Completion: ${response.data.statistics.completionPercentage}%`
    );
    console.log(`  Failed: ${response.data.statistics.failedChunks}`);
    console.log(`  Quality Issues: ${response.data.statistics.qualityIssues}`);
    console.log("=".repeat(80) + "\n");
  } catch (error) {
    console.error(
      colorize("❌ Error:", "red"),
      error.response?.data || error.message
    );
  }
}

// List all books
async function listBooks() {
  try {
    const response = await axios.get(`${SERVER_URL}/books`);
    const { books, total, completed, inProgress } = response.data;

    if (books.length === 0) {
      console.log(colorize("\n📚 No books found in cache\n", "yellow"));
      return;
    }

    console.log("\n" + "=".repeat(80));
    console.log(colorize("📚 CACHED BOOKS", "bright"));
    console.log("=".repeat(80));
    console.log(
      colorize(
        `Total: ${total} | Completed: ${completed} | In Progress: ${inProgress}\n`,
        "cyan"
      )
    );

    books.forEach((book, index) => {
      const status = book.isComplete
        ? colorize("✅ DONE", "green")
        : colorize("⏸️  PAUSED", "yellow");
      const percentage = parseFloat(book.completionPercentage);
      const progressBar = createProgressBar(percentage);

      console.log(
        `${index + 1}. ${status} ${colorize(book.bookName, "bright")}`
      );
      console.log(`   ${progressBar} ${book.completionPercentage}%`);
      console.log(
        `   Chunks: ${book.completedChunks}/${book.totalChunks} | Failed: ${book.failedChunks} | Quality Issues: ${book.qualityIssues}`
      );
      console.log(`   Started: ${new Date(book.startedAt).toLocaleString()}`);
      console.log(`   Updated: ${new Date(book.lastUpdated).toLocaleString()}`);
      if (book.completedAt) {
        console.log(
          `   Completed: ${new Date(book.completedAt).toLocaleString()}`
        );
      }
      console.log("─".repeat(80));
    });

    console.log();
  } catch (error) {
    console.error(
      colorize("❌ Error:", "red"),
      error.response?.data || error.message
    );
  }
}

// Create progress bar
function createProgressBar(percentage, width = 40) {
  const filled = Math.round((width * percentage) / 100);
  const empty = width - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);

  let color = "red";
  if (percentage > 66) color = "green";
  else if (percentage > 33) color = "yellow";

  return colorize(bar, color);
}

// Get detailed progress
async function getProgress(bookName) {
  try {
    const response = await axios.get(`${SERVER_URL}/progress/${bookName}`);
    const progress = response.data;

    console.log("\n" + "=".repeat(80));
    console.log(colorize(`📊 PROGRESS: ${bookName}`, "bright"));
    console.log("=".repeat(80));

    const percentage = parseFloat(progress.completionPercentage);
    const progressBar = createProgressBar(percentage, 60);

    console.log(`\n${progressBar} ${progress.completionPercentage}%\n`);
    console.log(colorize("Statistics:", "cyan"));
    console.log(`  Total Chunks: ${progress.totalChunks}`);
    console.log(
      `  Completed: ${colorize(progress.completedChunks.length, "green")}`
    );
    console.log(`  Failed: ${colorize(progress.failedChunks.length, "red")}`);
    console.log(`  Remaining: ${colorize(progress.remainingChunks, "yellow")}`);
    console.log(`  Quality Issues: ${progress.qualityIssues?.length || 0}`);

    console.log(colorize("\nTiming:", "cyan"));
    console.log(`  Started: ${new Date(progress.startedAt).toLocaleString()}`);
    console.log(
      `  Last Updated: ${new Date(progress.lastUpdated).toLocaleString()}`
    );
    if (progress.completedAt) {
      console.log(
        `  Completed: ${new Date(progress.completedAt).toLocaleString()}`
      );
    }

    if (progress.failedChunks.length > 0) {
      console.log(colorize("\nFailed Chunks:", "red"));
      console.log(`  ${progress.failedChunks.join(", ")}`);
    }

    if (
      progress.retriedChunks &&
      Object.keys(progress.retriedChunks).length > 0
    ) {
      console.log(colorize("\nRetried Chunks:", "yellow"));
      Object.entries(progress.retriedChunks).forEach(([chunk, count]) => {
        console.log(`  Chunk ${chunk}: ${count} retries`);
      });
    }

    console.log("\n" + "=".repeat(80) + "\n");
  } catch (error) {
    console.error(
      colorize("❌ Error:", "red"),
      error.response?.data || error.message
    );
  }
}

// View logs
async function viewLogs(bookName, date) {
  try {
    const url = date
      ? `${SERVER_URL}/logs/${bookName}?date=${date}`
      : `${SERVER_URL}/logs/${bookName}`;

    const response = await axios.get(url);
    const { logs } = response.data;

    console.log("\n" + "=".repeat(80));
    console.log(colorize(`📝 LOGS: ${bookName}`, "bright"));
    console.log("=".repeat(80) + "\n");

    logs.forEach((log) => {
      const emoji =
        { INFO: "ℹ️", SUCCESS: "✅", ERROR: "❌", WARNING: "⚠️", DEBUG: "🔍" }[
          log.level
        ] || "📝";
      const timestamp = new Date(log.timestamp).toLocaleTimeString();
      console.log(`${emoji} [${timestamp}] ${log.message}`);
      if (log.data) {
        console.log(`   ${JSON.stringify(log.data)}`);
      }
    });

    console.log("\n" + "=".repeat(80) + "\n");
  } catch (error) {
    console.error(
      colorize("❌ Error:", "red"),
      error.response?.data || error.message
    );
  }
}

// Clear book cache
async function clearCache(bookName) {
  try {
    const answer = await question(
      colorize(
        `⚠️  Are you sure you want to clear cache for "${bookName}"? (yes/no): `,
        "yellow"
      )
    );

    if (answer.toLowerCase() !== "yes") {
      console.log(colorize("❌ Cancelled", "red"));
      return;
    }

    await axios.delete(`${SERVER_URL}/books/${bookName}`);
    console.log(colorize(`\n✅ Cache cleared for ${bookName}\n`, "green"));
  } catch (error) {
    console.error(
      colorize("❌ Error:", "red"),
      error.response?.data || error.message
    );
  }
}

// Health check
async function healthCheck() {
  try {
    const response = await axios.get(`${SERVER_URL}/health`);
    const health = response.data;

    console.log("\n" + "=".repeat(80));
    console.log(colorize("🏥 HEALTH CHECK", "bright"));
    console.log("=".repeat(80));

    const ollamaStatus =
      health.ollama === "connected"
        ? colorize("✅ Connected", "green")
        : colorize("❌ Disconnected", "red");

    console.log(`\nServer Status: ${colorize("✅ Online", "green")}`);
    console.log(`Ollama Status: ${ollamaStatus}`);
    console.log(`Timestamp: ${new Date(health.timestamp).toLocaleString()}`);

    console.log(colorize("\nDirectories:", "cyan"));
    Object.entries(health.directories).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    console.log(colorize("\nConfiguration:", "cyan"));
    Object.entries(health.config).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    console.log("\n" + "=".repeat(80) + "\n");
  } catch (error) {
    console.error(colorize("❌ Server is offline or unreachable", "red"));
  }
}

// Interactive menu
async function interactiveMenu() {
  console.log(colorize("\n🎯 BOOK TRANSLATION MANAGER\n", "bright"));
  console.log("1. List all books");
  console.log("2. Resume translation");
  console.log("3. Check progress");
  console.log("4. View logs");
  console.log("5. Clear cache");
  console.log("6. Health check");
  console.log("7. Exit\n");

  const choice = await question("Select an option: ");

  switch (choice) {
    case "1":
      await listBooks();
      break;
    case "2":
      const bookToResume = await question("Enter book name: ");
      await resumeTranslation(bookToResume);
      break;
    case "3":
      const bookToCheck = await question("Enter book name: ");
      await getProgress(bookToCheck);
      break;
    case "4":
      const bookForLogs = await question("Enter book name: ");
      const logDate = await question(
        "Enter date (YYYY-MM-DD) or press Enter for today: "
      );
      await viewLogs(bookForLogs, logDate || undefined);
      break;
    case "5":
      const bookToClear = await question("Enter book name: ");
      await clearCache(bookToClear);
      break;
    case "6":
      await healthCheck();
      break;
    case "7":
      console.log(colorize("\n👋 Goodbye!\n", "cyan"));
      rl.close();
      process.exit(0);
      return;
    default:
      console.log(colorize("❌ Invalid option", "red"));
  }

  // Loop back to menu
  await interactiveMenu();
}

// Main
const args = process.argv.slice(2);
const command = args[0];
const bookName = args[1];
const extraArg = args[2];

async function main() {
  console.log(
    colorize("\n🎯 Book Translation Management Tool v2.0\n", "bright")
  );

  if (!command) {
    // Start interactive mode
    await interactiveMenu();
    return;
  }

  switch (command) {
    case "list":
    case "ls":
      await listBooks();
      break;

    case "resume":
    case "r":
      if (!bookName) {
        console.log(colorize("❌ Please provide book name", "red"));
        console.log("Usage: node resume-translation.js resume <bookName>");
        return;
      }
      await resumeTranslation(bookName);
      break;

    case "progress":
    case "p":
      if (!bookName) {
        console.log(colorize("❌ Please provide book name", "red"));
        console.log("Usage: node resume-translation.js progress <bookName>");
        return;
      }
      await getProgress(bookName);
      break;

    case "logs":
    case "l":
      if (!bookName) {
        console.log(colorize("❌ Please provide book name", "red"));
        console.log("Usage: node resume-translation.js logs <bookName> [date]");
        return;
      }
      await viewLogs(bookName, extraArg);
      break;

    case "clear":
    case "c":
      if (!bookName) {
        console.log(colorize("❌ Please provide book name", "red"));
        console.log("Usage: node resume-translation.js clear <bookName>");
        return;
      }
      await clearCache(bookName);
      break;

    case "health":
    case "h":
      await healthCheck();
      break;

    case "interactive":
    case "i":
      await interactiveMenu();
      return;

    default:
      console.log(colorize("Usage:", "bright"));
      console.log(
        "  node resume-translation.js                       - Interactive mode"
      );
      console.log(
        "  node resume-translation.js list                  - List all books"
      );
      console.log(
        "  node resume-translation.js resume <bookName>     - Resume translation"
      );
      console.log(
        "  node resume-translation.js progress <bookName>   - Check progress"
      );
      console.log(
        "  node resume-translation.js logs <bookName>       - View logs"
      );
      console.log(
        "  node resume-translation.js clear <bookName>      - Clear cache"
      );
      console.log(
        "  node resume-translation.js health                - Health check"
      );
      console.log(colorize("\nShortcuts:", "cyan"));
      console.log("  ls, r, p, l, c, h, i");
      console.log(colorize("\nNote:", "yellow"));
      console.log(
        "  Completed translations will be uploaded to Google Drive via n8n workflow"
      );
      console.log();
  }

  rl.close();
}

main();
