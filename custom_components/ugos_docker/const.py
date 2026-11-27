"""Constants for UGREEN Docker."""
from datetime import timedelta

DOMAIN = "ugos_docker"
NAME = "UGREEN Docker"
DEFAULT_PORT_HTTP = 9999
DEFAULT_PORT_HTTPS = 9443
DEFAULT_SCAN_INTERVAL = 300
MIN_SCAN_INTERVAL = 30
CONF_HOST = "host"
CONF_PORT = "port"
CONF_USERNAME = "username"
CONF_PASSWORD = "password"
CONF_USE_SSL = "use_ssl"
CONF_VERIFY_SSL = "verify_ssl"
CONF_SCAN_INTERVAL = "scan_interval"
PLATFORMS = ("sensor", "binary_sensor")
UPDATE_INTERVAL = timedelta(seconds=DEFAULT_SCAN_INTERVAL)
