import {configDefaults, defineConfig} from "vitest/config";

// Shared by vitest.live.config.ts
export const environmentOptions = {
    environment: "jsdom" as const,
    setupFiles: ["vitest-canvas-mock"],
};

// npm run test: offline tests only. Tests that call public servers are *.live.test.ts, see vitest.live.config.ts
export default defineConfig({
    test: {
        ...environmentOptions,
        include: ["src/**/*.test.ts", "test/**/*.test.ts"],
        exclude: [...configDefaults.exclude, "**/*.live.test.ts"],
    },
});
