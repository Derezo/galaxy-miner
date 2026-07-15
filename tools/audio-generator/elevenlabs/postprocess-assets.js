#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const {
  COLLECTIONS,
  getCategoryAssets,
  getRuntimeOptions,
  trimMp3ToActiveDuration,
  writeFileAtomically,
} = require("./generate");

function optionValue(args, option) {
  const index = args.indexOf(option);
  return index === -1 ? undefined : args[index + 1];
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

  const options = getRuntimeOptions();
  const assets = categories.flatMap((category) => getCategoryAssets(category));
  let processed = 0;

  for (const asset of assets) {
    const filename = path.join(outputBase, asset.relativePath);
    if (!fs.existsSync(filename)) {
      console.error(`Missing asset: ${asset.relativePath}`);
      return 1;
    }

    try {
      const output = trimMp3ToActiveDuration(fs.readFileSync(filename), asset, options);
      writeFileAtomically(filename, output);
      processed++;
    } catch (error) {
      console.error(`Could not process ${asset.relativePath}: ${error.message}`);
      return 1;
    }
  }

  console.log(`Post-processed ${processed} ${collectionName} assets.`);
  return 0;
}

if (require.main === module) process.exitCode = main();

module.exports = { main };
