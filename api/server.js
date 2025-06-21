const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs/promises");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const { connectDB, pool } = require("./config/database.js");
const {
  connectQueue,
  publishJob,
  purgeQueue,
} = require("./config/message-queue.js");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(UPLOADS_ROOT, "originals"));
  },
  filename: (req, file, cb) => {
    cb(null, uuidv4() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: process.env.MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("INVALID_FILE_TYPE"));
  },
});

app.post(
  "/api/upload",
  (req, res, next) => {
    upload.single("image")(req, res, (err) => {
      if (err) {
        // Handle multer errors
        if (err.code === "INVALID_FILE_TYPE") {
          return res.status(400).json({
            detail:
              "Invalid file type. Only JPEG, JPG, PNG, and WebP are allowed.",
          });
        }
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ detail: "File size too large." });
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return res.status(400).json({ detail: "Unexpected field name." });
        }
        // Handle other multer errors
        return res.status(400).json({ detail: "File upload error." });
      }

      // Continue to your upload handler if no errors
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ detail: "No image provided" });
      }

      // Get file detail
      const { originalname, filename, size, mimetype } = req.file;
      const filePath = path.join(UPLOADS_ROOT, "originals", filename);

      // Insert into database
      const result = await pool.query(
        `INSERT INTO images
        (original_filename, stored_filename, file_size, mime_type)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
        [originalname, filename, size, mimetype]
      );

      const imageId = result.rows[0].id;

      // Prepare thumbnail path
      const thumbnailFilename = `thumb_${filename}`;
      const thumbnailPath = path.join(
        UPLOADS_ROOT,
        "thumbnails",
        thumbnailFilename
      );

      // Queue the job
      await publishJob({
        imageId,
        originalPath: filePath,
        thumbnailPath,
        storedFileName: filename,
      });

      res.status(201).json({
        id: imageId,
        filename: originalname,
        status: "pending",
        message:
          "Image uploaded successfully. Waiting for further proccessing...",
      });
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ detail: "Failed to process upload" });
    }
  }
);

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
