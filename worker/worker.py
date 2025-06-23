import pika
import json
from loguru import logger
from config import RABBITMQ_HOST, RABBITMQ_PROCESSING_QUEUE, RABBITMQ_COMPLETED_QUEUE
from image_processor import generate_thumbnail
from db import get_connection
from datetime import datetime


# cosuming_message = {
#   imageId,
#   originalPath,
#   thumbnailPath,
#   thumbnailFilename,
# }

# publish_message = {
#   imageId,
#   thumbnailFilename
# }

def callback(ch, method, properties, body):
    """Callback function to process messages from RabbitMQ"""
    message = json.loads(body)

    image_id = message['imageId']
    input_path = message['originalPath']
    output_path = message['thumbnailPath']
    thumbnail_filename = message['thumbnailFilename']

    try:
        logger.info(f"Processing image: {input_path}")

        # Update status to "processing"
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE images
                    SET status = 'processing',
                        processingStartedAt = %s
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
                        completedAt = %s,
                        thumbnailFilename = %s,
                        thumbnailSize = %s
                    WHERE id = %s
                """, (datetime.now(), thumbnail_filename, file_size, image_id))

        complete_notification = {
            "imageId": image_id,
            "thumbnailFilename": thumbnail_filename
        }
        publish_completion_notification(complete_notification)

        logger.info(f"Thumbnail created at {output_path} with size {file_size} bytes")
        
    except Exception as e:
        logger.error(f"Error processing image: {e}")

        # Update to failed
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE images
                    SET status = 'failed',
                        errorMessage = %s,
                        completedAt = %s
                    WHERE id = %s
                """, (str(e), datetime.now(), image_id))

def publish_completion_notification(message):
    """Publish a message to the thumbnail_completed queue"""
    try:
        connection = pika.BlockingConnection(pika.ConnectionParameters(host=RABBITMQ_HOST))
        channel = connection.channel()
        
        # Ensure the queue exists
        channel.queue_declare(queue=RABBITMQ_COMPLETED_QUEUE, durable=True)
        
        # Publish the message
        channel.basic_publish(
            exchange='',
            routing_key=RABBITMQ_COMPLETED_QUEUE,
            body=json.dumps(message),
            properties=pika.BasicProperties(
                delivery_mode=2,  # make message persistent
            )
        )
        
        logger.info(f"Sent completion notification for image {message['imageId']}")
        connection.close()
    except Exception as e:
        logger.error(f"Failed to send completion notification: {e}")

def main():
    """Main function to set up RabbitMQ consumer"""
    logger.info("Starting image processing worker...")
    
    # Set up RabbitMQ connection
    connection = pika.BlockingConnection(pika.ConnectionParameters(host=RABBITMQ_HOST))
    channel = connection.channel()
    
    # Declare the queues
    channel.queue_declare(queue=RABBITMQ_PROCESSING_QUEUE, durable=True)
    channel.queue_declare(queue=RABBITMQ_COMPLETED_QUEUE, durable=True)

    # Set up the consumer
    channel.basic_consume(queue=RABBITMQ_PROCESSING_QUEUE, on_message_callback=callback, auto_ack=True)
    
    logger.info(f"Waiting for messages in queue '{RABBITMQ_PROCESSING_QUEUE}'...")
    
    try:
        channel.start_consuming()
    except KeyboardInterrupt:
        logger.info("Worker stopped by user")
        channel.stop_consuming()
    finally:
        connection.close()

if __name__ == "__main__":
    main()