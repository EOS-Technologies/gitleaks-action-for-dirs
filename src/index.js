const core = require("@actions/core");
const gitleaks = require("./gitleaks.js");

async function start() {
  let exitCode = 0;

  let gitleaksVersion = process.env.GITLEAKS_VERSION || "8.24.3";
  if (gitleaksVersion === "latest") {
    gitleaksVersion = await gitleaks.Latest(octokit);
  }
  core.info("gitleaks version: " + gitleaksVersion);
  const gitleaksPath = await gitleaks.Install(gitleaksVersion);
  core.info("gitleaks path: " + gitleaksPath);

  exitCode = await gitleaks.Scan(
    process.env.GITLEAKS_DIRECTORY_TO_SCAN_PATH
  );

  if (exitCode == 0) {
    core.info("✅ No leaks detected");
  } else if (exitCode == gitleaks.EXIT_CODE_LEAKS_DETECTED) {
    core.warning("🛑 Leaks detected, see job summary for details");
    process.exit(1);
  } else {
    core.error(`ERROR: Unexpected exit code [${exitCode}]`);
    process.exit(exitCode);
  }
}

start();