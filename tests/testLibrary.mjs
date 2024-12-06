import { spawn } from "child_process";
import { isShorthandPropertyAssignment } from "typescript";

function projectRoot() {
    return ".."; // TODO use relative path
}

function runProcess(args, directory) {
    const command = args[0];
    const cmdargs = args.slice(1);
    if (directory === undefined) directory = projectRoot();

    const capture = true;

    return new Promise((resolve, reject) => {
        const process = spawn(command, cmdargs, {cwd: directory, shell: true, "stdio": "inherit"});
        let stdout = "";
        let stderr = "";
        if (capture) {
            process.stdout.on("data", (data) => { stdout += data.toString(); });
            process.stderr.on("data", (data) => { stderr += data.toString(); });
        }
        process.on("close", (code) => {
            if (code === 0) {
                resolve(stdout.trim());
            } else {
                reject(new Error(`Command failed with exit code ${code}: ${stderr.trim()}`));
            }
        });
        process.on("error", (err) => {
            reject(new Error(`Failed to start process: ${err.message}`));
        });
    });
}

async function installProjectDependencies() {
    return await runProcess(["pnpm", "install", "-r"]);
}

async function buildProject() {
    return await runProcess(["pnpm", "build"]);
}

async function writeEnvFile(entries) {
    // TODO
}

async function startAgent(character) {
    // TODO pnpm start --character=characters/${character}.character.json
}

async function send(message) {
    // TODO
    // curl -s -X POST http://127.0.0.1:3000/e491ca64-1acf-4906-9579-65f1e2fafc6b/message -H "Content-Type: application/json" -d '{"text": "exit", "userId": "user", "userName": "User"}' | jq -r '.[0].text'
}

export {
    projectRoot,
    runProcess,
    installProjectDependencies,
    buildProject,
    writeEnvFile,
    startAgent
}
