import { useState } from "react";

export const use = () => {
    const [uniqueRuns, setUniqueRuns] = useState<string[]>([]);
    const [traceData, setTraceData] = useState<any[]>([]);
    const [selectedRun, setSelectedRun] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isRun, setIsRun] = useState<boolean>(false);

    // Fetch all unique runs
    const fetchUniqueRuns = async () => {
        setLoading(true);
        try {
            const response = await fetch(
                "http://localhost:4000/api/traces/unique-runs"
            );
            if (!response.ok)
                throw new Error(`HTTP error! Status: ${response.status}`);
            const data = await response.json();
            setUniqueRuns(data.unique_runs || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Fetch traces for a selected RUN ID with filters
    const fetchTraceData = async (
        runId: string | null,
        filters: any,
        page = 1
    ) => {
        if (!runId) return;

        setLoading(true);
        setSelectedRun(runId);
        try {
            const queryParams = new URLSearchParams({
                page: page.toString(),
                ...(filters.name && { name: filters.name }),
                ...(filters.start_date && { start_date: filters.start_date }),
                ...(filters.end_date && { end_date: filters.end_date }),
            });

            const response = await fetch(
                `http://localhost:4000/api/traces/by-run/${runId}?${queryParams.toString()}`
            );
            if (!response.ok)
                throw new Error(`HTTP error! Status: ${response.status}`);
            const data = await response.json();
            setTraceData(data.data || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return {
        uniqueRuns,
        traceData,
        selectedRun,
        loading,
        error,
        fetchUniqueRuns,
        fetchTraceData,
        isRun,
        setIsRun,
    };
};
