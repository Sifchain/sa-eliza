import swaggerUi from "swagger-ui-express";
import swaggerJsDoc from "swagger-jsdoc";
import { Express } from "express";

const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "SA-ELIZA API",
            version: "1.0.0",
            description: "API documentation for SA-ELIZA",
        },
        servers: [{ url: `http://localhost:${process.env.PORT || 4000}` }],
    },
    apis: ["./src/routes/*.ts"], // Path to API routes
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

export const setupSwagger = (app: Express) => {
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));
};
