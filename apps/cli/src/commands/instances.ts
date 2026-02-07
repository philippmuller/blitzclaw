import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { readFileSync } from "fs";
import { getToken } from "../lib/config.js";
import { 
  listInstances, 
  createInstance, 
  getInstance, 
  deleteInstance, 
  restartInstance,
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

export function instancesCommand(): Command {
  const instances = new Command("instances")
    .description("Manage your OpenClaw instances");

  instances
    .command("list")
    .description("List all your instances")
    .option("--format <format>", "Output format (table|json)", "table")
    .action(async (options) => {
      requireAuth();
      
      const spinner = ora("Fetching instances...").start();
      
      try {
        const result = await listInstances();
        spinner.stop();
        
        if (options.format === "json") {
          console.log(JSON.stringify(result.instances, null, 2));
          return;
        }
        
        if (result.instances.length === 0) {
          console.log(chalk.gray("No instances found."));
          console.log(chalk.gray(`Create one with: ${chalk.cyan("blitzclaw instances create --channel telegram")}`));
          return;
        }
        
        console.log(chalk.bold("Your Instances\n"));
        
        for (const instance of result.instances) {
          const statusColor = {
            ACTIVE: chalk.green,
            PENDING: chalk.yellow,
            PROVISIONING: chalk.yellow,
            PAUSED: chalk.red,
            STOPPED: chalk.gray,
            ERROR: chalk.red,
          }[instance.status] || chalk.white;
          
          console.log(`  ${chalk.cyan(instance.id.slice(0, 8))}...`);
          console.log(`    Status:   ${statusColor(instance.status)}`);
          console.log(`    Channel:  ${instance.channelType}`);
          console.log(`    Persona:  ${instance.personaTemplate}`);
          console.log(`    IP:       ${instance.ipAddress || chalk.gray("(pending)")}`);
          console.log(`    Created:  ${new Date(instance.createdAt).toLocaleDateString()}`);
          console.log("");
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          spinner.fail("Session expired");
          process.exit(1);
        }
        spinner.fail("Failed to fetch instances");
        console.error(chalk.red((error as Error).message));
        process.exit(1);
      }
    });

  instances
    .command("create")
    .description("Create a new instance")
    .requiredOption("--channel <type>", "Channel type (telegram|whatsapp)")
    .option("--persona <template>", "Persona template (assistant|developer|creative|custom)", "assistant")
    .option("--soul <file>", "Path to custom SOUL.md file")
    .option("--format <format>", "Output format (table|json)", "table")
    .action(async (options) => {
      requireAuth();
      
      // Read soul file if provided
      let soulMd: string | undefined;
      if (options.soul) {
        try {
          soulMd = readFileSync(options.soul, "utf-8");
        } catch (error) {
          console.error(chalk.red(`Failed to read soul file: ${options.soul}`));
          process.exit(1);
        }
      }
      
      const spinner = ora("Creating instance...").start();
      
      try {
        const result = await createInstance({
          channelType: options.channel,
          personaTemplate: options.persona,
          soulMd,
        });
        spinner.stop();
        
        if (options.format === "json") {
          console.log(JSON.stringify(result, null, 2));
          return;
        }
        
        console.log(chalk.green("✓ Instance created!"));
        console.log("");
        console.log(`  ID:      ${chalk.cyan(result.id)}`);
        console.log(`  Status:  ${chalk.yellow(result.status)}`);
        if (result.ipAddress) {
          console.log(`  IP:      ${result.ipAddress}`);
        }
        console.log("");
        console.log(chalk.gray(result.message));
        console.log("");
        console.log(`Next steps:`);
        console.log(`  1. Wait for provisioning to complete`);
        console.log(`  2. Connect your ${options.channel} channel`);
        console.log(`  3. Run: ${chalk.cyan(`blitzclaw instances get ${result.id.slice(0, 8)}`)}`);
      } catch (error) {
        if (error instanceof ApiError) {
          spinner.fail("Failed to create instance");
          
          if (error.status === 402) {
            console.log("");
            console.log(chalk.yellow("⚠️  Insufficient balance"));
            console.log(chalk.gray(`Run ${chalk.cyan("blitzclaw billing topup")} to add funds`));
          } else {
            console.error(chalk.red(error.message));
          }
          process.exit(1);
        }
        spinner.fail("Failed to create instance");
        console.error(chalk.red((error as Error).message));
        process.exit(1);
      }
    });

  instances
    .command("get <id>")
    .description("Get instance details")
    .option("--format <format>", "Output format (table|json)", "table")
    .action(async (id, options) => {
      requireAuth();
      
      const spinner = ora("Fetching instance...").start();
      
      try {
        const instance = await getInstance(id);
        spinner.stop();
        
        if (options.format === "json") {
          console.log(JSON.stringify(instance, null, 2));
          return;
        }
        
        const statusColor = {
          ACTIVE: chalk.green,
          PENDING: chalk.yellow,
          PROVISIONING: chalk.yellow,
          PAUSED: chalk.red,
          STOPPED: chalk.gray,
          ERROR: chalk.red,
        }[instance.status] || chalk.white;
        
        console.log(chalk.bold("Instance Details\n"));
        console.log(`  ID:             ${chalk.cyan(instance.id)}`);
        console.log(`  Status:         ${statusColor(instance.status)}`);
        console.log(`  Channel:        ${instance.channelType}`);
        console.log(`  Persona:        ${instance.personaTemplate}`);
        console.log(`  IP Address:     ${instance.ipAddress || chalk.gray("(pending)")}`);
        console.log(`  Hetzner ID:     ${instance.hetznerServerId || chalk.gray("(pending)")}`);
        console.log(`  Created:        ${new Date(instance.createdAt).toLocaleDateString()}`);
        console.log(`  Last Updated:   ${new Date(instance.updatedAt).toLocaleDateString()}`);
        
        if (instance.lastHealthCheck) {
          console.log(`  Last Health:    ${new Date(instance.lastHealthCheck).toLocaleString()}`);
        }
        
        console.log("");
        console.log(chalk.bold("Recent Usage\n"));
        console.log(`  Cost:       $${instance.recentUsage.totalCostDollars}`);
        console.log(`  Tokens In:  ${instance.recentUsage.totalTokensIn.toLocaleString()}`);
        console.log(`  Tokens Out: ${instance.recentUsage.totalTokensOut.toLocaleString()}`);
        
        if (instance.soulMd) {
          console.log("");
          console.log(chalk.bold("SOUL.md Preview\n"));
          const preview = instance.soulMd.split("\n").slice(0, 5).join("\n");
          console.log(chalk.gray(preview));
          if (instance.soulMd.split("\n").length > 5) {
            console.log(chalk.gray("  ..."));
          }
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          spinner.fail("Instance not found");
          process.exit(1);
        }
        spinner.fail("Failed to fetch instance");
        console.error(chalk.red((error as Error).message));
        process.exit(1);
      }
    });

  instances
    .command("restart <id>")
    .description("Restart an instance")
    .action(async (id) => {
      requireAuth();
      
      const spinner = ora("Restarting instance...").start();
      
      try {
        await restartInstance(id);
        spinner.succeed("Instance restart initiated");
        console.log(chalk.gray("It may take a minute for the instance to come back online."));
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          spinner.fail("Instance not found or not running");
          process.exit(1);
        }
        spinner.fail("Failed to restart instance");
        console.error(chalk.red((error as Error).message));
        process.exit(1);
      }
    });

  instances
    .command("delete <id>")
    .description("Delete an instance")
    .option("-f, --force", "Skip confirmation")
    .action(async (id, options) => {
      requireAuth();
      
      if (!options.force) {
        // Simple confirmation without readline
        console.log(chalk.yellow(`⚠️  This will permanently delete instance ${id}`));
        console.log(chalk.gray("Use --force to skip this confirmation"));
        console.log("");
        console.log(`To confirm, run: ${chalk.cyan(`blitzclaw instances delete ${id} --force`)}`);
        return;
      }
      
      const spinner = ora("Deleting instance...").start();
      
      try {
        await deleteInstance(id);
        spinner.succeed("Instance deleted");
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          spinner.fail("Instance not found");
          process.exit(1);
        }
        spinner.fail("Failed to delete instance");
        console.error(chalk.red((error as Error).message));
        process.exit(1);
      }
    });

  return instances;
}
