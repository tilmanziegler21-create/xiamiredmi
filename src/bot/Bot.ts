import TelegramBot from "node-telegram-bot-api";
import { env } from "../infra/config";
import { logger } from "../infra/logger";
import { registerClientFlow } from "./flows/clientFlow";
import { registerCourierFlow } from "./flows/courierFlow";
import { registerAdminFlow } from "./flows/adminFlow";

let bot: TelegramBot;

export async function startBot() {
  bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN, { polling: true });
  bot.on("polling_error", (error) => {
    logger.error("Telegram polling error", { error: String(error) });
  });
  registerClientFlow(bot);
  registerCourierFlow(bot);
  registerAdminFlow(bot);
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection", { error: String(reason) });
  });
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", { error: String(error) });
  });
  logger.info("Bot started");
}

export function getBot() {
  return bot;
}
