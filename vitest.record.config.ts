import {defineConfig} from "vitest/config";
import {environmentOptions} from "./vitest.config";

// npm run test:record: calls the test servers and records their responses in test/fixtures/servers
export default defineConfig({
    test: {
        ...environmentOptions,
        include: ["test/servers.live.test.ts"],
        env: {RECORD: "1"},
        testTimeout: 60000,
    },
});
