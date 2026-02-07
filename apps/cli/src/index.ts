#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { authCommand } from "./commands/auth.js";
import { billingCommand } from "./commands/billing.js";

const program = new Command();

program
  .name("blitzclaw")
  .description("BlitzClaw CLI - Deploy OpenClaw instances from your terminal")
  .version("0.1.0");

// Add commands
program.addCommand(authCommand());
program.addCommand(billingCommand());

// Global options
program
  .option("--api-url <url>", "Override API URL")
  .option("-q, --quiet", "Suppress non-essential output")
  .option("-v, --verbose", "Show verbose output");

// Handle unknown commands
program.on("command:*", () => {
  console.error(chalk.red(`Unknown command: ${program.args.join(" ")}`));
  console.log("");
  program.help();
});

// Parse and run
program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
  console.log(chalk.bold.blue("⚡ BlitzClaw CLI"));
  console.log("");
  program.help();
}
