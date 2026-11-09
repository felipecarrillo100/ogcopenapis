def serverClassFactory(serverIface):
    from .access_control import SpikeAccessControl
    return SpikeAccessControl(serverIface)
