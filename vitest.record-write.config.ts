import {defineConfig} from "vitest/config";
import {environmentOptions} from "./vitest.config";

// npm run test:record-write: runs the write scenario on the write test servers (test/servers/write/up.sh first) and
// records their responses in test/fixtures/write
export default defineConfig({
    test: {
        ...environmentOptions,
        include: ["test/write.write.live.test.ts"],
        testNamePattern: "Write scenario, recorded",
        env: {RECORD: "1"},
        testTimeout: 30000,
        fileParallelism: false,
    },
});
