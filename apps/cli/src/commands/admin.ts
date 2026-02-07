import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { getToken } from "../lib/config.js";
import { getPoolStatus, provisionPool, ApiError } from "../lib/api.js";

function requireAuth() {
  const token = getToken();
  if (!token) {
    console.log(chalk.red("Not logged in"));
    console.log(chalk.gray(`Run ${chalk.cyan("blitzclaw auth login")} to log in`));
    process.exit(1);
  }
}

export function adminCommand(): Command {
  const admin = new Command("admin")
    .description("Admin commands (requires admin access)");

  const pool = new Command("pool")
    .description("Manage server pool");

  pool
    .command("status")
    .description("Show server pool status")
    .option("--format <format>", "Output format (table|json)", "table")
    .action(async (options) => {
      requireAuth();
      
      const spinner = ora("Fetching pool status...").start();
      
      try {
        const result = await getPoolStatus();
        spinner.stop();
        
        if (options.format === "json") {
          console.log(JSON.stringify(result, null, 2));
          return;
        }
        
        const healthColor = result.health.healthy ? chalk.green : chalk.red;
        
        console.log(chalk.bold("Server Pool Status\n"));
        
        console.log(chalk.bold("  Pool:"));
        console.log(`    Available:     ${chalk.green(result.pool.available)}`);
        console.log(`    Assigned:      ${chalk.yellow(result.pool.assigned)}`);
        console.log(`    Provisioning:  ${chalk.blue(result.pool.provisioning)}`);
        console.log(`    Total:         ${result.pool.total}`);
        
        console.log("");
        console.log(chalk.bold("  Config:"));
        console.log(`    Min Pool Size: ${result.config.minPoolSize}`);
        console.log(`    Max Pool Size: ${result.config.maxPoolSize}`);
        
        console.log("");
        console.log(chalk.bold("  Health:"));
        console.log(`    Status:        ${healthColor(result.health.healthy ? "✓ Healthy" : "✗ Unhealthy")}`);
        console.log(`    Message:       ${result.health.message}`);
        
        if (!result.health.healthy) {
          console.log("");
          console.log(chalk.yellow(`Tip: Run ${chalk.cyan("blitzclaw admin pool provision")} to add more servers`));
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          spinner.fail("Admin access required");
          process.exit(1);
        }
        spinner.fail("Failed to fetch pool status");
        console.error(chalk.red((error as Error).message));
        process.exit(1);
      }
    });

  pool
    .command("provision")
    .description("Provision new servers for the pool")
    .option("--count <number>", "Number of servers to provision", "1")
    .option("--format <format>", "Output format (table|json)", "table")
    .action(async (options) => {
      requireAuth();
      
      const count = parseInt(options.count, 10);
      if (isNaN(count) || count < 1 || count > 10) {
        console.error(chalk.red("Count must be between 1 and 10"));
        process.exit(1);
      }
      
      const spinner = ora(`Provisioning ${count} server(s)...`).start();
      
      try {
        const result = await provisionPool(count);
        spinner.stop();
        
        if (options.format === "json") {
          console.log(JSON.stringify(result, null, 2));
          return;
        }
        
        if (result.provisioned > 0) {
          console.log(chalk.green(`✓ Provisioned ${result.provisioned} server(s)`));
        } else {
          console.log(chalk.yellow("No servers were provisioned"));
        }
        
        if (result.errors.length > 0) {
          console.log("");
          console.log(chalk.red("Errors:"));
          for (const error of result.errors) {
            console.log(chalk.red(`  - ${error}`));
          }
        }
        
        console.log("");
        console.log(chalk.bold("Pool Status:"));
        console.log(`  Available:     ${chalk.green(result.pool.available)}`);
        console.log(`  Assigned:      ${chalk.yellow(result.pool.assigned)}`);
        console.log(`  Provisioning:  ${chalk.blue(result.pool.provisioning)}`);
        console.log(`  Total:         ${result.pool.total}`);
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          spinner.fail("Admin access required");
          process.exit(1);
        }
        spinner.fail("Failed to provision servers");
        console.error(chalk.red((error as Error).message));
        process.exit(1);
      }
    });

  admin.addCommand(pool);

  return admin;
}
