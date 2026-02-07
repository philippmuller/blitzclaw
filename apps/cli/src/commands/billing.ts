import { Command } from "commander";
import chalk from "chalk";
import open from "open";
import ora from "ora";
import { getToken } from "../lib/config.js";
import { getBalance, createTopup, getUsage, ApiError } from "../lib/api.js";

function requireAuth() {
  const token = getToken();
  if (!token) {
    console.log(chalk.red("Not logged in"));
    console.log(chalk.gray(`Run ${chalk.cyan("blitzclaw auth login")} to log in`));
    process.exit(1);
  }
}

export function billingCommand(): Command {
  const billing = new Command("billing")
    .description("Manage billing and balance");

  billing
    .command("balance")
    .description("Show current balance")
    .option("--format <format>", "Output format (table|json)", "table")
    .action(async (options) => {
      requireAuth();
      
      const spinner = ora("Fetching balance...").start();
      
      try {
        const balance = await getBalance();
        spinner.stop();
        
        if (options.format === "json") {
          console.log(JSON.stringify(balance, null, 2));
          return;
        }
        
        console.log(chalk.bold("Account Balance"));
        console.log(`  Balance:      ${chalk.green("$" + balance.creditsDollars)}`);
        console.log(`  Minimum:      $${(balance.minimumCents / 100).toFixed(2)}`);
        console.log(`  Auto Top-up:  ${balance.autoTopupEnabled ? chalk.green("Enabled") : chalk.gray("Disabled")}`);
        
        if (balance.belowMinimum) {
          console.log("");
          console.log(chalk.yellow("⚠️  Balance below $10 minimum!"));
          console.log(chalk.gray(`Run ${chalk.cyan("blitzclaw billing topup")} to add funds`));
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          spinner.fail("Session expired");
          process.exit(1);
        }
        spinner.fail("Failed to fetch balance");
        console.error(chalk.red((error as Error).message));
        process.exit(1);
      }
    });

  billing
    .command("topup")
    .description("Top up your balance")
    .option("--amount <dollars>", "Amount to add in dollars", "20")
    .option("--url-only", "Only print checkout URL, don't open browser")
    .action(async (options) => {
      requireAuth();
      
      const amountDollars = parseFloat(options.amount);
      if (isNaN(amountDollars) || amountDollars < 10) {
        console.log(chalk.red("Minimum top-up amount is $10"));
        process.exit(1);
      }
      
      const amountCents = Math.round(amountDollars * 100);
      const spinner = ora("Creating checkout session...").start();
      
      try {
        const result = await createTopup(amountCents);
        spinner.stop();
        
        if (options.urlOnly) {
          console.log(result.checkoutUrl);
          return;
        }
        
        console.log(chalk.blue(`Opening checkout for $${amountDollars}...`));
        console.log(chalk.gray(`If browser doesn't open: ${result.checkoutUrl}`));
        
        await open(result.checkoutUrl);
        
        console.log("");
        console.log(chalk.gray("After payment, your balance will be updated automatically."));
        console.log(chalk.gray(`Run ${chalk.cyan("blitzclaw billing balance")} to check.`));
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          spinner.fail("Session expired");
          process.exit(1);
        }
        spinner.fail("Failed to create checkout");
        console.error(chalk.red((error as Error).message));
        process.exit(1);
      }
    });

  billing
    .command("usage")
    .description("View usage history")
    .option("--from <date>", "Start date (YYYY-MM-DD)")
    .option("--to <date>", "End date (YYYY-MM-DD)")
    .option("--format <format>", "Output format (table|json)", "table")
    .action(async (options) => {
      requireAuth();
      
      const spinner = ora("Fetching usage...").start();
      
      try {
        const usage = await getUsage(options.from, options.to);
        spinner.stop();
        
        if (options.format === "json") {
          console.log(JSON.stringify(usage, null, 2));
          return;
        }
        
        const fromDate = new Date(usage.from).toLocaleDateString();
        const toDate = new Date(usage.to).toLocaleDateString();
        
        console.log(chalk.bold(`Usage: ${fromDate} - ${toDate}`));
        console.log("");
        console.log(`  Total Cost:    ${chalk.green("$" + usage.totalCostDollars)}`);
        console.log(`  Tokens In:     ${usage.totalTokensIn.toLocaleString()}`);
        console.log(`  Tokens Out:    ${usage.totalTokensOut.toLocaleString()}`);
        
        if (usage.byModel.length > 0) {
          console.log("");
          console.log(chalk.bold("  By Model:"));
          for (const model of usage.byModel) {
            console.log(`    ${model.model}`);
            console.log(`      Cost: $${model.costDollars} | In: ${model.tokensIn.toLocaleString()} | Out: ${model.tokensOut.toLocaleString()}`);
          }
        }
        
        if (usage.instances.length > 0) {
          console.log("");
          console.log(chalk.bold("  By Instance:"));
          for (const instance of usage.instances) {
            const costDollars = (instance.costCents / 100).toFixed(2);
            console.log(`    ${instance.id.slice(0, 8)}... (${instance.channelType})`);
            console.log(`      Cost: $${costDollars} | Requests: ${instance.usageCount}`);
          }
        }
        
        if (usage.totalCostCents === 0) {
          console.log("");
          console.log(chalk.gray("  No usage recorded for this period."));
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          spinner.fail("Session expired");
          process.exit(1);
        }
        spinner.fail("Failed to fetch usage");
        console.error(chalk.red((error as Error).message));
        process.exit(1);
      }
    });

  return billing;
}
