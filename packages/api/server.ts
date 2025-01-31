import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import tracesRoutes from "./src/routes/tracesRoutes";
import { setupSwagger } from "./src/config/swagger";

dotenv.config();

// Initialize Express App
const app = express();
app.use(express.json());
app.use(cors());

// Setup Routes
app.use("/api/traces", tracesRoutes);

// Setup Swagger
setupSwagger(app);

// Start Server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`✅ Server running on ${process.env.BASE_URL}:${PORT}`);
    console.log(
        `📄 Swagger is available at ${process.env.BASE_URL}:${PORT}/api-docs`
    );
});
