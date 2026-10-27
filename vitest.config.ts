import {defineConfig} from "vitest/config";

export default defineConfig({
    test: {
        environment: "jsdom",
        setupFiles: ["vitest-canvas-mock"],
        include: ["src/**/*.test.ts"],
        // Some tests call public servers
        testTimeout: 20000,
    },
});
