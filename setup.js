const fs = require("fs").promises;
const path = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");

const execAsync = promisify(exec);

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

async function checkNodeVersion() {
  const version = process.version;
  const majorVersion = parseInt(version.slice(1).split(".")[0]);

  console.log(`📌 Node.js version: ${version}`);

  if (majorVersion < 14) {
    console.log(colorize("⚠️  Warning: Node.js 14+ recommended", "yellow"));
    return false;
  }

  console.log(colorize("✅ Node.js version OK", "green"));
  return true;
}

async function createDirectories() {
  console.log("\n📁 Creating directories...");

  const dirs = ["cache", "translations", "cleaned_texts", "backups", "logs"];

  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
      console.log(colorize(`✅ Created: ${dir}/`, "green"));
    } catch (error) {
      console.log(colorize(`❌ Failed to create: ${dir}/`, "red"));
    }
  }
}

async function checkOllama() {
  console.log("\n🤖 Checking Ollama...");

  try {
    const { stdout } = await execAsync(
      "curl -s http://localhost:11434/api/tags"
    );
    console.log(colorize("✅ Ollama is running", "green"));

    const data = JSON.parse(stdout);
    if (data.models && data.models.length > 0) {
      console.log(colorize("\n📦 Available models:", "cyan"));
      data.models.forEach((model) => {
        console.log(`   - ${model.name}`);
      });
    }
    return true;
  } catch (error) {
    console.log(colorize("❌ Ollama not responding", "red"));
    console.log(
      colorize("   Please install Ollama: https://ollama.ai", "yellow")
    );
    return false;
  }
}

async function checkGoogleCredentials() {
  console.log("\n☁️  Checking Google Drive credentials...");

  try {
    await fs.access("credentials.json");
    console.log(colorize("✅ credentials.json found", "green"));
    return true;
  } catch {
    console.log(colorize("⚠️  credentials.json not found", "yellow"));
    console.log(
      colorize(
        "   Google Drive upload will not work until you add it",
        "yellow"
      )
    );
    console.log(colorize("   See README.md for setup instructions", "cyan"));
    return false;
  }
}

async function createConfigFile() {
  console.log("\n⚙️  Creating config file...");

  const config = {
    server: {
      port: 3000,
      chunkSize: 2000,
      maxRetries: 3,
      retryDelay: 2000,
      requestTimeout: 300000,
      batchDelay: 1000,
    },
    ollama: {
      url: "http://127.0.0.1:11434/api/generate",
      model: "deepseek-v3.1:671b-cloud",
    },
    backup: {
      enabled: true,
      interval: 10,
    },
  };

  try {
    await fs.writeFile("config.json", JSON.stringify(config, null, 2));
    console.log(colorize("✅ config.json created", "green"));
  } catch (error) {
    console.log(colorize("❌ Failed to create config.json", "red"));
  }
}

async function installDependencies() {
  console.log("\n📦 Installing dependencies...");
  console.log(colorize("   This may take a few minutes...", "cyan"));

  try {
    const { stdout, stderr } = await execAsync("npm install");
    console.log(colorize("✅ Dependencies installed", "green"));
    return true;
  } catch (error) {
    console.log(colorize("❌ Failed to install dependencies", "red"));
    console.log(error.message);
    return false;
  }
}

async function testServer() {
  console.log("\n🧪 Testing server startup...");

  return new Promise((resolve) => {
    const server = exec("node server.js");

    let output = "";

    server.stdout.on("data", (data) => {
      output += data;
      if (output.includes("Translation Server Started")) {
        console.log(colorize("✅ Server starts successfully", "green"));
        server.kill();
        resolve(true);
      }
    });

    server.stderr.on("data", (data) => {
      console.log(colorize("❌ Server error:", "red"));
      console.log(data);
      server.kill();
      resolve(false);
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      console.log(colorize("⚠️  Server test timeout", "yellow"));
      server.kill();
      resolve(false);
    }, 5000);
  });
}

async function printSummary(results) {
  console.log("\n" + "=".repeat(80));
  console.log(colorize("📊 SETUP SUMMARY", "bright"));
  console.log("=".repeat(80));

  const checks = [
    { name: "Node.js Version", status: results.nodeVersion },
    { name: "Directories Created", status: results.directories },
    { name: "Dependencies Installed", status: results.dependencies },
    { name: "Ollama Running", status: results.ollama },
    { name: "Config File", status: results.config },
    { name: "Server Test", status: results.serverTest },
  ];

  checks.forEach((check) => {
    const status = check.status
      ? colorize("✅ OK", "green")
      : colorize("❌ FAILED", "red");
    console.log(`${check.name.padEnd(30)} ${status}`);
  });

  console.log("=".repeat(80));

  const allPassed = Object.values(results).every((v) => v === true);

  if (allPassed) {
    console.log(colorize("\n🎉 Setup complete! Ready to translate!", "green"));
    console.log("\n📝 Next steps:");
    console.log("   1. Start server: npm start");
    console.log("   2. Configure n8n workflow");
    console.log("   3. Setup Google Drive in n8n");
    console.log("   4. Upload your first PDF");
  } else {
    console.log(colorize("\n⚠️  Setup completed with warnings", "yellow"));
    console.log("\n📝 Action required:");

    if (!results.ollama) {
      console.log("   - Install Ollama: https://ollama.ai");
      console.log("   - Pull model: ollama pull deepseek-v3.1:671b-cloud");
    }
  }

  console.log("\n📖 For detailed instructions, see README.md");
  console.log();
}

async function main() {
  console.log(colorize("\n🚀 Book Translation System Setup", "bright"));
  console.log(colorize("=".repeat(80), "cyan"));

  const results = {};

  try {
    // Check Node version
    results.nodeVersion = await checkNodeVersion();

    // Create directories
    await createDirectories();
    results.directories = true;

    // Install dependencies
    results.dependencies = await installDependencies();

    // Check Ollama
    results.ollama = await checkOllama();

    // Create config
    await createConfigFile();
    results.config = true;

    // Test server
    if (results.dependencies) {
      results.serverTest = await testServer();
    } else {
      results.serverTest = false;
    }

    // Print summary
    await printSummary(results);
  } catch (error) {
    console.error(colorize("\n❌ Setup failed:", "red"), error.message);
    process.exit(1);
  }
}

main();
