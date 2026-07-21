const { viaTrainNames } = require("./viaTrainNames.js");

const providers = { amtrak: "Amtrak", brightline: "Brightline", via_rail: "Via" };

const updateFeed = async (feed) => {
  //DEBUG
  //if (feed != "brightline") return false;

  try {
    const [staticStopsData, staticRoutesData, staticMetaData, atlasNextDeps, atlasRoutesData, amtrakerStopsData] =
      await Promise.all(
        [
          `https://gtfs.piemadd.com/data/${feed}/stops.json`,
          `https://gtfs.piemadd.com/data/${feed}/routes.json`,
          `https://gobblerstatic.transitstat.us/schedules/${feed}/metadata.json`,
          `https://gobblerstatic.transitstat.us/schedules/${feed}/nextDeps.json`,
          `http://localhost:3000/atlas_routes/${feed}/routeDataFinal`,
          `https://api.amtraker.com/v3/stations`
        ].map((url) => fetch(url).then((res) => res.json()))
      );

    let shortTripToTrip = {};
    Object.values(atlasNextDeps).forEach((trip) => {
      shortTripToTrip[trip.trip.shortTripID] = trip.trip.tripID;
    });

    const trainNumPrefix = feed.substring(0, 1).replace("a", "");
    const stopIDPrefix = feed == "brightline" ? "B" : "";

    let trainsByNum = {};
    let trainsByName = {};

    Object.values(atlasRoutesData).forEach((route) => {
      const routeTrips = Object.keys(route.routeTrips);

      let actualTrainName =
        feed == "via_rail" && viaTrainNames[routeTrips[0]] ? viaTrainNames[routeTrips[0]] : route.routeLongName.replace('Amtrak', '').trim();

      if (!trainsByName[actualTrainName]) {
        trainsByName[actualTrainName] = {
          routeName: actualTrainName,
          trainNums: [],
          stations: [],
          provider: providers[feed]
        };
      }

      trainsByName[actualTrainName].stations.push(...route.routeStations);

      routeTrips.forEach((trainNum) => {
        const realTrainNum = `${trainNumPrefix}${trainNum}`;

        trainsByName[actualTrainName].trainNums.push(realTrainNum);

        const thisTrain = route.routeTrips[trainNum];
        trainsByNum[realTrainNum] = {
          routeName: actualTrainName,
          trainNum: realTrainNum,
          trainNumRaw: trainNum,
          origIndex: 0,
          provider: providers[feed],
          destIndex: thisTrain.stoppingPattern.length - 1,
          stops: thisTrain.stoppingPattern.map((code) => {
            const thisStop = amtrakerStopsData[code];
            const thisStopAlt = staticStopsData[code];
            return {
              name: thisStop?.name ?? thisStopAlt?.stopName,
              code: code,
              tz: thisStop?.tz ?? thisStopAlt?.stopTZ
            };
          }),
          nextDep: atlasNextDeps[shortTripToTrip[trainNum]]?.time ?? null
        };
      });
    });

    Object.keys(trainsByName).forEach((trainName) => {
      trainsByName[trainName].stations = [...new Set(trainsByName[trainName].stations)].sort().map((code) => {
        const thisStop = amtrakerStopsData[code];
        const thisStopAlt = staticStopsData[code];
        return { name: thisStop?.name ?? thisStopAlt?.stopName, code: code, tz: thisStop?.tz ?? thisStopAlt?.stopTZ };
      });
    });

    return { trainsByNum, trainsByName };
  } catch (e) {
    console.log(e);
    console.log(feed);
    return { trainsByNum: {} };
  }
};

const updateFeedInd = async (feedKey) => {
  const feedData = await updateFeed(feedKey);
  return feedData;
};

exports.update = updateFeedInd;
