import { Command } from "commander";
import chalk from "chalk";
import open from "open";
import ora from "ora";
import { clearToken, getToken, loadConfig, setToken } from "../lib/config.js";
import { getMe, ApiError } from "../lib/api.js";

export function authCommand(): Command {
  const auth = new Command("auth")
    .description("Manage authentication");

  auth
    .command("login")
    .description("Log in to BlitzClaw (opens browser)")
    .option("--api-key <key>", "Use API key instead of browser login")
    .action(async (options) => {
      if (options.apiKey) {
        // Use API key directly
        setToken(options.apiKey);
        console.log(chalk.green("✓ API key saved"));
        
        // Verify it works
        const spinner = ora("Verifying...").start();
        try {
          const user = await getMe();
          spinner.succeed(`Logged in as ${chalk.cyan(user.email)}`);
        } catch (error) {
          spinner.fail("Invalid API key");
          clearToken();
          process.exit(1);
        }
        return;
      }

      const config = loadConfig();
      const loginUrl = config.apiUrl.replace("/api", "") + "/sign-in";
      
      console.log(chalk.blue("Opening browser for login..."));
      console.log(chalk.gray(`If browser doesn't open, visit: ${loginUrl}`));
      
      await open(loginUrl);
      
      console.log("");
      console.log(chalk.yellow("After logging in:"));
      console.log("1. Go to your dashboard");
      console.log("2. Copy your API key from Settings");
      console.log(`3. Run: ${chalk.cyan("blitzclaw auth login --api-key YOUR_KEY")}`);
      console.log("");
      console.log(chalk.gray("(API key generation coming soon - for now, use session token from browser)"));
    });

  auth
    .command("whoami")
    .description("Show current authenticated user")
    .action(async () => {
      const token = getToken();
      
      if (!token) {
        console.log(chalk.red("Not logged in"));
        console.log(chalk.gray(`Run ${chalk.cyan("blitzclaw auth login")} to log in`));
        process.exit(1);
      }

      const spinner = ora("Fetching user info...").start();
      
      try {
        const user = await getMe();
        spinner.stop();
        
        console.log(chalk.bold("Current User"));
        console.log(`  Email:     ${chalk.cyan(user.email)}`);
        console.log(`  ID:        ${user.id}`);
        console.log(`  Balance:   ${chalk.green("$" + (user.balance.creditsCents / 100).toFixed(2))}`);
        console.log(`  Instances: ${user.instanceCount}`);
        console.log(`  Created:   ${new Date(user.createdAt).toLocaleDateString()}`);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          spinner.fail("Session expired or invalid");
          console.log(chalk.gray(`Run ${chalk.cyan("blitzclaw auth login")} to log in again`));
          process.exit(1);
        }
        spinner.fail("Failed to fetch user info");
        console.error(chalk.red((error as Error).message));
        process.exit(1);
      }
    });

  auth
    .command("logout")
    .description("Log out of BlitzClaw")
    .action(() => {
      clearToken();
      console.log(chalk.green("✓ Logged out"));
    });

  return auth;
}
