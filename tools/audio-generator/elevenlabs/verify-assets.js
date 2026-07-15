#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { COLLECTIONS, getCategoryAssets } = require("./generate");

function optionValue(args, option) {
  const index = args.indexOf(option);
  return index === -1 ? undefined : args[index + 1];
}

function fail(message, errors) {
  errors.push(message);
}

function verifyAsset(asset, outputBase, errors) {
  const filename = path.join(outputBase, asset.relativePath);
  if (!fs.existsSync(filename)) {
    fail(`${asset.relativePath}: missing`, errors);
    return null;
  }

  const probe = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_name,sample_rate,channels:format=duration",
      "-of",
      "json",
      filename,
    ],
    { encoding: "utf8" }
  );
  if (probe.error || probe.status !== 0) {
    fail(`${asset.relativePath}: ffprobe could not decode the file`, errors);
    return null;
  }

  let metadata;
  try {
    metadata = JSON.parse(probe.stdout);
  } catch {
    fail(`${asset.relativePath}: ffprobe returned invalid metadata`, errors);
    return null;
  }

  const stream = metadata.streams?.[0];
  const duration = Number(metadata.format?.duration);
  if (stream?.codec_name !== "mp3") {
    fail(`${asset.relativePath}: expected MP3 codec`, errors);
  }
  if (stream?.sample_rate !== "44100" || stream?.channels !== 1) {
    fail(`${asset.relativePath}: expected 44.1 kHz mono audio`, errors);
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    fail(`${asset.relativePath}: invalid duration`, errors);
  }
  if (
    Number.isFinite(duration) &&
    typeof asset.activeDuration === "number" &&
    duration > asset.activeDuration + 0.1
  ) {
    fail(
      `${asset.relativePath}: ${duration.toFixed(3)}s exceeds the active-duration allowance`,
      errors
    );
  }

  const volume = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostats",
      "-i",
      filename,
      "-af",
      "volumedetect",
      "-f",
      "null",
      "-",
    ],
    { encoding: "utf8" }
  );
  const levels = [...(volume.stderr || "").matchAll(/mean_volume: ([^ ]+) dB/g)];
  const peaks = [...(volume.stderr || "").matchAll(/max_volume: ([^ ]+) dB/g)];
  const meanVolume = Number(levels.at(-1)?.[1]);
  const maxVolume = Number(peaks.at(-1)?.[1]);
  if (
    volume.error ||
    volume.status !== 0 ||
    !Number.isFinite(meanVolume) ||
    !Number.isFinite(maxVolume)
  ) {
    fail(`${asset.relativePath}: audio is silent or failed full decode`, errors);
  } else if (maxVolume > -1 || maxVolume < -12) {
    fail(
      `${asset.relativePath}: peak ${maxVolume.toFixed(1)} dB is outside the safe range`,
      errors
    );
  }

  return { relativePath: asset.relativePath, duration, meanVolume, maxVolume };
}

function main(args = process.argv.slice(2)) {
  const collectionName = optionValue(args, "--collection") || "weapon-ui";
  const outputBase = path.resolve(
    optionValue(args, "--output-dir") ||
      path.join(__dirname, "../../../client/assets/audio")
  );
  const categories = COLLECTIONS[collectionName];
  if (!categories) {
    console.error(`Unknown collection: ${collectionName}`);
    return 1;
  }

  const assets = categories.flatMap((category) => getCategoryAssets(category));
  const errors = [];
  const results = assets
    .map((asset) => verifyAsset(asset, outputBase, errors))
    .filter(Boolean);

  if (errors.length > 0) {
    errors.forEach((error) => console.error(`  [ERR] ${error}`));
    return 1;
  }

  const durations = results.map((result) => result.duration);
  const levels = results.map((result) => result.meanVolume);
  const peaks = results.map((result) => result.maxVolume);
  if (args.includes("--verbose")) {
    for (const result of results) {
      console.log(
        `${result.relativePath}: ${result.duration.toFixed(3)}s, ` +
          `mean ${result.meanVolume.toFixed(1)} dB, peak ${result.maxVolume.toFixed(1)} dB`
      );
    }
  }
  console.log(
    `Verified ${results.length} MP3 assets: ` +
      `${Math.min(...durations).toFixed(3)}-${Math.max(...durations).toFixed(3)}s, ` +
      `mean levels ${Math.min(...levels).toFixed(1)} to ${Math.max(...levels).toFixed(1)} dB, ` +
      `peaks ${Math.min(...peaks).toFixed(1)} to ${Math.max(...peaks).toFixed(1)} dB.`
  );
  return 0;
}

if (require.main === module) process.exitCode = main();

module.exports = { main, verifyAsset };
