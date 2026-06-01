const userAgent = process.env.npm_config_user_agent ?? "";

if (!userAgent.includes("pnpm/")) {
  console.error("This project is pinned to pnpm. Run `pnpm install` instead of npm.");
  process.exit(1);
}
