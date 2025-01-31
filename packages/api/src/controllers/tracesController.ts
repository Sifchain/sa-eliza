import { Request, Response } from "express";
import { db } from "../config/db";

/**
 * Get all unique RUN values
 */
export const getUniqueRuns = async (req: Request, res: Response) => {
    try {
        const result = await db.query("SELECT DISTINCT RUN FROM traces");
        res.status(200).json({
            unique_runs: result.rows.map((row) => row.run),
        });
    } catch (error: any) {
        console.error("❌ Error fetching unique RUN values:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

/**
 * Get all traces
 */
export const getAllTraces = async (req: Request, res: Response) => {
    try {
        const data = await db.query("SELECT * FROM traces ORDER BY id");
        res.status(200).json({ total_records: data.rowCount, data: data.rows });
    } catch (error: any) {
        console.error("❌ Error fetching traces:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

/**
 * Get traces by RUN ID with filters & pagination
 */

export const getTracesByRun = async (req: Request, res: Response) => {
    try {
        const { runId } = req.params;
        if (!runId) {
            return res
                .status(400)
                .json({ message: "Missing or invalid RUN ID" });
        }

        const { name, start_date, end_date, page, limit } = req.query;

        let query = "SELECT * FROM traces WHERE run = $1";
        const queryParams: any[] = [runId];

        let paramIndex = 2; // Next index for query placeholders ($2, $3, ...)

        // Optional Filters
        if (name) {
            query += ` AND name ILIKE $${paramIndex}`;
            queryParams.push(`%${name}%`);
            paramIndex++;
        }

        if (start_date && end_date) {
            query += ` AND DATE(time) BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
            queryParams.push(start_date, end_date);
            paramIndex += 2;
        }

        query += " ORDER BY id";

        // Pagination
        const pageNumber = page ? parseInt(page as string, 10) : 1;
        const pageSize = limit ? parseInt(limit as string, 10) : 20;
        const offset = (pageNumber - 1) * pageSize;

        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        queryParams.push(pageSize, offset);

        const result = await db.query(query, queryParams);

        res.status(200).json({
            run_id: runId,
            total_records: result.rowCount ?? 0, // Ensure it always returns a number
            current_page: pageNumber,
            total_pages: Math.ceil((result.rowCount ?? 0) / pageSize),
            data: result.rows,
        });
    } catch (error: any) {
        console.error("❌ Error fetching traces by RUN:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};
