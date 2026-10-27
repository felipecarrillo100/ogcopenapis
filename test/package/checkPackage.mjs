/**
 * npm run test:package: checks the package as published, whatever tool builds lib/.
 *
 * 1. npm pack, and the files in the tarball: lib/, the sources of its source maps, README, CHANGELOG, LICENSE and package.json.
 *    Nothing of LuciadRIA: it is a peer dependency, the application provides its single copy.
 * 2. lib/ imports only its own files and @luciad/ria, with the .js extensions that native ES modules need.
 * 3. publint and Are the Types Wrong on the tarball.
 * 4. Every module loads through the exports of the package, installed in a node_modules folder, the way an
 *    application's tests load it: by Node's own ES module loader, not transformed by Vite.
 */
import {execFileSync} from "node:child_process";
import {copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
// Gitignored. node_modules/ogcopenapis in it is the package as installed, @luciad/ria resolves from the root node_modules
const CHECK = join(ROOT, ".package-check");
const INSTALLED = join(CHECK, "node_modules", "ogcopenapis");
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";
const NPX = process.platform === "win32" ? "npx.cmd" : "npx";

const failures = [];
const check = (ok, message) => {
    console.log((ok ? "  ok   " : "  FAIL ") + message);
    if (!ok) failures.push(message);
};
const run = (command, args, options = {}) => execFileSync(command, args, {cwd: ROOT, encoding: "utf8", stdio: "pipe", ...options});

rmSync(CHECK, {recursive: true, force: true});
mkdirSync(INSTALLED, {recursive: true});
// A package of its own, an application: inside the scope of ogcopenapis' package.json, "ogcopenapis/..." would
// resolve to the repository's lib/ by self-reference, instead of to the installed package
writeFileSync(join(CHECK, "package.json"), JSON.stringify({name: "package-check", private: true, type: "module"}, null, 2) + "\n");

console.log("Pack");
// npm 12 reports {name: result}, earlier versions [result]
const report = JSON.parse(run(NPM, ["pack", "--json", "--pack-destination", CHECK]));
const packed = Array.isArray(report) ? report[0] : Object.values(report)[0];
const tarball = join(CHECK, packed.filename);
const files = packed.files.map(f => f.path);
const allowed = /^(package\.json|README\.md|CHANGELOG\.md|LICENSE|lib\/[^/]+\.(js|d\.ts)(\.map)?|src\/[^/]+\.ts)$/;
check(files.every(f => allowed.test(f)), "only lib/, src/, README, CHANGELOG, LICENSE and package.json: " +
    (files.filter(f => !allowed.test(f)).join(", ") || "none other"));
check(!files.some(f => /node_modules|luciad/i.test(f)), "no node_modules and no LuciadRIA files");
check(!files.some(f => /\.test\.ts$|fixtures\//.test(f)), "no tests and no fixtures");
check(files.includes("CHANGELOG.md"), "the changelog is included");

const modules = files.filter(f => /^lib\/[^/]+\.js$/.test(f)).map(f => f.slice("lib/".length, -".js".length)).sort();
const sources = files.filter(f => /^src\/[^/]+\.ts$/.test(f)).map(f => f.slice("src/".length, -".ts".length)).sort();
check(modules.length > 0 && modules.join() === sources.join(), modules.length + " modules, one per source file");
const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
check(!manifest.dependencies || !manifest.dependencies["@luciad/ria"], "@luciad/ria is not a dependency");
check(!!manifest.peerDependencies && !!manifest.peerDependencies["@luciad/ria"], "@luciad/ria is a peer dependency: " +
    (manifest.peerDependencies ? manifest.peerDependencies["@luciad/ria"] : "missing"));

console.log("Imports of lib/");
run("tar", ["-xzf", tarball, "-C", INSTALLED, "--strip-components=1"]);
const badImports = [];
for (const module of modules) {
    const code = readFileSync(join(INSTALLED, "lib", module + ".js"), "utf8");
    for (const [, specifier] of code.matchAll(/(?:import|export)\s[^"']*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']/g)) {
        const own = /^\.\/[^/]+\.js$/.test(specifier);
        const luciad = /^@luciad\/ria\/.+\.js$/.test(specifier);
        if (!own && !luciad) badImports.push(module + ": " + specifier);
    }
}
check(badImports.length === 0, "only ./*.js and @luciad/ria/*.js imports, with extensions" +
    (badImports.length ? ": " + badImports.join(", ") : ""));

console.log("publint");
try {
    console.log(run(NPX, ["publint", "run", tarball, "--strict"]).trim().replace(/^/gm, "    "));
    check(true, "publint");
} catch (e) {
    console.log(String(e.stdout || e.message).trim().replace(/^/gm, "    "));
    check(false, "publint");
}

console.log("Are the Types Wrong");
try {
    // esm-only: LuciadRIA is an ES module package, a CommonJS require of this package cannot work and is not offered
    // node_modules/@luciad/ria is not in the tarball, so its types do not resolve here: types of the package itself are checked
    run(NPX, ["attw", tarball, "--profile", "esm-only", "--format", "table-flipped", "--no-emoji", "--no-color", "--ignore-rules", "internal-resolution-error"]);
    check(true, "attw, esm-only profile");
} catch (e) {
    console.log(String(e.stdout || e.message).trim().replace(/^/gm, "    "));
    check(false, "attw, esm-only profile");
}

console.log("Loading");
// Node's own resolution, from the application folder
const resolved = run(process.execPath, ["--input-type=module", "-e", "console.log(import.meta.resolve('ogcopenapis/OgcOpenApiFetchTools'))"], {cwd: CHECK}).trim();
check(/\/\.package-check\/node_modules\/ogcopenapis\/lib\/OgcOpenApiFetchTools\.js$/.test(resolved), "ogcopenapis/... resolves to the installed package: " + resolved);
copyFileSync(join(ROOT, "test", "package", "loadPackage.template.ts"), join(CHECK, "load.package.test.ts"));
try {
    const output = run(NPX, ["vitest", "run", "--config", "vitest.package.config.ts"], {env: {...process.env, PACKAGE_MODULES: modules.join(",")}});
    console.log(output.split("\n").filter(l => /✓|×|Tests|FAIL|Error/.test(l)).join("\n").replace(/^/gm, "    "));
    check(true, "every module loads natively through the exports");
} catch (e) {
    console.log(String(e.stdout || e.message).trim().replace(/^/gm, "    "));
    check(false, "every module loads natively through the exports");
}

if (failures.length > 0) {
    console.error("\n" + failures.length + " package check(s) failed");
    process.exit(1);
}
console.log("\nThe package is fine: " + packed.filename + ", " + files.length + " files, " + Math.round(packed.size / 1024) + " kB");
