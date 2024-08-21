require("dotenv").config();
const { Telegraf } = require("telegraf");
const { Ollama } = require("ollama");

async function initializeBot() {
  // Initialize Ollama with the specified host
  const ollama = new Ollama({ host: "http://192.168.50.112:11222" });

  // Initialize the Telegram bot with the provided token
  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

  // Set up bot commands
  bot.start((ctx) => ctx.reply("Welcome"));
  bot.help((ctx) => ctx.reply("Send me any message, and I'll ask Ollama!"));

  // Handle all text messages by sending them to Ollama and replying with the response
  bot.on("text", async (ctx) => {
    try {
      // Get the user's message
      const userMessage = ctx.message.text;

      // Send the message to Ollama and get the response
      const ollamaResponse = await ollama.chat({
        model: "llama3.1:latest",
        messages: [{ role: "user", content: userMessage }],
      });

      // Reply to the user with Ollama's response
      ctx.reply(ollamaResponse.message.content);
    } catch (error) {
      console.error("Error communicating with ai", error);
      ctx.reply("Sorry, something went wrong while processing your request.");
    }
  });

  // Launch the bot
  bot.launch();

  // Enable graceful stop
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

// Run the bot initialization function
initializeBot();
