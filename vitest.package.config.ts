import {defineConfig} from "vitest/config";
import {environmentOptions} from "./vitest.config";

// npm run test:package runs this on .package-check/, see test/package/checkPackage.mjs
export default defineConfig({
    test: {
        ...environmentOptions,
        include: [".package-check/*.package.test.ts"],
        server: {
            deps: {
                // Never transformed by Vite: loaded by Node, as a dependency of an application is
                external: [/[\\/]node_modules[\\/]ogcopenapis[\\/]/, /[\\/]node_modules[\\/]@luciad[\\/]ria[\\/]/],
            },
        },
    },
});
