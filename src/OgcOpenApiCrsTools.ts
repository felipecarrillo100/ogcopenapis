class OgcOpenApiCrsTools {
    /**
     *
     * @param uriOrName
     * @private
     */
    public static getReferenceName(uriOrNameI: string) {
        let uriOrName;
        if (typeof uriOrNameI === "undefined") {
            uriOrName = "http://www.opengis.net/def/crs/OGC/1.3/CRS84"
        } else {
            uriOrName = uriOrNameI.replace(/[<>]/g, '');
        }

        if (!uriOrName.startsWith('http')) {
            return uriOrName;
        }
        const prefix = 'http://www.opengis.net/def/crs/';
        if (uriOrName.startsWith(prefix)) {
            const cleanCRS = uriOrName.substr(prefix.length);
            const parts = cleanCRS.split('/');
            if (parts.length === 3) {
                const name = parts[0];
                const version = parts[1];
                const code = parts[2];
                switch (name) {
                    case 'EPSG':
                        return name + ':' + code;
                        break;
                    case 'OGC':
                        return 'CRS' + ':' + code.substr('CRS'.length);
                        break;
                }
            }
        }
        return uriOrName;
    }
}

export { OgcOpenApiCrsTools}