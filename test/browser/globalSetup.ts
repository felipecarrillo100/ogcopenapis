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
    await warmUp(browserServer.wsEndpoint(), origin);
    project.provide("origin", origin);
    project.provide("wsEndpoint", browserServer.wsEndpoint());

    return async () => {
        await browserServer.close();
        await server.close();
    };
}

// With a cold dependency cache, Vite discovers the dependencies of the demo while the first page loads, optimizes them
// and reloads the page: that first load fails with "Failed to fetch dynamically imported module". The demo is loaded
// until it has started, and no reload followed for QUIET_PERIOD, before the tests run.
const WARM_UP_TIMEOUT = 120000;
const QUIET_PERIOD = 3000;

async function warmUp(wsEndpoint: string, origin: string) {
    const browser = await chromium.connect(wsEndpoint);
    try {
        const page = await browser.newPage();
        let lastNavigation = Date.now();
        page.on("framenavigated", frame => {
            if (frame === page.mainFrame()) lastNavigation = Date.now();
        });
        const start = Date.now();
        await page.goto(origin, {waitUntil: "load"});
        while (Date.now() - start < WARM_UP_TIMEOUT) {
            const started = await page.evaluate(() => !!(window as any).map && document.querySelectorAll("#preset option").length > 0)
                .catch(() => false);
            if (started && Date.now() - lastNavigation > QUIET_PERIOD) return;
            await page.waitForTimeout(250);
        }
        throw new Error("The demo did not start within " + WARM_UP_TIMEOUT / 1000 + " seconds at " + origin);
    } finally {
        await browser.close();
    }
}
