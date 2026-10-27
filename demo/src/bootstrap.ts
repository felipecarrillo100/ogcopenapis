// setLicenseText must run before any LuciadRIA module that needs a license is evaluated. A static import of
// main.ts would evaluate WebGLMap first, so the app is loaded with a dynamic import after the license is set.
import {setLicenseText} from "@luciad/ria/util/License.js";
import licenseText from "../license/luciadria_development.txt?raw";

setLicenseText(licenseText);

void import("./main");
