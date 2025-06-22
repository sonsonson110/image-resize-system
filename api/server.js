const express = require("express");
const path = require("path");
const fs = require("fs/promises");
require("dotenv").config();

const { connectDB, pool } = require("./config/database.js");
const {
  connectQueue,
  purgeQueue,
} = require("./config/message-queue.js");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/image", require("./routers/image.js"));
app.use("/api/thumbnail", require("./routers/thumbnail.js"));

app.get("/health", async (req, res) => {
  const databaseStatus = await connectDB();
  const messageQueueStatus = await connectQueue();
  res.status(200).json({
    backend: "ok",
    database: databaseStatus ? "ok" : "down",
    messageQueue: messageQueueStatus ? "ok" : "down",
  });
});

app.delete("/reset", async (req, res) => {
  try {
    await pool.query("DELETE FROM images");
    await fs.rm(UPLOADS_ROOT, { recursive: true, force: true });
    await createUploadDirs();
    await purgeQueue();
    res.status(200).json({ message: "System reset successfully" });
  } catch (err) {
    res.status(500).json({ detail: "Failed to reset system" });
  }
});

// Create uploads directory if it doesn't exist
const UPLOADS_ROOT = process.env.UPLOADS_ROOT || "../uploads";
const createUploadDirs = async () => {
  try {
    await fs.mkdir(UPLOADS_ROOT, { recursive: true });
    await fs.mkdir(path.join(UPLOADS_ROOT, "originals"), { recursive: true });
    await fs.mkdir(path.join(UPLOADS_ROOT, "thumbnails"), { recursive: true });
    console.log("Upload directories ready at:", path.resolve(UPLOADS_ROOT));
  } catch (error) {
    console.error("Error creating upload directories:", error);
  }
};

const startServer = async () => {
  await createUploadDirs();
  const dbConnected = await connectDB();
  if (!dbConnected) {
    console.error("❌ Failed to connect to the database. Exiting...");
    process.exit(1);
  }

  const mqConnected = await connectQueue();
  if (!mqConnected) {
    console.error("❌ Failed to connect to RabbitMQ. Exiting...");
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Image API server running on port ${PORT}`);
    console.log(`📁 Upload directory: ${path.resolve(UPLOADS_ROOT)}/`);
  });
};

startServer().catch(console.error);
