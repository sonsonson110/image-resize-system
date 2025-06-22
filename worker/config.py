import os

RABBITMQ_HOST = os.environ.get("RABBITMQ_HOST", "localhost")
RABBITMQ_QUEUE = "thumbnail_processing"

DB_CONFIG = {
    "host": os.environ.get("DB_CONFIG_HOST", "localhost"),
    "port": int(os.environ.get("DB_CONFIG_PORT", "5432")),
    "dbname": os.environ.get("DB_CONFIG_DBNAME", "image_resize_system"),
    "user": os.environ.get("DB_CONFIG_USER", "postgres"),
    "password": os.environ.get("DB_CONFIG_PASSWORD", "password")
}
