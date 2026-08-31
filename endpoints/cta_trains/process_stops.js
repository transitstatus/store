const fs = require("fs");

const platformsRaw = fs.readFileSync(`${__dirname}/stop_platforms.txt`, { encoding: "utf8" }).split("\n");

let finalPlatforms = {};

const platformNameRegex = /\((?![\s\S]*\()[^\)]*\)/;

const processPlatform = (rawPlatform) => {
  const platformParts = rawPlatform.split(" ");

  const stopID = platformParts.splice(0, 1)[0];
  const stopDirection = platformParts.splice(0, 1)[0];
  const stationID = platformParts.splice(-1, 1)[0];

  let newRawPlatform = platformParts.join(' ');
  
  const matchedRawPlatformName = newRawPlatform.match(platformNameRegex);
  const actualPlatformName = matchedRawPlatformName[0].replace("(", "").replace(")", "").replace("-bound", " Bound");

  const stopName = newRawPlatform.replace(matchedRawPlatformName[0], '').trim();

  finalPlatforms[stopID] = {
    stopID,
    //stopDirection,
    parentStationID: stationID,
    platformName: actualPlatformName,
    stopName
  };
};

platformsRaw.forEach(processPlatform);

fs.writeFileSync(`${__dirname}/stop_platforms.json`, JSON.stringify(finalPlatforms, null, 2), { encoding: "utf8" });
