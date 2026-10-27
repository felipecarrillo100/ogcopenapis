import {defineConfig} from "vitest/config";
import {environmentOptions} from "./vitest.config";

// npm run test:live: the tests that call public servers, they fail when a server changes or is down
export default defineConfig({
    test: {
        ...environmentOptions,
        include: ["src/**/*.live.test.ts"],
        testTimeout: 20000,
    },
});
