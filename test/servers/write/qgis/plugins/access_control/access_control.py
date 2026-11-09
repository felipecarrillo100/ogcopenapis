"""Spike access-control server plugin.

Rule set (user name comes from the FCGI param REMOTE_USER set by nginx
after HTTP Basic auth; anonymous = empty):
  - everybody may read every layer
  - only 'editor' may insert/update/delete, and only on 'cities' and 'towns_3857'
    (the project's own WFS-T settings additionally restrict what is writable)
"""
from qgis.core import QgsMessageLog, Qgis
from qgis.server import QgsAccessControlFilter

WRITERS = {"editor"}
WRITABLE_LAYERS = {"cities", "towns_3857"}


class SpikeAccessFilter(QgsAccessControlFilter):
    def __init__(self, server_iface):
        super().__init__(server_iface)
        self.iface = server_iface

    def _user(self):
        try:
            return self.iface.getEnv("REMOTE_USER") or ""
        except Exception:  # pragma: no cover
            return ""

    def layerPermissions(self, layer):
        user = self._user()
        p = QgsAccessControlFilter.LayerPermissions()
        p.canRead = True
        can_write = user in WRITERS and layer.name() in WRITABLE_LAYERS
        p.canInsert = p.canUpdate = p.canDelete = can_write
        QgsMessageLog.logMessage(
            f"layerPermissions user={user!r} layer={layer.name()!r} write={can_write}",
            "spike-acl", Qgis.MessageLevel.Info)
        return p

    def cacheKey(self):
        return self._user()


class SpikeAccessControl:
    def __init__(self, server_iface):
        server_iface.registerAccessControl(SpikeAccessFilter(server_iface), 100)
        QgsMessageLog.logMessage("spike access control registered", "spike-acl", Qgis.MessageLevel.Info)
