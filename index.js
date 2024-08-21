require("dotenv").config();
const { Telegraf } = require("telegraf");
const { Ollama } = require("ollama");
const PocketBase = require("pocketbase/cjs");

// Object to store chat history for each user
const chatHistories = {};

async function initializeBot() {
  // Initialize PocketBase client
  const pb = new PocketBase("https://end.redruby.one");

  // Initialize Ollama with the specified host
  const ollama = new Ollama({ host: "http://192.168.50.112:11222" });

  // Initialize the Telegram bot with the provided token
  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

  // Set up bot commands
  bot.start(async (ctx) => {
    // Fetch a record from PocketBase
    const record = await pb.collection("ai").getOne("yqk60ik0w95061p");

    // Initialize chat history for the user
    chatHistories[ctx.chat.id] = [
      {
        role: "system",
        content: record.role,
      },
    ];
    ctx.reply("Welcome! I'm Uran! Let's-a go!");
  });

  bot.help((ctx) => ctx.reply("Ask me anything, and I'll answer as Uran"));

  // Handle all text messages by sending them to Ollama and replying with the response
  bot.on("text", async (ctx) => {
    try {
      const userMessage = ctx.message.text;

      // Fetch the latest record.role from PocketBase
      const record = await pb.collection("ai").getOne("yqk60ik0w95061p");

      // Check if the chat history for this user exists, if not, initialize it
      if (!chatHistories[ctx.chat.id]) {
        chatHistories[ctx.chat.id] = [
          {
            role: "system",
            content: record.role,
          },
        ];
      } else {
        // Update the existing chat history with the latest role
        chatHistories[ctx.chat.id][0].content = record.role;
      }

      // Append the user's message to the chat history
      chatHistories[ctx.chat.id].push({ role: "user", content: userMessage });

      // Send the entire chat history to Ollama and get the response
      const ollamaResponse = await ollama.chat({
        model: process.env.OLLAMA_MODEL || "llama3.1:latest", // Use the model from env or fallback to default
        messages: chatHistories[ctx.chat.id],
      });

      // Append Ollama's response to the chat history
      chatHistories[ctx.chat.id].push({
        role: "assistant",
        content: ollamaResponse.message.content,
      });

      // Reply to the user with Ollama's response
      ctx.reply(ollamaResponse.message.content);
    } catch (error) {
      console.error("Error communicating with Ollama", error);
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
