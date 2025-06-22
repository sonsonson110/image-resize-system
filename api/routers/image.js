const router = require("express").Router();
const { pool } = require("../config/database.js");
const path = require("path");

const UPLOADS_ROOT = process.env.UPLOADS_ROOT || "../uploads";

router.get("/:filename", async (req, res) => {
  const { filename } = req.params;

  const allowedExtensions = /\.(jpeg|jpg|png|webp)$/i;
  if (!allowedExtensions.test(filename)) {
    res.status(400).json({ detail: "Invalid file type requested" });
  }

  try {
    // Check for the stored file name
    const query =
      "SELECT original_filename FROM images WHERE stored_filename = $1 LIMIT 1";
    const result = await pool.query(query, [filename]);
    if (result.rows.length === 0) {
      return res.status(404).json({ detail: "File not found in database" });
    }
    const originalFilename = result.rows[0].original_filename;
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
