const amqp = require("amqplib");

let channel = null;
let connection = null;

const QUEUE_NAME = "thumbnail_processing";

const connectQueue = async () => {
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();

    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
    });

    console.log(`✅ Connected to ${QUEUE_NAME} queue successfully`);
    return true;
  } catch (error) {
    console.error(
      `❌ Failed to connect to ${QUEUE_NAME} queue:`,
      error.message
    );
    return false;
  }
};

const publishJob = async (job) => {
  try {
    if (!channel) {
      throw new Error("RabbitMQ channel not established");
    }

    const success = channel.sendToQueue(
      QUEUE_NAME,
      Buffer.from(JSON.stringify(job)),
      { persistent: true } // Message will be saved to disk
    );

    console.log(
      `🔄 Job queued for processing in ${QUEUE_NAME} queue: ${job.imageId}`
    );
    return success;
  } catch (error) {
    console.error(
      `❌ Failed to publish job to ${QUEUE_NAME} queue:`,
      error.message
    );
    throw error;
  }
};

const purgeQueue = async () => {
  try {
    if (!channel) {
      throw new Error("RabbitMQ channel not established");
    }

    const response = await channel.purgeQueue(QUEUE_NAME);
    console.log(
      `🧹 Purged queue: ${QUEUE_NAME}, removed ${response.messageCount} messages`
    );
  } catch (error) {
    console.error(`❌ Failed to purge queue ${QUEUE_NAME}`, error.message);
  }
};

process.on("SIGINT", async () => {
  if (channel) {
    await channel.close();
  }
  if (connection) await connection.close();
  console.log("✅ RabbitMQ connection closed");
});

module.exports = { connectQueue, publishJob, purgeQueue };
