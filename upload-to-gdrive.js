const { google } = require("googleapis");
const fs = require("fs").promises;
const path = require("path");
const readline = require("readline");

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const TOKEN_PATH = path.join(__dirname, "token.json");
const CREDENTIALS_PATH = path.join(__dirname, "credentials.json");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) =>
  new Promise((resolve) => rl.question(query, resolve));

// Load client secrets
async function loadCredentials() {
  try {
    const content = await fs.readFile(CREDENTIALS_PATH, "utf8");
    return JSON.parse(content);
  } catch (error) {
    throw new Error(
      "credentials.json not found. Please download it from Google Cloud Console."
    );
  }
}

// Authorize with OAuth2
async function authorize() {
  try {
    const credentials = await loadCredentials();
    const { client_secret, client_id, redirect_uris } =
      credentials.installed || credentials.web;
    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );

    // Check if we have a token
    try {
      const token = await fs.readFile(TOKEN_PATH, "utf8");
      oAuth2Client.setCredentials(JSON.parse(token));
      return oAuth2Client;
    } catch (error) {
      // Need to get new token
      return await getNewToken(oAuth2Client);
    }
  } catch (error) {
    console.error("Error loading credentials:", error.message);
    throw error;
  }
}

// Get new OAuth token
async function getNewToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });

  console.log("\n🔐 Authorize this app by visiting this URL:");
  console.log(authUrl);

  const code = await question("\n📝 Enter the code from that page here: ");

  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);

  // Save token
  await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens));
  console.log("✅ Token stored to", TOKEN_PATH);

  return oAuth2Client;
}

// Upload file to Google Drive
async function uploadFile(auth, filePath, fileName, folderId = null) {
  const drive = google.drive({ version: "v3", auth });

  const fileMetadata = {
    name: fileName,
    parents: folderId ? [folderId] : [],
  };

  const media = {
    mimeType: "text/plain",
    body: require("fs").createReadStream(filePath),
  };

  try {
    console.log(`\n📤 Uploading ${fileName} to Google Drive...`);

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, name, webViewLink, size",
    });

    console.log("✅ File uploaded successfully!");
    console.log(`   File ID: ${response.data.id}`);
    console.log(`   Name: ${response.data.name}`);
    console.log(`   Link: ${response.data.webViewLink}`);
    console.log(`   Size: ${(response.data.size / 1024).toFixed(2)} KB`);

    return response.data;
  } catch (error) {
    console.error("❌ Upload failed:", error.message);
    throw error;
  }
}

// Create folder in Google Drive
async function createFolder(auth, folderName) {
  const drive = google.drive({ version: "v3", auth });

  const fileMetadata = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
  };

  try {
    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: "id, name",
    });

    console.log(
      `✅ Folder created: ${response.data.name} (${response.data.id})`
    );
    return response.data.id;
  } catch (error) {
    console.error("❌ Folder creation failed:", error.message);
    throw error;
  }
}

// List files in Google Drive
async function listFiles(auth, query = null) {
  const drive = google.drive({ version: "v3", auth });

  try {
    const response = await drive.files.list({
      pageSize: 20,
      fields: "nextPageToken, files(id, name, mimeType, size, modifiedTime)",
      q: query,
    });

    return response.data.files;
  } catch (error) {
    console.error("❌ List files failed:", error.message);
    throw error;
  }
}

// Upload translation to Google Drive
async function uploadTranslation(bookName, options = {}) {
  try {
    console.log("\n🚀 Starting Google Drive upload...\n");

    const auth = await authorize();

    const translationPath = path.join(
      __dirname,
      "translations",
      `${bookName}_translation.txt`
    );

    // Check if file exists
    try {
      await fs.access(translationPath);
    } catch {
      console.error(`❌ Translation file not found: ${translationPath}`);
      return;
    }

    // Get file stats
    const stats = await fs.stat(translationPath);
    console.log(`📁 File: ${bookName}_translation.txt`);
    console.log(`📊 Size: ${(stats.size / 1024).toFixed(2)} KB`);

    // Create folder if requested
    let folderId = options.folderId;
    if (options.createFolder) {
      const folderName = options.folderName || "Translations";
      console.log(`\n📂 Creating folder: ${folderName}`);
      folderId = await createFolder(auth, folderName);
    }

    // Upload file
    const result = await uploadFile(
      auth,
      translationPath,
      `${bookName}_translation.txt`,
      folderId
    );

    // Also upload cleaned text if requested
    if (options.includeCleanedText) {
      const cleanedPath = path.join(
        __dirname,
        "cleaned_texts",
        `${bookName}_cleaned.txt`
      );
      try {
        await fs.access(cleanedPath);
        await uploadFile(
          auth,
          cleanedPath,
          `${bookName}_cleaned.txt`,
          folderId
        );
      } catch {
        console.log("⚠️  Cleaned text file not found, skipping...");
      }
    }

    console.log("\n✅ Upload complete!");
    return result;
  } catch (error) {
    console.error("\n❌ Upload process failed:", error.message);
    throw error;
  }
}

// Interactive mode
async function interactiveUpload() {
  try {
    console.log("\n📤 GOOGLE DRIVE UPLOAD\n");

    const bookName = await question("Enter book name: ");
    const createFolder = await question("Create folder? (y/n): ");
    const folderName =
      createFolder.toLowerCase() === "y"
        ? (await question("Folder name (default: Translations): ")) ||
          "Translations"
        : null;
    const includeCleanedText = await question("Include cleaned text? (y/n): ");

    const options = {
      createFolder: createFolder.toLowerCase() === "y",
      folderName,
      includeCleanedText: includeCleanedText.toLowerCase() === "y",
    };

    await uploadTranslation(bookName, options);
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    rl.close();
  }
}

// Main
const args = process.argv.slice(2);
const command = args[0];
const bookName = args[1];

async function main() {
  console.log("\n🎯 Google Drive Upload Tool\n");

  if (!command || command === "interactive") {
    await interactiveUpload();
    return;
  }

  switch (command) {
    case "upload":
      if (!bookName) {
        console.log("❌ Please provide book name");
        console.log("Usage: node upload-to-gdrive.js upload <bookName>");
        rl.close();
        return;
      }

      await uploadTranslation(bookName, {
        createFolder: true,
        folderName: "Translations",
        includeCleanedText: true,
      });
      rl.close();
      break;

    case "list":
      const auth = await authorize();
      const files = await listFiles(auth);

      console.log("\n📁 Recent files in Google Drive:\n");
      files.forEach((file, index) => {
        console.log(`${index + 1}. ${file.name}`);
        console.log(`   ID: ${file.id}`);
        console.log(`   Type: ${file.mimeType}`);
        if (file.size)
          console.log(`   Size: ${(file.size / 1024).toFixed(2)} KB`);
        console.log(
          `   Modified: ${new Date(file.modifiedTime).toLocaleString()}`
        );
        console.log("─".repeat(60));
      });
      rl.close();
      break;

    default:
      console.log("Usage:");
      console.log(
        "  node upload-to-gdrive.js                     - Interactive mode"
      );
      console.log(
        "  node upload-to-gdrive.js upload <bookName>   - Upload translation"
      );
      console.log(
        "  node upload-to-gdrive.js list                - List Drive files"
      );
      console.log("\nSetup:");
      console.log("  1. Create project in Google Cloud Console");
      console.log("  2. Enable Google Drive API");
      console.log("  3. Create OAuth 2.0 credentials");
      console.log("  4. Download credentials.json to this directory");
      console.log();
      rl.close();
  }
}

main();
