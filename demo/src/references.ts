import {addReference, isValidReferenceIdentifier, parseWellKnownText} from "@luciad/ria/reference/ReferenceProvider.js";

/**
 * References that LuciadRIA does not know by default, used by the tile matrix sets of the test servers (PDOK).
 * Applications register the references of their servers in the same way. WKT from https://epsg.io.
 */
const REFERENCES: { [identifier: string]: string } = {
    // Amersfoort / RD New, NetherlandsRDNewQuad
    "EPSG:28992": 'PROJCS["RD",GEOGCS["Amersfoort",DATUM["Amersfoort",SPHEROID["Bessel 1841",6377397.155,299.1528128],' +
        'TOWGS84[565.4171,50.3319,465.5524,1.9342,-1.6677,9.1019,4.0725]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],' +
        'UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4289"]],PROJECTION["Oblique_Stereographic"],' +
        'PARAMETER["latitude_of_origin",52.1561605555556],PARAMETER["central_meridian",5.38763888888889],PARAMETER["scale_factor",0.9999079],' +
        'PARAMETER["false_easting",155000],PARAMETER["false_northing",463000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],' +
        'AXIS["Easting",EAST],AXIS["Northing",NORTH],AUTHORITY["EPSG","28992"]]',
    // ETRS89-extended / LAEA Europe, EuropeanETRS89_LAEAQuad
    "EPSG:3035": 'PROJCS["ETRS89-extended / LAEA Europe",GEOGCS["ETRS89",DATUM["European_Terrestrial_Reference_System_1989",' +
        'SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],TOWGS84[0,0,0,0,0,0,0],AUTHORITY["EPSG","6258"]],' +
        'PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],' +
        'AUTHORITY["EPSG","4258"]],PROJECTION["Lambert_Azimuthal_Equal_Area"],PARAMETER["latitude_of_center",52],' +
        'PARAMETER["longitude_of_center",10],PARAMETER["false_easting",4321000],PARAMETER["false_northing",3210000],' +
        'UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","3035"]]',
};

export function registerReferences() {
    for (const identifier of Object.keys(REFERENCES)) {
        if (!isValidReferenceIdentifier(identifier)) addReference(parseWellKnownText(REFERENCES[identifier]), identifier);
    }
}
