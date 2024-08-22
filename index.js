require("dotenv").config();
const { Telegraf } = require("telegraf");
const { Ollama } = require("ollama");
const PocketBase = require("pocketbase/cjs");

const chatHistories = {};

async function initializeBot() {
  const pb = new PocketBase("https://end.redruby.one");
  const ollama = new Ollama({ host: "http://192.168.50.112:11222" });
  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

  bot.start(async (ctx) => {
    const record = await pb.collection("ai").getOne("yqk60ik0w95061p");
    chatHistories[ctx.chat.id] = [
      {
        role: "system",
        content: record.role,
      },
    ];
    ctx.reply("Welcome! I'm Uran! Let's-a go!");
  });

  bot.help((ctx) => ctx.reply("Ask me anything, and I'll answer as Uran"));

  bot.on("text", async (ctx) => {
    try {
      const userMessage = ctx.message.text;
      const record = await pb.collection("ai").getOne("yqk60ik0w95061p");

      if (!chatHistories[ctx.chat.id]) {
        chatHistories[ctx.chat.id] = [
          {
            role: "system",
            content: record.role,
          },
        ];
      } else {
        chatHistories[ctx.chat.id][0].content = record.role;
      }

      chatHistories[ctx.chat.id].push({ role: "user", content: userMessage });

      let fullResponse = "";
      let messageSent = false;

      const stream = await ollama.chat({
        model: process.env.OLLAMA_MODEL || "llama3:latest",
        messages: chatHistories[ctx.chat.id],
        stream: true,
      });

      for await (const part of stream) {
        fullResponse += part.message.content;

        // Send the first chunk immediately
        if (!messageSent) {
          await ctx.reply(fullResponse);
          messageSent = true;
        }

        // Update the message every 20 chunks or when the stream ends
        if (fullResponse.length % 20 === 0 || part.done) {
          try {
            await ctx.telegram.editMessageText(
              ctx.chat.id,
              ctx.message.message_id + 1,
              null,
              fullResponse
            );
          } catch (error) {
            console.error("Error updating message:", error);
          }
        }

        if (part.done) break;
      }

      chatHistories[ctx.chat.id].push({
        role: "assistant",
        content: fullResponse,
      });
    } catch (error) {
      console.error("Error communicating with Ollama", error);
      ctx.reply("Sorry, something went wrong while processing your request.");
    }
  });

  bot.launch();

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

initializeBot();
