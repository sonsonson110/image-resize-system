const router = require("express").Router();
const path = require("path");

const UPLOADS_ROOT = process.env.UPLOADS_ROOT || "../uploads";

router.get("/:filename", (req, res) => {
  const { filename } = req.params;

  try {
    const filePath = path.join("thumbnails", filename);
    res.sendFile(filePath, { root: UPLOADS_ROOT }, (err) => {
      if (err) {
        console.error("File not found:", err);
        res.status(404).json({ detail: "File not found" });
      }
    });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

module.exports = router;