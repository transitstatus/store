const stopPlatforms = require("./stop_platforms.json");
const protobuf = require("protobufjs");

const actualLines = { R: "Red", P: "Purple", Y: "Yellow", B: "Blue", V: "Pink", G: "Green", T: "Brown", O: "Orange" };
const validLines = { Red: "R", P: "P", Y: "Y", Blue: "B", Pink: "V", G: "G", Brn: "T", Org: "O" };
const validLinesReverse = { R: "Red", P: "P", Y: "Y", B: "Blue", V: "Pink", G: "G", T: "Brn", O: "Org" };
const lineShortNames = { Red: "Red", P: "Pur", Y: "Yel", Blue: "Blu", Pink: "Pnk", G: "Grn", Brn: "Brn", Org: "Org" };

const regularDestinations = [
  "Howard",
  "95th/Dan Ryan",
  "Linden",
  "54th/Cermak",
  "Kimball",
  "Midway",
  "Loop",
  "Harlem/Lake",
  "Ashland/63rd",
  "Cottage Grove",
  "Forest Park",
  "O'Hare",
  "UIC-Halsted",
  "Dempster-Skokie",
  "Skokie"
];

const actualDestinationsFromGTFS = {
  Howard: "Howard",
  "95th/Dan Ryan": "95th/Dan Ryan",
  Linden: "Linden",
  "54th/Cermak": "54th/Cermak",
  Kimball: "Kimball",
  Midway: "Midway",
  Loop: "Loop",
  "Harlem/Lake": "Harlem/Lake",
  "Ashland/63rd": "Ashland/63rd",
  "Cottage Grove": "Cottage Grove",
  "Forest Park": "Forest Park",
  "O'Hare": "O'Hare",
  "UIC-Halsted": "UIC-Halsted",
  "Dempster-Skokie": "Dempster-Skokie",
  Skokie: "Skokie"
};

const scheduleRelationshipEnums = {
  0: "SCHEDULED",
  2: "UNSCHEDULED",
  3: "CANCELED",
  4: "REPLACEMENT",
  5: "DUPLICATED",
  6: "NEW",
  7: "DELETED"
};

const inTheLoop = [40040, 40160, 40260, 40380, 40680, 40730, 40850, 41700];

const lineMeta = {
  P: { loopLimit: 40460, postLoopAlt: "Linden" },
  Pink: { loopLimit: 41160, postLoopAlt: "54th/Cermak" },
  Brn: { loopLimit: 40460, postLoopAlt: "Kimball" },
  Org: { loopLimit: 41400, postLoopAlt: "Midway" }
};

let stationToStopDict = {};

const processData = async () => {
  try {
    const gtfsRealtimeRoot = await protobuf.load("gtfs-rt.proto");
    const FeedMessage = gtfsRealtimeRoot.lookupType("transit_realtime.FeedMessage");

    const fetchRealtimeFromURL = (url) => {
      return fetch(url)
        .then((res) => {
          if (!res.ok) {
            res.text().then(console.log);
            throw new Error("Invalid response from CTA GTFS-RT API.");
          }

          //res.text().then(console.log);

          return res.arrayBuffer();
        })
        .then((arrayBuffer) => FeedMessage.decode(new Uint8Array(arrayBuffer)))
        .catch((e) => {
          console.log(e);
        });
    };

    const tripUpdatesData = await fetchRealtimeFromURL(
      `https://transitdata.transitchicago.com/GtfsRealtime/TripUpdates.pb?key=${process.env.cta_bus_gtfs_rt_key}`
    );
    const alertsData = await fetchRealtimeFromURL(
      `https://transitdata.transitchicago.com/GtfsRealtime/ServiceAlerts.pb?key=${process.env.cta_bus_gtfs_rt_key}`
    );
    const alternativePositionsData = await fetch(
      `https://lapi.transitchicago.com/api/1.0/ttpositions.aspx?key=${process.env.cta_tracker_key}&outputType=JSON&rt=${Object.keys(validLines).join(",")}`
    ).then((res) => res.json());
    const scheduledVehicles = await fetch("http://localhost:3000/gtfs_sch_acc/cta/scheduledVehicles").then((res) =>
      res.json()
    );

    const routesData = await fetch("https://gtfs.piemadd.com/data/cta/routes.json").then((res) => res.json());
    const stationsData = await fetch("https://gtfs.piemadd.com/data/cta/stops.json").then((res) => res.json());

    let processedData = { transitStatus: { trains: {}, stations: {}, lines: {} }, train_blocks: [] };
    let positions = {};
    let cancelledTrains = {};

    //adding lines to the tracking data
    Object.keys(validLines).forEach((lineCode) => {
      const lineData = routesData[lineCode];

      processedData.transitStatus.lines[lineCode] = {
        lineCode: lineCode,
        lineNameShort: lineShortNames[lineCode],
        lineNameLong: lineData.routeLongName,
        routeColor: lineData.routeColor,
        routeTextColor: lineData.routeTextColor,
        stations: lineData.routeStations,
        hasActiveTrains: false
      };
    });

    //filling in stop data
    Object.keys(stationsData).forEach((stationID) => {
      if (stationID < 30000 || stationID >= 40000) return;

      if (!stationToStopDict[stationsData[stationID]?.parentStation])
        stationToStopDict[stationsData[stationID]?.parentStation] = [];
      stationToStopDict[stationsData[stationID]?.parentStation].push(stationID);
    });

    //adding stations to the tracking data
    Object.keys(stationsData).forEach((stationID) => {
      if (stationID < 40000 || stationID >= 50000) return;

      const finalStation = {
        stationID: stationID,
        stationName: stationsData[stationID].stopName,
        destinations: {},
        lat: stationsData[stationID].stopLat,
        lon: stationsData[stationID].stopLon
      };

      const thisStationStops = stationToStopDict[stationID];

      thisStationStops.forEach((stop) => {
        const stopPlatformData = stopPlatforms[stop];

        finalStation.destinations[stopPlatformData.platformName] = { trains: [], stopID: stopPlatformData.stopID };
      });

      processedData.transitStatus.stations[stationID] = finalStation;
    });

    alternativePositionsData.ctatt.route
      .flatMap((route) => route.train)
      .forEach((train) => {
        if (!train) return;
        positions[train.rn] = train;
      });

    tripUpdatesData.entity.forEach((message) => {
      const trainID = message?.tripUpdate?.vehicle?.id;

      if (!trainID || trainID.length > 3) return; // not a train

      const position = positions[trainID] ?? { lat: "0", lon: "0", heading: "0" };
      const isCancelled = message.tripUpdate?.trip?.scheduleRelationship == 3;
      const route = routesData[message.tripUpdate?.trip?.routeId];

      if (isCancelled) {
        cancelledTrains[trainID] = true;
        return;
      }

      let destName = position.destNm ?? "Unknown";
      const finalDestName = stationsData[position.destSt]?.stopName ?? "Unknown";

      if (!route) return; // idk at this point
      if (!processedData.transitStatus.lines[route.routeID]) return; // probably a protato

      /*
      use the destName until the 'loopLimit' is hit, then use finalDestName for the rest of the stops
      the train dest should be destName always

      also thinking about how to label stops as "inbound" and "outbound". TODO look at station vs stop ids
        realistically this will take a lot of manual work
      */

      processedData.transitStatus.lines[route.routeID].hasActiveTrains = true;

      processedData.transitStatus.trains[trainID] = {
        lat: parseFloat(position.lat),
        lon: parseFloat(position.lon),
        heading: parseFloat(position.heading),
        realTime: true,
        deadMileage: false,
        isCancelled: false,
        line: route.routeLongName,
        lineCode: route.routeID,
        lineColor: route.routeColor,
        lineTextColor: route.routeTextColor,
        dest: destName,
        predictions: message?.tripUpdate?.stopTimeUpdate.map((stopTime) => {
          const eta = (stopTime.arrival ?? stopTime.departure).time?.low * 1000;

          const parentStopID = stationsData[stopTime.stopId]?.parentStation;
          const stopPlatformName = stopPlatforms[stopTime.stopId]?.platformName ?? "Unknown";

          //adding to actual station
          if (processedData.transitStatus.stations[parentStopID]?.destinations?.[stopPlatformName]) {
            processedData.transitStatus.stations[parentStopID]?.destinations?.[stopPlatformName]?.trains.push({
              runNumber: trainID,
              actualETA: eta,
              noETA: isNaN(eta),
              realTime: true,
              line: route.routeLongName,
              lineCode: route.routeID,
              lineColor: route.routeColor,
              lineTextColor: route.routeTextColor,
              destination: destName,
              extra: {}
            });
          }

          //checking if train is past loop
          if (lineMeta[route.routeID] && parentStopID == lineMeta[route.routeID].loopLimit) {
            destName = finalDestName;
          }

          return {
            stationID: parentStopID,
            stationName: stationsData[parentStopID]?.stopName,
            actualETA: eta,
            noETA: isNaN(eta)
          };
        }),
        type: "train",
        extra: { holidayChristmas: trainID == 1225, holidayGay: trainID == 91999 }
      };
    });

    const updated = new Date().toISOString();

    processedData.transitStatus.lastUpdated = updated;

    Object.keys(scheduledVehicles)
      .sort((aTrip, bTrip) => {
        return scheduledVehicles[aTrip].predictions[0].actualETA - scheduledVehicles[bTrip].predictions[0].actualETA;
      })
      .forEach((runNumber) => {
        const scheduledVehicle = scheduledVehicles[runNumber];

        if (processedData.transitStatus.trains[runNumber]) return; // train exists
        if (cancelledTrains[runNumber]) scheduledVehicle.isCancelled = true;

        scheduledVehicle.predictions.forEach((stop, i) => {
          const parentStopID = stationsData[stop.stationID]?.parentStation;
          const stopPlatformName = stopPlatforms[stop.stationID]?.platformName ?? "Unknown";

          if (!processedData.transitStatus.stations[parentStopID]) {
            return; // shouldnt be here
          }

          if (processedData.transitStatus.stations[parentStopID].destinations[stopPlatformName].trains.length > 12)
            return; // too much!

          processedData.transitStatus.stations[parentStopID].destinations[stopPlatformName].trains.push({
            runNumber: runNumber,
            actualETA: stop.actualETA,
            noETA: false,
            realTime: false,
            isCancelled: cancelledTrains[runNumber],
            line: scheduledVehicle.line,
            lineCode: scheduledVehicle.lineCode,
            lineColor: scheduledVehicle.lineColor,
            lineTextColor: scheduledVehicle.lineTextColor,
            destination: scheduledVehicle.dest,
            extra: {}
          });

          scheduledVehicle.predictions[i].stationID = parentStopID;
          scheduledVehicle.predictions[i].stationName = stationsData[parentStopID];
        });

        processedData.transitStatus.trains[runNumber] = scheduledVehicle;
      });

    return processedData;
  } catch (e) {
    console.log(e);

    const updated = new Date().toISOString();

    return false;
    return {
      lines: {},
      stations: {},
      trains: {},
      transitStatus: { trains: {}, stations: {}, lines: {} },
      interval: 30000,
      lastUpdated: updated,
      versionNumberAPI: "2.0.0"
    };
  }
};

exports.update = processData;
