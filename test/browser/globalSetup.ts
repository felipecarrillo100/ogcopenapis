import {existsSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {createServer} from "vite";
import {chromium} from "playwright-core";
import type {TestProject} from "vitest/node";

/**
 * Starts the demo and one Chrome for all browser tests.
 * Chrome is the installed Google Chrome, or CHROME_PATH. HEADED=1 shows the browser.
 */
declare module "vitest" {
    export interface ProvidedContext {
        origin: string;
        wsEndpoint: string;
    }
}

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const LICENSE = ROOT + "demo/license/luciadria_development.txt";

export default async function setup(project: TestProject) {
    if (!existsSync(LICENSE)) {
        throw new Error("The browser tests run the demo, which needs a LuciadRIA license in " + LICENSE + ", see demo/license/readme.txt");
    }
    const server = await createServer({configFile: ROOT + "demo/vite.config.ts", server: {port: 5181}, logLevel: "warn"});
    await server.listen();
    const origin = server.resolvedUrls.local[0];

    const browserServer = await chromium.launchServer({
        ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {channel: "chrome"}),
        headless: process.env.HEADED !== "1",
        // LuciadRIA 2026.1 renders with WebGPU
        args: ["--enable-unsafe-webgpu"],
    });
    project.provide("origin", origin);
    project.provide("wsEndpoint", browserServer.wsEndpoint());

    return async () => {
        await browserServer.close();
        await server.close();
    };
}
