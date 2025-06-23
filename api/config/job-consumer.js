const amqp = require("amqplib");
const socketio = require("../socket");

const QUEUE_NAME = "thumbnail_completed";
const HOST = process.env.HOST || "http://localhost:3000/api";

async function startConsumer() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();

    await channel.assertQueue(QUEUE_NAME, { durable: true });
    channel.prefetch(1);

    console.log(`✅ Waiting for messages in "${QUEUE_NAME}"...`);

    const io = socketio.getIO();
    channel.consume(
      QUEUE_NAME,
      async (msg) => {
        if (msg !== null) {
          const content = msg.content.toString();
          let data;
          try {
            data = JSON.parse(content);
          } catch (e) {
            console.error("Invalid JSON:", content);
            channel.ack(msg);
            return;
          }

          /*
           consuming_message = {
            "imageId": "12345",
            "thumbnailFilename": "thumbnail_12345.jpg",
          */
          io.emit("thumbnail:completed", {
            id: data.imageId,
            thumbnail: HOST + "/thumbnail/" + data.thumbnailFilename,
          });

          channel.ack(msg);
        }
      },
      { noAck: false }
    );

    process.on("SIGINT", async () => {
      await channel.close();
      await connection.close();
      process.exit(0);
    });
  } catch (err) {
    console.error("RabbitMQ consumer error:", err);
    process.exit(1);
  }
}

module.exports = { startConsumer };
