import {
    installProjectDependencies,
    buildProject,
    startAgent,
    stopAgent
} from "./testLibrary.mjs";

const DEFAULT_CHARACTER = "trump"
const DEFAULT_AGENT_ID = "e491ca64-1acf-4906-9579-65f1e2fafc6b" // Deterministically derived from character name

async function test1() {
    const proc = await startAgent();
    try {
        const reply = await send("Hi");
        assert(reply.length > 10);
    } finally {
        await stopAgent(proc);
    }
}

//await installProjectDependencies();
//await buildProject();
await test1();
