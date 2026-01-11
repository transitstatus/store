const protobuf = require('protobufjs');

const updateFeed = async (feed) => {
  if (feed == 'southshore') return false;

  try {
    const nowDate = new Date();
    const todaysDate = new Date(new Date(nowDate).toISOString().split('T')[0] + 'T00:00:00.000Z')
    const yesterdaysDate = new Date(todaysDate.valueOf() - (1000 * 60 * 60 * 24));
    const tomorrowsDate = new Date(todaysDate.valueOf() + (1000 * 60 * 60 * 24));

    const root = await protobuf.load('schedules.proto');
    const MultipleVehiclesScheduleMessage = root.lookupType('gobbler.MultipleVehiclesScheduleMessage');
    const ScheduleMessage = root.lookupType('gobbler.ScheduleMessage');

    const [
      staticStopsData,
      staticRoutesData,
      staticMetaData,
    ] = await Promise.all([
      `https://gtfs.piemadd.com/data/${feed}/stops.json`,
      `https://gtfs.piemadd.com/data/${feed}/routes.json`,
      `https://gobblerstatic.transitstat.us/schedules/${feed}/metadata.json`,
    ].map((url) =>
      fetch(url).then(res => res.json())
    ));

    const [
      todaysStopData,
      yesterdaysStopData,
      tomorrowsStopData,
    ] = await Promise.all([
      `https://gobblerstatic.transitstat.us/schedules/${feed}/${todaysDate.toISOString().split('T')[0]}.pbf`,
      `https://gobblerstatic.transitstat.us/schedules/${feed}/${yesterdaysDate.toISOString().split('T')[0]}.pbf`,
      `https://gobblerstatic.transitstat.us/schedules/${feed}/${tomorrowsDate.toISOString().split('T')[0]}.pbf`,
    ].map((url) =>
      fetch(url)
        .then(res => res.arrayBuffer())
        .then(arrayBuffer => ScheduleMessage.decode(new Uint8Array(arrayBuffer)))
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

    let scheduledVehicles = {};

    const fillInScheduleData = (dateSchedule, now, todayStart) => {
      let individualTrains = {};

      const todayStartNumber = todayStart.valueOf();
      const nowNumber = now.valueOf();

      dateSchedule.toJSON().stopMessage.forEach((stop) => {
        const stopData = staticStopsData[stop.stopId]

        let currentTimeDiff = todayStartNumber;
        let runNumber = null;
        let headsign = null;
        let route = null;

        (stop.trainMessage ?? []).forEach((train) => {
          currentTimeDiff += train.timeDiff;
          if ('runNumber' in train) runNumber = train.runNumber;
          if ('headsignId' in train) headsign = staticMetaData.headsigns[train.headsignId];
          if ('routeId' in train) route = staticRoutesData[staticMetaData.routes[train.routeId]];

          if (!individualTrains[runNumber]) individualTrains[runNumber] = {
            lat: 0,
            lon: 0,
            heading: 0,
            realTime: false,
            deadMileage: true,
            line: route.routeLongName,
            lineCode: route.routeID,
            lineColor: route.routeColor,
            lineTextColor: route.routeTextColor,
            dest: headsign,
            predictions: [],
            type: 'train',
            extra: {}
          };

          individualTrains[runNumber].predictions.push({
            stationID: stop.stopId,
            stationName: stopData.stopName,
            actualETA: todayStartNumber + currentTimeDiff,
            noETA: false,
            realTime: false,
          })
        });
      });

      Object.keys(individualTrains).forEach((runNumber) => {
        individualTrains[runNumber].predictions = individualTrains[runNumber].predictions.sort((a, b) =>
          a.actualETA - b.actualETA,
        )

        const firstStop = individualTrains[runNumber].predictions[0];
        const lastStop = individualTrains[runNumber].predictions[individualTrains[runNumber].predictions.length - 1];

        if (
          nowNumber < lastStop.actualETA &&
          nowNumber + (1000 * 60 * 60 * 24) >= firstStop.actualETA &&
          !scheduledVehicles[runNumber]
        ) {
          scheduledVehicles[runNumber] = individualTrains[runNumber];
        }
      });

      //console.log(individualTrains)
    };

    const fillInVehicleData = (vehicleSchedule, now, todayStart) => {
      const secondsSinceTodayStart = Math.floor((new Date(now).valueOf() - todayStart.valueOf()) / 1000);
      const todayStartCode = todayStart.toISOString().split('T')[0];
      const todayValidServices = staticMetaData.services[todayStartCode];

      const upcomingVehiclesWithinTimeFrame = vehicleSchedule
        .toJSON()
        .vehicleScheduleMessage
        .filter((vehicle) =>
          vehicle.startTime + stoppingPatternTimes[vehicle.vehicleStop] > secondsSinceTodayStart &&
          vehicle.startTime < secondsSinceTodayStart + (60 * 60 * 24) &&
          todayValidServices.includes(vehicle.serviceId)
        );

      upcomingVehiclesWithinTimeFrame.forEach((vehicle) => {
        const runNumber = vehicle.runNumber;

        let finalScheduledVehicle = {
          lat: 0,
          lon: 0,
          heading: 0,
          realTime: false,
          deadMileage: true,
          line: [vehicle.routeId].routeLongName,
          lineCode: vehicle.routeId,
          lineColor: staticRoutesData[vehicle.routeId].routeColor,
          lineTextColor: staticRoutesData[vehicle.routeId].routeTextColor,
          dest: "Unknown Dest",
          predictions: [],
          type: 'train',
          extra: {}
        };

        let currentStationTime = todayStart.valueOf() + (vehicle.startTime * 1000);
        staticMetaData.stoppingPatterns[vehicle.vehicleStop].forEach((stop, i, arr) => {
          finalScheduledVehicle.predictions.push({ //adding prediction
            stationID: stop,
            stationName: staticStopsData[stop].stopName,
            actualETA: currentStationTime,
            noETA: false,
            realTime: false,
          });

          if (i == arr.length - 1) { //dont have to do the next step if this is the last station
            finalScheduledVehicle.dest = staticStopsData[stop].stopName;
          } else { //moving time to next station
            currentStationTime += staticMetaData.stopTimes[`${stop}_${arr[i + 1]}`] * 1000;
          }
        })

        if (!scheduledVehicles[runNumber]) scheduledVehicles[runNumber] = finalScheduledVehicle;
      });


    };

    fillInScheduleData(todaysStopData, nowDate, todaysDate);
    fillInScheduleData(todaysStopData, nowDate, todaysStopData);
    fillInScheduleData(todaysStopData, nowDate, tomorrowsDate);

    //fillInVehicleData(vehicleSchedule, nowDate, todaysDate); //today
    //fillInVehicleData(vehicleSchedule, nowDate, yesterdaysDate); //yesterday
    //fillInVehicleData(vehicleSchedule, nowDate, tomorrowsDate); //tomorrow

    return {
      scheduledVehicles,
    };
  } catch (e) {
    console.log(e);
    console.log(feed)
    return {
      scheduledVehicles: {}
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
