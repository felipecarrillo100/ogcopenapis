import {defineConfig} from "vitest/config";

// npm run test:browser: runs the demo in Chrome and checks that each test server's layers paint.
// Needs the LuciadRIA license in demo/license and Google Chrome (or CHROME_PATH), HEADED=1 shows the browser.
export default defineConfig({
    test: {
        environment: "node",
        include: ["test/browser/**/*.browser.test.ts"],
        globalSetup: ["test/browser/globalSetup.ts"],
        // One browser and one demo for all tests
        fileParallelism: false,
        testTimeout: 120000,
        hookTimeout: 120000,
    },
});
