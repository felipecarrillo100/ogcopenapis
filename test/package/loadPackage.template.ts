import {describe, expect, it} from "vitest";

/**
 * Copied to .package-check/ by checkPackage.mjs, next to node_modules/ogcopenapis, the package as installed.
 * Vitest leaves node_modules to Node's own ES module loader, so this loads the package as an application's tests do:
 * through its exports, with real ES module resolution of its imports and of @luciad/ria.
 */
const MODULES = (process.env.PACKAGE_MODULES || "").split(",").filter(m => m);

describe("The package as installed", () => {

    it("has modules to load", () => {
        expect(MODULES.length).toBeGreaterThan(0);
    });

    for (const module of MODULES) {
        it(`ogcopenapis/${module} and ogcopenapis/lib/${module}`, async () => {
            const exported = await import(/* @vite-ignore */ "ogcopenapis/" + module);
            expect(Object.keys(exported)).toContain(module);
            // The import path of 0.0.12, lib/ included, still resolves to the same module
            expect(await import(/* @vite-ignore */ "ogcopenapis/lib/" + module)).toBe(exported);
        });
    }
});
