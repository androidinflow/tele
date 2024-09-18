require("dotenv").config();
const { Telegraf } = require("telegraf");
const { Ollama } = require("ollama");
const PocketBase = require("pocketbase/cjs");
const QRCode = require('qrcode');
const fs = require('fs').promises;

// Configuration
const config = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  OLLAMA_MODEL: process.env.OLLAMA_MODEL || "llama2:latest",
  OLLAMA_HOST: process.env.OLLAMA_HOST || "http://192.168.50.112:11222",
  POCKETBASE_URL: process.env.POCKETBASE_URL || "https://end.redruby.one",
};

// Initialize services
const pb = new PocketBase(config.POCKETBASE_URL);
const ollama = new Ollama({ host: config.OLLAMA_HOST });
const bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);

const chatHistories = {};

async function getSystemRole() {
  try {
    const records = await pb.collection('posts').getFullList({ sort: '-created' });
    return `You are a search engine. Respond in max 20 words. Format answers as:
    ----------------------
    1:ID
    2:TEXT
    3:INFO
    ----------------------
    Multiple posts separated by new lines. If no match:
    ----------------------
    No match
    ----------------------
    Posts: ${records.map(post => `ID: ${post.id}, Text: ${post.text}, Info: ${post.info}`).join('\n')}
    Total posts: ${records.length}`;
  } catch (error) {
    console.error("Error fetching posts for system role:", error);
    return "You are Uran, a helpful AI assistant.";
  }
}

async function streamResponse(ctx, messages) {
  let fullResponse = "";
  let lastUpdateLength = 0;
  const stream = await ollama.chat({ model: config.OLLAMA_MODEL, messages, stream: true });
  const sentMessage = await ctx.reply("Thinking...");

  for await (const part of stream) {
    fullResponse += part.message.content;
    if (fullResponse.length - lastUpdateLength >= 10 || part.done) {
      try {
        await ctx.telegram.editMessageText(ctx.chat.id, sentMessage.message_id, null, fullResponse);
        lastUpdateLength = fullResponse.length;
      } catch (error) {
        if (error.description !== "Bad Request: message is not modified") {
          console.error("Error updating message:", error);
        }
      }
    }
    if (part.done) break;
  }
  return fullResponse;
}

bot.start(async (ctx) => {
  chatHistories[ctx.chat.id] = [{ role: "system", content: await getSystemRole() }];
  ctx.reply("Welcome! Let's-a go!", {
    reply_markup: {
      keyboard: [
        [{ text: "🆘 Help" }, { text: "🚀 Start Chat" }, { text: "ℹ️ About" }]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  });
});

bot.hears(['🆘 Help', '/help'], async (ctx) => {
  try {
    const qrCodeFilePath = './qrcode.png';
    await QRCode.toFile(qrCodeFilePath, 'https://t.me/urangpt');
    await ctx.replyWithPhoto(
      { source: qrCodeFilePath },
      { caption: "Scan this QR code to share the bot!" }
    );
    await fs.unlink(qrCodeFilePath);
  } catch (error) {
    console.error('Error with QR code:', error);
    await ctx.reply('Sorry, there was an error generating the QR code.');
  }
});

bot.on("text", async (ctx) => {
  try {
    if (!chatHistories[ctx.chat.id]) {
      chatHistories[ctx.chat.id] = [{ role: "system", content: await getSystemRole() }];
    }
    chatHistories[ctx.chat.id].push({ role: "user", content: ctx.message.text });
    const fullResponse = await streamResponse(ctx, chatHistories[ctx.chat.id]);
    chatHistories[ctx.chat.id].push({ role: "assistant", content: fullResponse });
  } catch (error) {
    console.error("Error processing request:", error);
    ctx.reply("Sorry, something went wrong while processing your request.");
  }
});

bot.launch()
  .then(() => {
    console.log(`
    ╔════════════════════════════════════════════════╗
    ║   Welcome! Uran Bot is now online!             ║
    ║   Model: ${config.OLLAMA_MODEL}                ║
    ║   Ollama Host: ${config.OLLAMA_HOST}           ║
    ╚════════════════════════════════════════════════╝
    `);
  })
  .catch(() => console.log("Failed to launch the bot."));

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
