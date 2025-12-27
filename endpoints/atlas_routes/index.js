const protobuf = require('protobufjs');

const updateFeed = async (feed) => {
  //DEBUG
  //if (feed != 'via_rail') return false;

  try {
    const root = await protobuf.load('schedules.proto');
    const MultipleVehiclesScheduleMessage = root.lookupType('gobbler.MultipleVehiclesScheduleMessage');

    const [
      //staticStopsData,
      staticRoutesData,
      staticSegmentsData,
      staticMetaData,
    ] = await Promise.all([
      //`https://gtfs.piemadd.com/data/${feed}/stops.json`,
      `https://gtfs.piemadd.com/data/${feed}/routes.json`,
      `https://gtfs.piemadd.com/data/${feed}/segments.json`,
      `https://gobblerstatic.transitstat.us/schedules/${feed}/metadata.json`,
    ].map((url) =>
      fetch(url).then(res => res.json())
    ));

    const vehicleSchedule = await fetch(`https://gobblerstatic.transitstat.us/schedules/${feed}/vehicles.pbf`)
      .then(res => res.arrayBuffer())
      .then(arrayBuffer => MultipleVehiclesScheduleMessage.decode(new Uint8Array(arrayBuffer)));

    let stoppingPatternTimes = {};
    staticMetaData.stoppingPatterns.forEach((pattern, patternIndex) => {
      let totalTime = 0;
      for (let i = 1; i < pattern.length; i++) totalTime += staticMetaData.stopTimes[`${pattern[i - 1]}_${pattern[i]}`];
      stoppingPatternTimes[patternIndex] = totalTime;
    });
    
    let routeDataFinal = {};
    let tripToRoute = {};

    vehicleSchedule
      .toJSON()
      .vehicleScheduleMessage
      .filter((vehicle) => {
        if (vehicle.runNumber == '97-64' || vehicle.runNumber == '98-63') return false;
        return true;
      })
      .forEach((vehicle, i) => {
        if (!routeDataFinal[vehicle.routeId]) {
          routeDataFinal[vehicle.routeId] = {
            ...staticRoutesData[vehicle.routeId],
            distanceBetweenStops: [], // eh
            routeTrips: {},
          }
        }

        if (routeDataFinal[vehicle.routeId].routeTrips[vehicle.runNumber]) return;
        routeDataFinal[vehicle.routeId].routeTrips[vehicle.runNumber] = {
          trainNum: vehicle.runNumber,
          stoppingPattern: staticMetaData.stoppingPatterns[vehicle.vehicleStop],
        }
        tripToRoute[`${vehicle.routeId}_${vehicle.runNumber}`] = vehicle.routeId;
      });

    return {
      routeDataFinal,
      segments: staticSegmentsData.segments,
      tripToRoute
    };
  } catch (e) {
    console.log(e);
    console.log(feed);
    return {
      routeDataFinal: {},
      tripToRoute: {},
      segments: {},
    };
  }
};

const updateFeedInd = async (feedKey) => {
  //if (feedKey != '') return false;

  console.time(`GTFS schedules for ${feedKey}`);
  const feedData = await updateFeed(feedKey);
  console.timeEnd(`GTFS schedules for ${feedKey}`);

  return feedData;
}

exports.update = updateFeedInd;
