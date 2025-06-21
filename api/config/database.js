const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

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

    // Read SQL schema from file
    const sqlPath = path.join(__dirname, "../../database.sql");
    const sqlSchema = fs.readFileSync(sqlPath, "utf8");

    // Execute SQL statements
    await client.query(sqlSchema);

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
