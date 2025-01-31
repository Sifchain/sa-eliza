import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const db = new Pool({
    connectionString:
        process.env.POSTGRES_URL ||
        "postgresql://softwareengineer-frontend@localhost:5432/mydb",
});

db.connect()
    .then(() => console.log("✅ Connected to PostgreSQL"))
    .catch((err) => console.error("❌ PostgreSQL Connection Error:", err));
