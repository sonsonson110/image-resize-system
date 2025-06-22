const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { publishJob } = require("../config/message-queue.js");
const { pool } = require("../config/database.js");

const UPLOADS_ROOT = process.env.UPLOADS_ROOT || "../uploads";

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
    const error = new Error("INVALID_FILE_TYPE");
    error.code = "INVALID_FILE_TYPE";
    cb(error);
  },
});

router.post(
  "",
  (req, res, next) => {
    upload.single("image")(req, res, (err) => {
      if (err) {
        // Handle multer errors
        if (err.me === "INVALID_FILE_TYPE") {
          return res.status(400).json({
            detail:
              "Invalid file type. Only JPEG, JPG, PNG, and WebP are allowed.",
          });
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
        originalFilename: filename,
        thumbnailPath,
        thumbnailFilename,
      });

      res.status(201).json({
        id: imageId,
        uploadedFilename: originalname,
        storedFilename: filename,
        message:
          "Image uploaded successfully. Waiting for further proccessing...",
      });
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ detail: "Failed to process upload" });
    }
  }
);

module.exports = router;
