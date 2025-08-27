const GtfsRealtimeBindings = require('gtfs-realtime-bindings');
const protobuf = require('protobufjs');

// my GTFS parsing only stores the departure time of each time. even though we only show that time on TS, we want an arrival time for potential future use.
// thankfully, it seems that at each station, this time difference is static (which makes sense) so to get the arrival time, we can just subtract a set
// number of seconds from our parsed departure time.
const diffBetweenArrivalAndDeparture = {
  'MCO': 0,
  'WPT': 120,
  'RRN': 120,
  'FBT': 120,
  'AVE': 120,
  'EKW': 0,
};

const updateFeed = async () => {
  const nowDate = new Date();
  const todaysDate = new Date(new Date(nowDate).toISOString().split('T')[0] + 'T00:00:00.000Z')
  const yesterdaysDate = new Date(todaysDate.valueOf() - (1000 * 60 * 60 * 24));
  const tomorrowsDate = new Date(todaysDate.valueOf() + (1000 * 60 * 60 * 24));

  let finalBrightlineV1 = {
    trains: {},
    stations: {},
    lines: {},
    lastUpdated: nowDate.toISOString(),
    shitsFucked: {
      shitIsFucked: false,
      message: ""
    }
  };
  let finalBrightlineV2 = {
    vehicles: {},
    stations: {},
    routes: {},
    alerts: {},
    meta: {
      lastUpdated: nowDate.toISOString(),
      error: {
        shitIsFucked: false,
        message: ""
      }
    }
  };
  let platformsData = {};

  try {
    const root = await protobuf.load('schedules.proto');
    const MultipleVehiclesScheduleMessage = root.lookupType('gobbler.MultipleVehiclesScheduleMessage');

    let fetchedData = {};
    const urlsToFetch = {
      'brightlineTimes': 'http://feed.gobrightline.com/trip_updates.pb',
      'brightlinePositions': 'http://feed.gobrightline.com/position_updates.pb',
      'brightlineStops': 'https://gtfs.piemadd.com/data/brightline/stops.json',
      'brightlineRoutes': 'https://gtfs.piemadd.com/data/brightline/routes.json',
      'brightlineVehicleSchedule': 'https://gobblerstatic.transitstat.us/schedules/brightline/vehicles.pbf',
      'brightlineScheduleMetadata': 'https://gobblerstatic.transitstat.us/schedules/brightline/metadata.json',
    };
    const processRequests = {
      'brightlineTimes': (r) => r.arrayBuffer().then((buf) => GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buf))),
      'brightlinePositions': (r) => r.arrayBuffer().then((buf) => GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buf))),
      'brightlineStops': (r) => r.json(),
      'brightlineRoutes': (r) => r.json(),
      'brightlineVehicleSchedule': (r) => r.arrayBuffer().then((buf) => MultipleVehiclesScheduleMessage.decode(new Uint8Array(buf))),
      'brightlineScheduleMetadata': (r) => r.json(),
    };

    // fetching all of our data asyncronously
    const fetchedDataRes = await Promise.all(Object.keys(urlsToFetch).map((key) => fetch(urlsToFetch[key] + `?currentTime=${Date.now()}`)));

    //processing our data bit less asyncronously
    const urlKeys = Object.keys(processRequests);
    for (let i = 0; i < urlKeys.length; i++) {
      const key = urlKeys[i];
      const processed = await processRequests[key](fetchedDataRes[i]);
      fetchedData[key] = processed;
    }

    // stopping patterns for scheduled data
    let stoppingPatternTimes = {};
    fetchedData.brightlineScheduleMetadata.stoppingPatterns.forEach((pattern, patternIndex) => {
      let totalTime = 0;
      for (let i = 1; i < pattern.length; i++) totalTime += fetchedData.brightlineScheduleMetadata.stopTimes[`${pattern[i - 1]}_${pattern[i]}`];
      stoppingPatternTimes[patternIndex] = totalTime;
    });

    //fetching platform numbers using previous data
    const stationsInOrder = Object.values(fetchedData.brightlineStops);
    const platformsRes = await Promise.all(stationsInOrder.map((stop) => fetch(`https://schedules.gobrightline.com/api/schedulefordisplay?stationName=${stop.stopName}&DeparturesOrArrivals=Departures`)));
    const platformsResData = await Promise.all(platformsRes.map((res) => res.json()));
    platformsResData.forEach((station, i) => {
      const stationID = stationsInOrder[i].stopID;
      platformsData[stationID] = {};
      [station.scheduleSouth, station.scheduleNorth].flat().map((departure) => {
        platformsData[stationID][departure.scheduleNumber] = departure.track != '-' ? departure.track : '';
      })
    });

    //filling out the stop data with our GTFS
    Object.values(fetchedData.brightlineStops).forEach((stop) => {
      finalBrightlineV1.stations[stop.stopID] = {
        stationID: stop.stopID,
        stationName: stop.stopName,
        destinations: {
          Northbound: { trains: [] },
          Southbound: { trains: [] },
        },
        lat: stop.stopLat,
        lon: stop.stopLon,
        tz: stop.stopTZ,
      }
    });

    //filling out the route data with our GTFS
    Object.values(fetchedData.brightlineRoutes).forEach((route) => {
      finalBrightlineV1.lines[route.routeID] = {
        lineCode: route.routeID,
        lineNameShort: route.routeShortName,
        lineNameLong: route.routeLongName,
        routeColor: route.routeColor,
        routeTextColor: route.routeTextColor,
        stations: route.routeStations,
        hasActiveTrains: false,
      };
    });

    //storing vehicle positions
    let vehiclePositions = {};
    fetchedData.brightlinePositions.entity.forEach((position) => {
      vehiclePositions[position.vehicle.trip.tripId] = position.vehicle.position.toJSON();
    })

    //vehicle times
    fetchedData.brightlineTimes.entity.forEach((trip) => {
      const route = fetchedData.brightlineRoutes[trip.tripUpdate.trip.routeId];
      const direction = parseInt(trip.id.split('_')[0]) % 2 ? 'Southbound' : 'Northbound';
      const destination = fetchedData.brightlineStops[trip.tripUpdate.stopTimeUpdate.slice(-1)[0].stopId].stopName;
      const position = vehiclePositions[trip.id] ?? {
        latitude: 0,
        longitude: 0,
        bearing: 0,
        fake: true,
      };

      //doing some magic to make up for a not found position
      if (position.fake) {
        const upcomingStops = trip.tripUpdate.stopTimeUpdate.filter((stopTime) => (stopTime.departure ?? stopTime.arrival).time.toNumber() > nowDate.valueOf() / 1000);
        const upcomingStopID = (upcomingStops.length > 0 ? upcomingStops[0] : trip.tripUpdate.stopTimeUpdate[0]).stopId;
        const upcomingStop = fetchedData.brightlineStops[upcomingStopID];

        position.latitude = upcomingStop.stopLat;
        position.longitude = upcomingStop.stopLon;
        position.bearing = 0;
      }

      finalBrightlineV1.lines[route.routeID].hasActiveTrains = true;

      finalBrightlineV1.trains[trip.id.split('_')[0]] = {
        line: route.routeLongName,
        lineCode: route.routeID,
        lineColor: route.routeColor,
        lineTextColor: route.routeTextColor,
        dest: destination,
        predictions: trip.tripUpdate.stopTimeUpdate.map((stopTime) => {
          finalBrightlineV1.stations[stopTime.stopId].destinations[direction].trains.push(
            {
              runNumber: trip.id.split('_')[0],
              actualETA: (stopTime.departure ?? stopTime.arrival).time.toNumber() * 1000,
              arr: (stopTime.arrival ?? stopTime.departure).time.toNumber() * 1000,
              dep: (stopTime.departure ?? stopTime.arrival).time.toNumber() * 1000,
              arrDelay: (stopTime.arrival ?? stopTime.departure).delay * 1000,
              depDelay: (stopTime.departure ?? stopTime.arrival).delay * 1000,
              noETA: false,
              realTime: true,
              line: route.routeLongName,
              lineCode: route.routeID,
              lineColor: route.routeColor,
              lineTextColor: route.routeTextColor,
              destination: destination,
            }
          )

          return {
            stationID: stopTime.stopId,
            stationName: fetchedData.brightlineStops[stopTime.stopId].stopName,
            actualETA: (stopTime.departure ?? stopTime.arrival).time.toNumber() * 1000,
            arr: (stopTime.arrival ?? stopTime.departure).time.toNumber() * 1000,
            dep: (stopTime.departure ?? stopTime.arrival).time.toNumber() * 1000,
            arrDelay: (stopTime.arrival ?? stopTime.departure).delay * 1000,
            depDelay: (stopTime.departure ?? stopTime.arrival).delay * 1000,
            noETA: false,
            realTime: true,
            tz: fetchedData.brightlineStops[stopTime.stopId].stopTZ
          }
        }),
        type: 'train',
        lat: position.latitude,
        lon: position.longitude,
        heading: position.bearing,
        realTime: true,
      }
    });

    // scheduled data time!
    let scheduledVehicles = {};

    const fillInVehicleData = (vehicleSchedule, now, todayStart) => {
      const secondsSinceTodayStart = Math.floor((new Date(now).valueOf() - todayStart.valueOf()) / 1000);
      const todayStartCode = todayStart.toISOString().split('T')[0];
      const todayValidServices = fetchedData.brightlineScheduleMetadata.services[todayStartCode];

      const upcomingVehiclesWithinTimeFrame = vehicleSchedule
        .toJSON()
        .vehicleScheduleMessage
        .filter((vehicle) =>
          vehicle.startTime + stoppingPatternTimes[vehicle.vehicleStop] > secondsSinceTodayStart &&
          vehicle.startTime < secondsSinceTodayStart + (60 * 60 * 8) &&
          todayValidServices.includes(vehicle.serviceId)
        );

      upcomingVehiclesWithinTimeFrame.forEach((vehicle) => {
        const runNumber = vehicle.runNumber.split('_')[0];

        let finalScheduledVehicle = {
          line: fetchedData.brightlineRoutes[vehicle.routeId].routeLongName,
          lineCode: vehicle.routeId,
          lineColor: fetchedData.brightlineRoutes[vehicle.routeId].routeColor,
          lineTextColor: fetchedData.brightlineRoutes[vehicle.routeId].routeTextColor,
          dest: "Unknown Dest",
          predictions: [],
          type: 'train',
          lat: 0,
          lon: 0,
          heading: 0,
          realTime: false,
        };

        let currentStationTime = todayStart.valueOf() + (vehicle.startTime * 1000);
        fetchedData.brightlineScheduleMetadata.stoppingPatterns[vehicle.vehicleStop].forEach((stop, i, arr) => {
          finalScheduledVehicle.predictions.push({ //adding prediction
            stationID: stop,
            stationName: fetchedData.brightlineStops[stop].stopName,
            actualETA: currentStationTime,
            arr: currentStationTime - (diffBetweenArrivalAndDeparture[stop] * 1000),
            dep: currentStationTime,
            arrDelay: 0,
            depDelay: 0,
            noETA: false,
            realTime: false,
            tz: 'America/New_York'
          });

          if (i == arr.length - 1) { //dont have to do the next step if this is the last station
            finalScheduledVehicle.dest = fetchedData.brightlineStops[stop].stopName;
          } else { //moving time to next station
            currentStationTime += fetchedData.brightlineScheduleMetadata.stopTimes[`${stop}_${arr[i + 1]}`] * 1000;
          }
        })

        if (!scheduledVehicles[runNumber]) scheduledVehicles[runNumber] = finalScheduledVehicle;
      });


    };

    fillInVehicleData(fetchedData.brightlineVehicleSchedule, nowDate, todaysDate); //today
    fillInVehicleData(fetchedData.brightlineVehicleSchedule, nowDate, yesterdaysDate); //yesterday
    fillInVehicleData(fetchedData.brightlineVehicleSchedule, nowDate, tomorrowsDate); //tomorrow

    Object.keys(scheduledVehicles)
      .sort((aTrip, bTrip) => {
        return scheduledVehicles[aTrip].predictions[0].actualETA - scheduledVehicles[bTrip].predictions[0].actualETA
      })
      .forEach((runNumber) => {
        const scheduledVehicle = scheduledVehicles[runNumber];

        if (finalBrightlineV1.trains[runNumber]) return; // train exists
        finalBrightlineV1.trains[runNumber] = scheduledVehicle;

        const trainDirection = parseInt(runNumber) % 2 ? 'Southbound' : 'Northbound';

        scheduledVehicle.predictions.forEach((stop) => {
          //adding stations to transitStatus object
          if (!finalBrightlineV1.stations[stop.stationID]) {
            finalBrightlineV1.stations[stop.stationID] = {
              stationID: stop.stationID,
              stationName: fetchedData.brightlineStops[stop.stationID].stopName,
              lat: fetchedData.brightlineStops[stop.stationID].stopLat,
              lon: fetchedData.brightlineStops[stop.stationID].stopLon,
              destinations: {
                Northbound: { trains: [] },
                Southbound: { trains: [] },
              },
              tz: 'America/New_York'
            };
          };

          if (finalBrightlineV1.stations[stop.stationID].destinations[trainDirection].trains.length > 12) return; // too much!

          finalBrightlineV1.stations[stop.stationID].destinations[trainDirection].trains.push({
            runNumber: runNumber,
            actualETA: stop.actualETA,
            noETA: false,
            realTime: false,
            line: scheduledVehicle.line,
            lineCode: scheduledVehicle.lineCode,
            lineColor: scheduledVehicle.lineColor,
            lineTextColor: scheduledVehicle.lineTextColor,
            destination: scheduledVehicle.dest,
            extra: {},
          });
        });
      })

    return {
      v1: finalBrightlineV1,
      //v2: finalBrightlineV2,
      platforms: platformsData,
      scheduledVehicles,
    }
  } catch (e) {
    console.log(e);
    finalBrightlineV1.shitsFucked.shitIsFucked = true;
    finalBrightlineV1.shitsFucked.message = 'There was an error fetching from Brightline\'s API, please try again later.'
    return {
      v1: finalBrightlineV1,
      platforms: platformsData,
    };
  }
};

exports.update = updateFeed;
