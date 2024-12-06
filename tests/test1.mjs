import {
    installProjectDependencies,
    buildProject
} from "./testLibrary.mjs";


async function test1() {
    await installProjectDependencies();
    await buildProject();
    const proc = await startAgent();
    const reply = await send("Hi");
    await stopAgent(proc);
}

await test1();
