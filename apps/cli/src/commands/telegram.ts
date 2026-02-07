import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { getToken } from "../lib/config.js";
import { 
  validateTelegramToken, 
  connectTelegram, 
  getTelegramInfo,
  ApiError 
} from "../lib/api.js";

function requireAuth() {
  const token = getToken();
  if (!token) {
    console.log(chalk.red("Not logged in"));
    console.log(chalk.gray(`Run ${chalk.cyan("blitzclaw auth login")} to log in`));
    process.exit(1);
  }
}

export function telegramCommand(): Command {
  const telegram = new Command("telegram")
    .description("Manage Telegram bot connections");

  telegram
    .command("validate")
    .description("Validate a Telegram bot token (without connecting)")
    .requiredOption("--token <bot_token>", "Telegram bot token from @BotFather")
    .option("--format <format>", "Output format (table|json)", "table")
    .action(async (options) => {
      requireAuth();
      
      const spinner = ora("Validating token...").start();
      
      try {
        const result = await validateTelegramToken(options.token);
        spinner.stop();
        
        if (options.format === "json") {
          console.log(JSON.stringify(result, null, 2));
          return;
        }
        
        console.log(chalk.green("✓ Token is valid!\n"));
        console.log(`  Bot Name:     ${chalk.cyan(result.bot.name)}`);
        console.log(`  Username:     @${result.bot.username}`);
        console.log(`  Bot ID:       ${result.bot.id}`);
        console.log(`  Link:         ${chalk.blue(result.bot.link)}`);
        console.log("");
        console.log(chalk.gray("Use this token to connect your bot to an instance:"));
        console.log(chalk.cyan(`  blitzclaw telegram connect <instance_id> --token ${options.token.slice(0, 10)}...`));
      } catch (error) {
        if (error instanceof ApiError) {
          spinner.fail("Token validation failed");
          console.log("");
          console.log(chalk.red(`  ${error.message}`));
          console.log("");
          console.log(chalk.gray("Tips:"));
          console.log(chalk.gray("  • Get a token from @BotFather on Telegram"));
          console.log(chalk.gray("  • Send /newbot to create a new bot"));
          console.log(chalk.gray("  • Copy the token it gives you"));
          process.exit(1);
        }
        spinner.fail("Validation failed");
        console.error(chalk.red((error as Error).message));
        process.exit(1);
      }
    });

  telegram
    .command("connect <instance_id>")
    .description("Connect a Telegram bot to an instance")
    .requiredOption("--token <bot_token>", "Telegram bot token from @BotFather")
    .option("--format <format>", "Output format (table|json)", "table")
    .action(async (instanceId, options) => {
      requireAuth();
      
      const spinner = ora("Connecting Telegram bot...").start();
      
      try {
        const result = await connectTelegram(instanceId, options.token);
        spinner.stop();
        
        if (options.format === "json") {
          console.log(JSON.stringify(result, null, 2));
          return;
        }
        
        console.log(chalk.green("✓ Telegram bot connected!\n"));
        console.log(`  Bot Name:     ${chalk.cyan(result.bot.name)}`);
        console.log(`  Username:     @${result.bot.username}`);
        console.log(`  Link:         ${chalk.blue(result.bot.link)}`);
        console.log("");
        console.log(chalk.green("🎉 Your bot is ready!"));
        console.log(`Open ${chalk.blue(result.bot.link)} to start chatting.`);
      } catch (error) {
        if (error instanceof ApiError) {
          spinner.fail("Failed to connect bot");
          
          if (error.status === 404) {
            console.log(chalk.red("\n  Instance not found"));
            console.log(chalk.gray(`  Run ${chalk.cyan("blitzclaw instances list")} to see your instances`));
          } else if (error.status === 400) {
            console.log(chalk.red(`\n  ${error.message}`));
            console.log(chalk.gray("\n  Tips:"));
            console.log(chalk.gray("  • Validate your token first: blitzclaw telegram validate --token <token>"));
            console.log(chalk.gray("  • Get a new token from @BotFather"));
          } else {
            console.log(chalk.red(`\n  ${error.message}`));
          }
          process.exit(1);
        }
        spinner.fail("Connection failed");
        console.error(chalk.red((error as Error).message));
        process.exit(1);
      }
    });

  telegram
    .command("info <instance_id>")
    .description("Get Telegram bot info for an instance")
    .option("--format <format>", "Output format (table|json)", "table")
    .action(async (instanceId, options) => {
      requireAuth();
      
      const spinner = ora("Fetching bot info...").start();
      
      try {
        const result = await getTelegramInfo(instanceId);
        spinner.stop();
        
        if (options.format === "json") {
          console.log(JSON.stringify(result, null, 2));
          return;
        }
        
        if (!result.connected) {
          console.log(chalk.yellow("No Telegram bot connected to this instance."));
          console.log("");
          console.log(chalk.gray("Connect one with:"));
          console.log(chalk.cyan(`  blitzclaw telegram connect ${instanceId} --token <bot_token>`));
          return;
        }
        
        console.log(chalk.bold("Telegram Bot Info\n"));
        console.log(`  Bot Name:         ${chalk.cyan(result.bot.name)}`);
        console.log(`  Username:         @${result.bot.username}`);
        console.log(`  Bot ID:           ${result.bot.id}`);
        console.log(`  Link:             ${chalk.blue(result.bot.link)}`);
        console.log(`  Instance Status:  ${result.instance_status}`);
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 404) {
            spinner.fail("Instance not found or no bot connected");
          } else if (error.status === 400) {
            spinner.fail("Instance not configured for Telegram");
          } else {
            spinner.fail("Failed to fetch bot info");
            console.log(chalk.red(`\n  ${error.message}`));
          }
          process.exit(1);
        }
        spinner.fail("Failed to fetch bot info");
        console.error(chalk.red((error as Error).message));
        process.exit(1);
      }
    });

  return telegram;
}
