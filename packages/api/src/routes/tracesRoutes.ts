import express from "express";
import {
    getUniqueRuns,
    getAllTraces,
    getTracesByRun,
} from "../controllers/tracesController";

const router = express.Router();

/**
 * @swagger
 * /api/traces:
 *   get:
 *     summary: Fetch all traces
 *     description: Retrieves all traces from the database.
 *     responses:
 *       200:
 *         description: A JSON array of traces.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_records:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Server error
 */
router.get("/", getAllTraces);

/**
 * @swagger
 * /api/traces/unique-runs:
 *   get:
 *     summary: Fetch all unique RUN values
 *     description: Retrieves a list of all unique RUN values from the traces table.
 *     responses:
 *       200:
 *         description: A JSON array of unique RUN values.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 unique_runs:
 *                   type: array
 *                   items:
 *                     type: string
 *       500:
 *         description: Server error
 */
router.get("/unique-runs", getUniqueRuns);

/**
 * @swagger
 * /api/traces/by-run/{runId}:
 *   get:
 *     summary: Fetch traces by RUN value
 *     description: Retrieves traces filtered by a specific RUN ID.
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *         description: The RUN value to filter traces.
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter by name field (optional)
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by start timestamp (YYYY-MM-DD HH:MM:SS) (optional)
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by end timestamp (YYYY-MM-DD HH:MM:SS) (optional)
 *     responses:
 *       200:
 *         description: A JSON array of traces for the specified RUN ID.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 run_id:
 *                   type: string
 *                 total_records:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         description: Unique ID of the trace
 *                       run:
 *                         type: string
 *                         description: UUID of the RUN
 *                       time:
 *                         type: string
 *                         format: date-time
 *                         description: Timestamp of the trace event
 *                       name:
 *                         type: string
 *                         description: Name of the trace event
 *                       data:
 *                         type: object
 *                         description: JSON data associated with the trace event
 *       400:
 *         description: Missing or invalid RUN ID
 *       500:
 *         description: Server error
 */
router.get("/by-run/:runId", getTracesByRun);

export default router;
