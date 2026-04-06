const GtfsRealtimeBindings = require('gtfs-realtime-bindings');
const protobuf = require('protobufjs');

const updateFeed = async () => {
  const nowDate = new Date();

  let tsV1 = {
    trains: {},
    stations: {},
    lines: {},
    lastUpdated: nowDate.toISOString(),
    shitsFucked: {
      shitIsFucked: false,
      message: ""
    }
  };

  try {
    const root = await protobuf.load('schedules.proto');
    const MultipleVehiclesScheduleMessage = root.lookupType('gobbler.MultipleVehiclesScheduleMessage');

    let fetchedData = {};
    const urlsToFetch = {
      'southshoreTimes': 'https://s3.amazonaws.com/etatransit.gtfs/southshore.etaspot.net/trip_updates.pb',
      'southshorePositions': 'https://s3.amazonaws.com/etatransit.gtfs/southshore.etaspot.net/position_updates.pb',
      'southshoreStops': 'https://gtfs.piemadd.com/data/southshore/stops.json',
      'southshoreRoutes': 'https://gtfs.piemadd.com/data/southshore/routes.json',
      'southshoreSchedule': 'http://localhost:3000/gtfs_sch_acc/southshore/scheduledVehicles',
    };
    const processRequests = {
      'southshoreTimes': (r) => r.arrayBuffer().then((buf) => GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buf))),
      'southshorePositions': (r) => r.arrayBuffer().then((buf) => GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buf))),
      'southshoreStops': (r) => r.json(),
      'southshoreRoutes': (r) => r.json(),
      'southshoreSchedule': (r) => r.json(),
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

    //filling out the stop data with our GTFS
    Object.values(fetchedData.southshoreStops).forEach((stop) => {
      tsV1.stations[stop.stopID] = {
        stationID: stop.stopID,
        stationName: stop.stopName,
        destinations: {
          Inbound: { trains: [] },
          Outbound: { trains: [] },
        },
        lat: stop.stopLat,
        lon: stop.stopLon,
        tz: stop.stopTZ,
      }
    });

    //filling out the route data with our GTFS
    Object.values(fetchedData.southshoreRoutes).forEach((route) => {
      tsV1.lines[route.routeID] = {
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
    fetchedData.southshorePositions.entity.forEach((position) => {
      vehiclePositions[position.vehicle.trip.tripId] = position.vehicle.position.toJSON();
    })

    //vehicle times
    fetchedData.southshoreTimes.entity.forEach((trip) => {
      const scheduledVehicle = fetchedData.southshoreSchedule[trip.tripUpdate.trip.tripId];

      if (!scheduledVehicle) return; // either the server is starting up or we dont have scheduled times
      
      const actualStops = trip.tripUpdate.stopTimeUpdate.map((stop) => {
        const actualStop = scheduledVehicle.predictions[stop.stopSequence - 1];

        return {
          ...stop,
          departure: {
            time: actualStop.actualETA + (stop.arrival.delay * 1000)
          },
          stopId: actualStop.stationID
        }
      });

      const route = fetchedData.southshoreRoutes[scheduledVehicle.lineCode];
      const direction = parseInt(trip.tripUpdate.trip.tripId) % 2 ? 'Outbound' : 'Inbound';
      const destination = fetchedData.southshoreStops[actualStops.slice(-1)[0].stopId].stopName;
      const position = vehiclePositions[trip.tripUpdate.trip.tripId] ?? {
        latitude: 0,
        longitude: 0,
        bearing: 0,
        fake: true,
      };

      //doing some magic to make up for a not found position
      if (position.fake) {
        const upcomingStops = actualStops.filter((stopTime) => stopTime.departure.time > nowDate.valueOf());
        const upcomingStopID = (upcomingStops.length > 0 ? upcomingStops[0] : actualStops[0]).stopId;
        const upcomingStop = fetchedData.southshoreStops[upcomingStopID];

        position.latitude = upcomingStop.stopLat;
        position.longitude = upcomingStop.stopLon;
        position.bearing = 0;
      }

      tsV1.lines[route.routeID].hasActiveTrains = true;

      tsV1.trains[trip.tripUpdate.trip.tripId] = {
        line: route.routeLongName,
        lineCode: route.routeID,
        lineColor: route.routeColor,
        lineTextColor: route.routeTextColor,
        dest: destination,
        predictions: actualStops.map((stopTime) => {

          tsV1.stations[stopTime.stopId].destinations[direction].trains.push(
            {
              runNumber: trip.tripUpdate.trip.tripId,
              actualETA: stopTime.departure.time,
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
            stationName: fetchedData.southshoreStops[stopTime.stopId].stopName,
            actualETA: stopTime.departure.time,
            noETA: false,
            realTime: true,
            tz: fetchedData.southshoreStops[stopTime.stopId].stopTZ
          }
        }),
        type: 'train',
        lat: position.latitude,
        lon: position.longitude,
        heading: position.bearing,
        realTime: true,
        deadMileage: false,
      }
    });

    // scheduled data time!
    const scheduledVehicles = fetchedData['southshoreSchedule'];

    Object.keys(scheduledVehicles)
      .sort((aTrip, bTrip) => {
        return scheduledVehicles[aTrip].predictions[0].actualETA - scheduledVehicles[bTrip].predictions[0].actualETA
      })
      .forEach((runNumber) => {
        const scheduledVehicle = scheduledVehicles[runNumber];

        if (tsV1.trains[runNumber]) return; // train exists
        tsV1.trains[runNumber] = scheduledVehicle;

        const trainDirection = parseInt(runNumber) % 2 ? 'Outbound' : 'Inbound';

        scheduledVehicle.predictions.forEach((stop) => {
          //adding stations to transitStatus object
          if (!tsV1.stations[stop.stationID]) {
            tsV1.stations[stop.stationID] = {
              stationID: stop.stationID,
              stationName: fetchedData.southshoreStops[stop.stationID].stopName,
              lat: fetchedData.southshoreStops[stop.stationID].stopLat,
              lon: fetchedData.southshoreStops[stop.stationID].stopLon,
              destinations: {
                Inbound: { trains: [] },
                Outbound: { trains: [] },
              },
              tz: 'America/New_York'
            };
          };

          if (tsV1.stations[stop.stationID].destinations[trainDirection].trains.length > 12) return; // too much!

          tsV1.stations[stop.stationID].destinations[trainDirection].trains.push({
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
      v1: tsV1,
      //v2: finalBrightlineV2,
      scheduledVehicles,
    }
  } catch (e) {
    console.log(e);
    tsV1.shitsFucked.shitIsFucked = true;
    tsV1.shitsFucked.message = 'There was an error fetching from Brightline\'s API, please try again later.'
    return {
      v1: tsV1,
    };
  }
};

exports.update = updateFeed;
