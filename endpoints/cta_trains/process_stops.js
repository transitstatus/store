const fs = require("fs");

const platformsRaw = fs.readFileSync(`${__dirname}/stop_platforms.txt`, { encoding: "utf8" }).split("\n");
const platformMerges = JSON.parse(fs.readFileSync(`${__dirname}/stop_platform_merges.json`, { encoding: "utf8" }));
let finalPlatforms = {};
let stationStopCount = {};

console.log(platformMerges);

const platformNameRegex = /\((?![\s\S]*\()[^\)]*\)/;

platformsRaw.forEach((rawPlatform) => {
  const platformParts = rawPlatform.split(" ");

  const stopID = platformParts.splice(0, 1)[0];
  const stopDirection = platformParts.splice(0, 1)[0];
  const stationID = platformParts.splice(-1, 1)[0];

  let newRawPlatform = platformParts.join(" ");

  const matchedRawPlatformName = newRawPlatform.match(platformNameRegex);
  const actualPlatformName = matchedRawPlatformName[0].replace("(", "").replace(")", "").replace("-bound", " Bound");

  const stopName = newRawPlatform.replace(matchedRawPlatformName[0], "").trim();

  if (!stationStopCount[stationID]) stationStopCount[stationID] = 0;
  stationStopCount[stationID]++;

  finalPlatforms[stopID] = {
    stopID,
    //stopDirection,
    parentStationID: stationID,
    platformName: platformMerges[stopID] ?? actualPlatformName,
    stopName
  };
});

fs.writeFileSync(`${__dirname}/stop_platforms.json`, JSON.stringify(finalPlatforms, null, 2), { encoding: "utf8" });

Object.keys(stationStopCount).forEach((stationID) => {
  if (stationStopCount[stationID] <= 2) return;
  //console.log(stationID, stationStopCount[stationID]);
});
