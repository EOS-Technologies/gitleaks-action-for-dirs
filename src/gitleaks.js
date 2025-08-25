// Copyright © 2022 Gitleaks LLC - All Rights Reserved.
// You may use this code under the terms of the GITLEAKS-ACTION END-USER LICENSE AGREEMENT.
// You should have received a copy of the GITLEAKS-ACTION END-USER LICENSE AGREEMENT with this file.
// If not, please visit https://gitleaks.io/COMMERCIAL-LICENSE.txt.

const exec = require("@actions/exec");
const cache = require("@actions/cache");
const core = require("@actions/core");
const tc = require("@actions/tool-cache");
const os = require("os");
const path = require("path");

const EXIT_CODE_LEAKS_DETECTED = 2;

// TODO: Make a gitleaks class with an octokit attribute so we don't have to pass in the octokit to every method.

// Install will download the version of gitleaks specified in GITLEAKS_VERSION
// or use the latest version of gitleaks if GITLEAKS_VERSION is not specified.
// This function will also cache the downloaded gitleaks binary in the tool cache.
async function Install(version) {
  const pathToInstall = path.join(os.tmpdir(), `gitleaks-${version}`);
  core.info(
    `Version to install: ${version} (target directory: ${pathToInstall})`
  );
  const cacheKey = `gitleaks-cache-${version}-${process.platform}-${process.arch}`;
  let restoredFromCache = undefined;
  try {
    restoredFromCache = await cache.restoreCache([pathToInstall], cacheKey);
  } catch (error) {
    core.warning(error);
  }

  if (restoredFromCache !== undefined) {
    core.info(`Gitleaks restored from cache`);
  } else {
    const gitleaksReleaseURL = downloadURL(
      process.platform,
      process.arch,
      version
    );
    core.info(`Downloading gitleaks from ${gitleaksReleaseURL}`);
    let downloadPath = "";
    try {
      downloadPath = await tc.downloadTool(
        gitleaksReleaseURL,
        path.join(os.tmpdir(), `gitleaks.tmp`)
      );
    } catch (error) {
      core.error(
        `could not install gitleaks from ${gitleaksReleaseURL}, error: ${error}`
      );
    }

    if (gitleaksReleaseURL.endsWith(".zip")) {
      await tc.extractZip(downloadPath, pathToInstall);
    } else if (gitleaksReleaseURL.endsWith(".tar.gz")) {
      await tc.extractTar(downloadPath, pathToInstall);
    } else {
      core.error(`Unsupported archive format: ${gitleaksReleaseURL}`);
    }

    try {
      await cache.saveCache([pathToInstall], cacheKey);
    } catch (error) {
      core.warning(error);
    }
  }

  core.addPath(pathToInstall);
}

function downloadURL(platform, arch, version) {
  const baseURL = "https://github.com/zricethezav/gitleaks/releases/download";
  if (platform == "win32") {
    platform = "windows";
  }
  return `${baseURL}/v${version}/gitleaks_${version}_${platform}_${arch}.tar.gz`;
}

async function Latest(octokit) {
  // docs: https://octokit.github.io/rest.js/v18#repos-get-latest-release
  const latest = await octokit.rest.repos.getLatestRelease({
    owner: "zricethezav",
    repo: "gitleaks",
  });

  return latest.data.tag_name.replace(/^v/, "");
}

async function Scan(path, configurationPath) {
  let args = [];

  if (!path) {
    core.error("No path provided");
    return 1;
  }

  args.push("dir", "--redact", "-v", "--exit-code=2", "--log-level=debug");
  if (configurationPath) {
    args.push("--config", configurationPath);
  }
  args.push(path);

  core.info(`gitleaks cmd: gitleaks ${args.join(" ")}`);
  let exitCode = await exec.exec("gitleaks", args, {
    ignoreReturnCode: true,
    delay: 60 * 1000,
  });
  core.setOutput("exit-code", exitCode);

  return exitCode;
}

module.exports.Scan = Scan;
module.exports.Latest = Latest;
module.exports.Install = Install;
module.exports.EXIT_CODE_LEAKS_DETECTED = EXIT_CODE_LEAKS_DETECTED;
