import pika
import json
from loguru import logger
from config import RABBITMQ_HOST, RABBITMQ_QUEUE
from image_processor import generate_thumbnail
from db import get_connection
from datetime import datetime


# message = {
#   imageId,
#   originalPath,
#   originalFilename
#   thumbnailPath,
#   thumbnailFilename,
# }

def callback(ch, method, properties, body):
    """Callback function to process messages from RabbitMQ"""
    message = json.loads(body)

    image_id = message['imageId']
    input_path = message['originalPath']
    originalFilename = message['originalFilename']
    output_path = message['thumbnailPath']
    thumbnailFilename = message['thumbnailFilename']

    try:
        logger.info(f"Processing image: {input_path}")

        # Update status to "processing"
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE images
                    SET status = 'processing',
                        processing_started_at = %s
                    WHERE id = %s
                """, (datetime.now(), image_id))
        
        # Generate thumbnail
        size = (128, 128)
        file_size = generate_thumbnail(input_path, output_path, size)

        # Update to completed
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE images
                    SET status = 'completed',
                        completed_at = %s,
                        thumbnail_filename = %s,
                        thumbnail_size = %s
                    WHERE id = %s
                """, (datetime.now(), thumbnailFilename, file_size, image_id))
        
        logger.info(f"Thumbnail created at {output_path} with size {file_size} bytes")
        
    except Exception as e:
        logger.error(f"Error processing image: {e}")

        # Update to failed
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE images
                    SET status = 'failed',
                        error_message = %s,
                        completed_at = %s
                    WHERE id = %s
                """, (str(e), datetime.now(), originalFilename, image_id))

def main():
    """Main function to set up RabbitMQ consumer"""
    logger.info("Starting image processing worker...")
    
    # Set up RabbitMQ connection
    connection = pika.BlockingConnection(pika.ConnectionParameters(host=RABBITMQ_HOST))
    channel = connection.channel()
    
    # Declare the queue
    channel.queue_declare(queue=RABBITMQ_QUEUE, durable=True)
    
    # Set up the consumer
    channel.basic_consume(queue=RABBITMQ_QUEUE, on_message_callback=callback, auto_ack=True)
    
    logger.info(f"Waiting for messages in queue '{RABBITMQ_QUEUE}'...")
    
    try:
        channel.start_consuming()
    except KeyboardInterrupt:
        logger.info("Worker stopped by user")
        channel.stop_consuming()
    finally:
        connection.close()

if __name__ == "__main__":
    main()