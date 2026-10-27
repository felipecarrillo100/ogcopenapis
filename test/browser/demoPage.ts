import {Browser, chromium, Page} from "playwright-core";
import {inject} from "vitest";

/**
 * Drives the demo the way a user does, and measures what the map paints.
 */
export type DemoType = "items" | "map" | "tiles" | "vectorTiles";

// The map background of the demo, #1c2430 in demo/src/style.css
const BACKGROUND = [28, 36, 48];
const QUIET_PERIOD = 2000;
const LOAD_TIMEOUT = 45000;

let browser: Browser | null = null;

export async function openDemo(dataHost: string) {
    if (!browser) browser = await chromium.connect(inject("wsEndpoint"));
    const page = await browser.newPage({viewport: {width: 1280, height: 800}});
    return new DemoPage(page, dataHost);
}

export class DemoPage {
    readonly pageErrors: string[] = [];
    // Responses of the data server that failed. 404 is not a failure: servers answer it for tiles without data
    readonly failedResponses: string[] = [];
    private pending = 0;
    private lastActivity = Date.now();

    constructor(private page: Page, dataHost: string) {
        page.on("pageerror", e => this.pageErrors.push(e.message));
        const isData = (url: string) => new URL(url).host === dataHost;
        page.on("request", r => {
            if (!isData(r.url())) return;
            this.pending++;
            this.lastActivity = Date.now();
        });
        const done = () => {
            this.pending = Math.max(0, this.pending - 1);
            this.lastActivity = Date.now();
        };
        page.on("requestfinished", r => isData(r.url()) && done());
        page.on("requestfailed", r => {
            if (!isData(r.url())) return;
            done();
            // Requests that LuciadRIA aborts, for instance after zooming, are not failures
            if (r.failure()?.errorText !== "net::ERR_ABORTED") this.failedResponses.push(r.failure()?.errorText + " " + r.url());
        });
        page.on("response", r => {
            if (isData(r.url()) && r.status() >= 400 && r.status() !== 404) this.failedResponses.push(r.status() + " " + r.url());
        });
    }

    async load() {
        await this.page.goto(inject("origin"), {waitUntil: "load"});
        // The demo fills the server presets and attaches its handlers in one go at the end of main.ts:
        // window.map exists earlier, and a URL typed before then is reset to the first preset
        await this.page.waitForFunction(() => document.querySelectorAll("#preset option").length > 0);
    }

    status() {
        return this.page.textContent("#status");
    }

    async connect(url: string, type: DemoType) {
        await this.page.fill("#url", url);
        // Changing the type connects, only connect explicitly when it does not change
        if (await this.page.inputValue("#type") === type) {
            await this.page.click("#connect");
        } else {
            await this.page.selectOption("#type", type);
        }
        await this.page.waitForFunction(() =>
                /Could not/.test(document.querySelector("#status").textContent) ||
                /collections/.test(document.querySelector("#status").textContent) && !(document.querySelector("#collection") as HTMLSelectElement).disabled,
            null, {timeout: LOAD_TIMEOUT});
    }

    async addLayer(collection: string, options: { tileMatrixSet?: string, style?: string, collections?: string[] } = {}) {
        await this.page.selectOption("#collection", collection);
        if (options.collections) {
            // Offered only when the server supports collections selection
            await this.page.waitForSelector("#collectionsRow:not([hidden])", {timeout: LOAD_TIMEOUT});
            await this.page.selectOption("#collections", options.collections);
        }
        if (options.tileMatrixSet) {
            // The tile matrix sets of the collection load after it is selected. An option is a tileset, by its self link
            const option = await this.page.waitForSelector(`#tms option[data-tile-matrix-set="${options.tileMatrixSet}"]`, {state: "attached", timeout: LOAD_TIMEOUT});
            await this.page.selectOption("#tms", await option.getAttribute("value"));
        }
        if (options.style) {
            // The styles of the collection load after it is selected
            await this.page.waitForSelector(`#style option[value="${options.style}"]`, {state: "attached", timeout: LOAD_TIMEOUT});
            await this.page.selectOption("#style", options.style);
        }
        // Adding is possible once the tile matrix sets and styles of the collection are listed
        await this.page.waitForSelector("#add:not([disabled])", {timeout: LOAD_TIMEOUT});
        await this.page.click("#add");
        await this.page.waitForFunction(() => /Added|Could not/.test(document.querySelector("#status").textContent), null, {timeout: LOAD_TIMEOUT});
    }

    // Waits until the data server had no requests for QUIET_PERIOD, after the map zoomed to the layer
    async waitForData() {
        const start = Date.now();
        while (Date.now() - start < LOAD_TIMEOUT) {
            if (this.pending === 0 && Date.now() - this.lastActivity > QUIET_PERIOD) break;
            await this.page.waitForTimeout(250);
        }
        // Painting follows the last response
        await this.page.waitForTimeout(1000);
    }

    // Fits the map to a square of size degrees around center, [lon, lat], and waits for it to settle
    async zoomTo(center: number[], size: number) {
        await this.page.evaluate(([lon, lat, s]) => (window as any).demo.zoomTo(lon, lat, s), [center[0], center[1], size]);
        await this.page.waitForTimeout(500);
    }

    async hideBasemap() {
        await this.page.evaluate(() => {
            const map = (window as any).map;
            map.layerTree.children.filter(l => l.label === "OpenStreetMap").forEach(l => l.visible = false);
        });
    }

    // The number of map pixels that differ from the background, the overlays on the map are hidden
    async countPaintedPixels() {
        await this.page.addStyleTag({content: "#layerControl, #attribution { visibility: hidden; }"});
        const png = await this.page.locator("#map").screenshot();
        return this.page.evaluate(async ([base64, background]) => {
            const image = new Image();
            image.src = "data:image/png;base64," + base64;
            await image.decode();
            const canvas = document.createElement("canvas");
            canvas.width = image.width;
            canvas.height = image.height;
            const context = canvas.getContext("2d");
            context.drawImage(image, 0, 0);
            const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
            let painted = 0;
            for (let i = 0; i < data.length; i += 4) {
                const difference = Math.abs(data[i] - background[0]) + Math.abs(data[i + 1] - background[1]) + Math.abs(data[i + 2] - background[2]);
                if (difference > 30) painted++;
            }
            return painted;
        }, [png.toString("base64"), BACKGROUND] as const);
    }

    async screenshot(path: string) {
        await this.page.screenshot({path});
    }

    close() {
        return this.page.close();
    }
}
