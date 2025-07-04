import os

RABBITMQ_HOST = os.environ.get("RABBITMQ_HOST", "localhost")
RABBITMQ_PROCESSING_QUEUE = "thumbnail_processing"
RABBITMQ_COMPLETED_QUEUE = "thumbnail_completed"

DB_CONFIG = {
    "host": os.environ.get("DB_CONFIG_HOST", "localhost"),
    "port": int(os.environ.get("DB_CONFIG_PORT", "5432")),
    "dbname": os.environ.get("DB_CONFIG_DBNAME", "image_resize_system"),
    "user": os.environ.get("DB_CONFIG_USER", "postgres"),
    "password": os.environ.get("DB_CONFIG_PASSWORD", "password")
}
