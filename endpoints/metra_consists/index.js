const { XMLParser } = require("fast-xml-parser");

const xmlParser = new XMLParser();

const recursivelyParseTrains = (h2) => {
  let consists = [];

  const thisConsistRaw = h2?.span?.["#text"];

  if (thisConsistRaw) consists.push(thisConsistRaw.split("Cars: ")[1].replace(")", ""));

  if (h2?.h2) consists.push(...recursivelyParseTrains(h2?.h2));

  return consists;
};

const update = async (updateObject) => {
  console.log(updateObject);

  let returnObject = { ...updateObject.lastState };
  let alreadyFetchedPairs = {};

  if (!returnObject.consists) returnObject.consists = {};

  //const METRA_TS_URL = "https://store.transitstat.us/metra/transitStatus";
  const METRA_TS_URL = 'http://localhost:3000/metra/transitStatus';

  try {
    const now = new Date();

    const metraTrains = await fetch(`${METRA_TS_URL}/trains`).then((res) => res.json());
    const metraTrainIDs = Object.keys(metraTrains);

    for (let i = 0; i < metraTrainIDs.length; i++) {
      const trainID = metraTrainIDs[i];
      const train = metraTrains[trainID];

      if (!train.realTime) continue; // scheduled
      if (train.predictions.length < 2) continue; // not enough data to fetch train info

      const nextToLastStop = train.predictions.at(-2);
      const lastStop = train.predictions.at(-1);

      if (alreadyFetchedPairs[`${train.lineCode}-${nextToLastStop.stationID}-${lastStop.stationID}`]) continue; // already fetched

      const rawTrainInfo = await fetch(
        `https://metratracker.com/bustime/wireless/html/eta.jsp?route=${train.lineCode}&id=${nextToLastStop.stationID}&originstop=${nextToLastStop.stationName}&destinationstop=${lastStop.stationName}&destinationid=${nextToLastStop.stationID}`
      ).then((res) => res.text());

      if (rawTrainInfo.includes("No service is scheduled for this station at this time.")) continue; // no trains listed

      const rawTrainParsed = xmlParser.parse(rawTrainInfo);

      const thisFetchConsists = recursivelyParseTrains(rawTrainParsed?.html?.body?.h2);

      thisFetchConsists.forEach((consist) => {
        returnObject.consists[consist] = {
          cars: consist.split("-"),
        };
      });

      alreadyFetchedPairs[`${train.lineCode}-${nextToLastStop.stationID}-${lastStop.stationID}`] = true;
    }

    returnObject.lastUpdated = now.toISOString();
    return returnObject;
  } catch (e) {
    console.log(e);
    return false;
  }
};

exports.update = update;
