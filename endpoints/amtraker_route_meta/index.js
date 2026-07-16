const updateFeed = async (feed) => {
  //DEBUG
  //if (feed != "amtrak") return false;

  try {
    const [staticStopsData, staticRoutesData, staticMetaData, atlasRoutesData, amtrakerStopsData] = await Promise.all(
      [
        `https://gtfs.piemadd.com/data/${feed}/stops.json`,
        `https://gtfs.piemadd.com/data/${feed}/routes.json`,
        `https://gobblerstatic.transitstat.us/schedules/${feed}/metadata.json`,
        `http://localhost:3000/atlas_routes/${feed}/routeDataFinal`,
        `https://api.amtraker.com/v3/stations`
      ].map((url) => fetch(url).then((res) => res.json()))
    );

    const trainNumPrefix = feed.substring(0, 1).replace("a", "");
    const stopIDPrefix = feed == "brightline" ? "B" : "";

    let trainsByNum = {};

    Object.values(atlasRoutesData).forEach((route) => {
      Object.keys(route.routeTrips).forEach((trainNum) => {
        const realTrainNum = `${trainNumPrefix}${trainNum}`;
        const thisTrain = route.routeTrips[trainNum];
        trainsByNum[realTrainNum] = {
          routeName: route.routeLongName,
          trainNum: realTrainNum,
          trainNumRaw: trainNum,
          origIndex: 0,
          destIndex: thisTrain.stoppingPattern.length - 1,
          stops: thisTrain.stoppingPattern.map((code) => {
            const thisStop = amtrakerStopsData[code];
            const thisStopAlt = staticStopsData[code];
            return {
              name: thisStop?.name ?? thisStopAlt?.stopName,
              code: code,
              tz: thisStop?.tz ?? thisStopAlt?.stopTZ
            };
          })
        };
      });
    });

    return { trainsByNum };
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
