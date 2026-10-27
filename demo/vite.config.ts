import {fileURLToPath} from "node:url";
import {defineConfig} from "vite";

const librarySrc = fileURLToPath(new URL("../src", import.meta.url));

// The demo uses the library from ../src, so edits to the library show up without a build,
// and the single @luciad/ria in the root node_modules is shared by both.
export default defineConfig({
    root: fileURLToPath(new URL(".", import.meta.url)),
    resolve: {
        alias: {ogcopenapis: librarySrc},
    },
    server: {
        port: 5180,
        fs: {allow: [fileURLToPath(new URL("..", import.meta.url))]},
    },
});
