const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { publishJob } = require("../config/message-queue.js");
const { pool } = require("../config/database.js");

const UPLOADS_ROOT = process.env.UPLOADS_ROOT || "../uploads";
const HOST = process.env.HOST || "http://localhost:3000/api";

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
        if (err.code === "INVALID_FILE_TYPE") {
          return res.status(400).json({
            detail:
              "Invalid file type. Only JPEG, JPG, PNG, and WebP are allowed.",
          });
        }
        return res.status(400).json({ detail: "File upload error." });
      }
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
        (originalFilename, storedFilename, fileSize, mimeType)
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
        originalFilename: originalname,
        source: `${HOST}/image/${filename}`,
        uploadedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ detail: "Failed to process upload" });
    }
  }
);

router.get("/list", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id, originalFilename, 
        CONCAT($1::text,'/image/',storedFilename) AS source, 
        CONCAT($1::text,'/thumbnail/',thumbnailFilename) AS thumbnail,
        uploadedAt
      FROM images
      ORDER BY uploadedAt DESC
    `, [HOST]);
    res.status(200).json({
      data: result.rows.map(e => ({
        id: e.id,
        originalFilename: e.originalfilename,
        source: e.source,
        thumbnail: e.thumbnail,
        uploadedAt: e.uploadedat
      })),
    });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

router.get("/:filename", async (req, res) => {
  const { filename } = req.params;

  const allowedExtensions = /\.(jpeg|jpg|png|webp)$/i;
  if (!allowedExtensions.test(filename)) {
    res.status(400).json({ detail: "Invalid file type requested" });
  }

  try {
    // Check for the stored file name
    const query =
      "SELECT originalFilename FROM images WHERE storedFilename = $1 LIMIT 1";
    const result = await pool.query(query, [filename]);
    if (result.rows.length === 0) {
      return res.status(404).json({ detail: "File not found in database" });
    }
    const originalFilename = result.rows[0].originalFilename;
    const filePath = path.join("originals", filename);

    res.download(
      path.resolve(UPLOADS_ROOT, filePath),
      originalFilename,
      (err) => {
        if (err) {
          console.error("File not found:", err);
          res.status(404).json({ detail: "File not found" });
        }
      }
    );
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

module.exports = router;
