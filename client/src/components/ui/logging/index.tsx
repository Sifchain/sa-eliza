import { useEffect, useState } from "react";
import { Label } from "../label";
import { use } from "./hooks";

function Logs() {
    const {
        uniqueRuns,
        traceData,
        selectedRun,
        loading,
        error,
        fetchUniqueRuns,
        fetchTraceData,
        isRun,
        setIsRun,
    } = use();

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split("T")[0];

    // State for filters (default start_date and end_date to today)
    const [filters, setFilters] = useState({
        name: "",
        start_date: today,
        end_date: today,
    });

    useEffect(() => {
        fetchUniqueRuns();
    }, []);

    return (
        <div className="flex flex-col p-6 h-[100vh]">
            {/* Filter Section at the Top */}
            <div className="p-4 rounded-lg bg-[#161616] shadow-lg sticky top-0">
                <Label className="text-white text-lg font-semibold">
                    Filters
                </Label>
                <div className="grid grid-cols-4 gap-4 mt-2">
                    <input
                        type="text"
                        placeholder="Name"
                        className="p-2 rounded-lg bg-gray-800 text-white border border-gray-600"
                        value={filters.name}
                        onChange={(e) =>
                            setFilters({ ...filters, name: e.target.value })
                        }
                    />
                    <input
                        type="date"
                        className="p-2 rounded-lg bg-gray-800 text-white border border-gray-600"
                        value={filters.start_date}
                        onChange={(e) =>
                            setFilters({
                                ...filters,
                                start_date: e.target.value,
                            })
                        }
                    />
                    <input
                        type="date"
                        className="p-2 rounded-lg bg-gray-800 text-white border border-gray-600"
                        value={filters.end_date}
                        onChange={(e) =>
                            setFilters({ ...filters, end_date: e.target.value })
                        }
                    />
                    <button
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition"
                        onClick={() => fetchTraceData(selectedRun, filters)}
                    >
                        Apply Filters
                    </button>
                </div>
            </div>

            <div className="flex flex-grow h-full overflow-hidden mt-4">
                {/* Left: Unique Runs List (Scrollable) */}
                <div className="w-1/3 p-4 rounded-lg shadow-lg overflow-y-auto h-full">
                    <Label className="text-xl font-semibold text-white">
                        Unique Runs
                    </Label>

                    {loading && (
                        <div className="flex justify-center items-center mt-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 p-3 bg-red-500 text-white text-sm rounded-lg">
                            ❌ Error: {error}
                        </div>
                    )}

                    <div className="mt-4 grid grid-cols-1 gap-4 text-xs">
                        {uniqueRuns.map((run, index) => (
                            <div
                                key={index}
                                onClick={() => {
                                    setIsRun(true);
                                    fetchTraceData(run, filters);
                                }}
                                className={`p-4 bg-gray-800 rounded-lg shadow-md hover:shadow-xl transition duration-300 cursor-pointer ${
                                    selectedRun === run
                                        ? "border-2 border-blue-500"
                                        : ""
                                }`}
                            >
                                <p className="text-white font-medium">{run}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Trace Details (Scrollable) */}
                {isRun && (
                    <div className="w-2/3 p-4 rounded-lg shadow-lg overflow-y-auto h-full">
                        <Label className="text-xl font-semibold text-white">
                            {selectedRun
                                ? `Traces for: ${selectedRun}`
                                : "Select a Run"}
                        </Label>

                        {loading && (
                            <p className="mt-4 text-white">Loading traces...</p>
                        )}

                        {traceData.length > 0 ? (
                            <ul className="mt-4 space-y-4">
                                {traceData.map((trace, index) => (
                                    <li
                                        key={index}
                                        className="p-4 bg-gray-700 rounded-lg shadow-md"
                                    >
                                        <p className="text-gray-300 font-semibold">
                                            ID:{" "}
                                            <span className="text-white">
                                                {trace.id}
                                            </span>
                                        </p>
                                        <p className="text-gray-300 font-semibold">
                                            Run:{" "}
                                            <span className="text-white">
                                                {trace.run}
                                            </span>
                                        </p>
                                        <p className="text-gray-300 font-semibold">
                                            Time:{" "}
                                            <span className="text-white">
                                                {trace.time}
                                            </span>
                                        </p>
                                        <p className="text-gray-300 font-semibold">
                                            Name:{" "}
                                            <span className="text-white">
                                                {trace.name}
                                            </span>
                                        </p>
                                        <p className="text-gray-300 font-semibold">
                                            Data:
                                        </p>
                                        <pre className="text-white bg-gray-900 p-2 rounded-md overflow-x-auto text-sm">
                                            {JSON.stringify(
                                                trace.data,
                                                null,
                                                2
                                            )}
                                        </pre>
                                    </li>
                                ))}
                            </ul>
                        ) : selectedRun && !loading ? (
                            <p className="mt-4 text-gray-400">
                                No trace data available.
                            </p>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Logs;
