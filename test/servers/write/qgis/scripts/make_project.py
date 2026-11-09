"""Generate project/spike/spike.qgs with PyQGIS (run inside the qgis-server image).

cities, towns_3857 : published in WFS/OAPIF, WFS-T Update+Insert+Delete enabled
parcels : published in WFS/OAPIF, no WFS-T capabilities
"""
import sys
from qgis.core import QgsApplication, QgsProject, QgsVectorLayer, QgsDataSourceUri, QgsWkbTypes

out = sys.argv[1]
app = QgsApplication([], False)
app.initQgis()
proj = QgsProject.instance()
proj.setTitle("QGIS write spike")

layers = {}
for table, geomtype, srid in (("cities", "Point", "4326"), ("parcels", "Polygon", "4326"), ("towns_3857", "Point", "3857")):
    uri = QgsDataSourceUri()
    uri.setConnection("postgis", "5432", "gis", "gis", "gis")
    uri.setDataSource("public", table, "geom", "", "id")
    uri.setSrid(srid)
    uri.setWkbType(QgsWkbTypes.Type.Point if geomtype == "Point" else QgsWkbTypes.Type.Polygon)
    lyr = QgsVectorLayer(uri.uri(False), table, "postgres")
    assert lyr.isValid(), f"layer {table} invalid: {lyr.error().summary()}"
    print(table, "provider capabilities:", lyr.dataProvider().capabilitiesString())
    proj.addMapLayer(lyr)
    layers[table] = lyr

ids = [l.id() for l in layers.values()]
proj.writeEntry("WFSLayers", "/", ids)
for lid in ids:
    proj.writeEntry("WFSLayersPrecision", "/" + lid, 6)
editable = [layers["cities"].id(), layers["towns_3857"].id()]
proj.writeEntry("WFSTLayers", "Update", editable)
proj.writeEntry("WFSTLayers", "Insert", editable)
proj.writeEntry("WFSTLayers", "Delete", editable)
proj.writeEntry("WMSServiceCapabilities", "/", True)
proj.writeEntry("WMSServiceTitle", "/", "QGIS write spike")
proj.writeEntryBool("WMSExtent", "/", False)
proj.writeEntry("WMSCrsList", "/", ["EPSG:4326", "EPSG:3857"])
ok = proj.write(out)
print("written", out, ok)
app.exitQgis()
