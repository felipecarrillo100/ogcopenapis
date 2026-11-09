import {defineConfig} from "vitest/config";
import {environmentOptions} from "./vitest.config";

// npm run test:live-write: the tests that write to the local write test servers (test/servers/write/up.sh first).
// Manual: they need the containers, they do not run in CI
export default defineConfig({
    test: {
        ...environmentOptions,
        include: ["test/**/*.write.live.test.ts"],
        // The containers run emulated (amd64) on Apple Silicon
        testTimeout: 30000,
        fileParallelism: false,
    },
});
