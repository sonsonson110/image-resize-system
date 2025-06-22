const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const connectDB = async () => {
  try {
    const client = await pool.connect();
    console.log("✅ Database connected successfully");

    console.log("🔄 Checking and creating database tables...");

    // Execute SQL statements
    await client.query(`
      CREATE TABLE IF NOT EXISTS images (
        id SERIAL PRIMARY KEY,
        
        -- File information
        original_filename VARCHAR(255) NOT NULL,
        stored_filename VARCHAR(255) NOT NULL UNIQUE,  -- UUID-based filename
        file_size INTEGER NOT NULL,                    -- Original file size in bytes
        mime_type VARCHAR(50) NOT NULL,                -- image/jpeg, image/png, etc.
        
        -- Processing status
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        error_message TEXT,                            -- Store error details if processing fails
        
        -- Thumbnail information (populated after processing)
        thumbnail_filename VARCHAR(255),               -- Generated thumbnail filename
        thumbnail_size INTEGER,                        -- Thumbnail size in bytes
        
        -- Timestamps
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processing_started_at TIMESTAMP,
        completed_at TIMESTAMP,
        
        -- Constraints
        CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
    );

    CREATE INDEX IF NOT EXISTS idx_images_stored_filename ON images(stored_filename);
`);

    // Test the connection
    const result = await client.query("SELECT NOW()");
    console.log("🕐 Database time:", result.rows[0].now);

    client.release();
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    return false;
  }
};

process.on("SIGINT", async () => {
  console.log("🔄 Closing database connections...");
  pool.end(() => {
    console.log("✅ Database connections closed");
    process.exit(0);
  });
});

module.exports = { connectDB, pool };
