const update = async () => {
  try {
    const [staticStopsData, staticRoutesData, metraTrainData, pieroTrainsListRaw, pieroUnscheduledTrainsListRaw] =
      await Promise.all(
        [
          "https://gtfs.piemadd.com/data/metra/stops.json",
          "https://gtfs.piemadd.com/data/metra/routes.json",
          "http://localhost:3000/metra/transitStatus",
          `https://gks.pgm.sh/api/v1/piero_trains?t=${Date.now()}`,
          `https://gks.pgm.sh/api/v1/piero_trains_unsched?t=${Date.now()}`
        ].map((url) =>
          fetch(url, { cache: "no-store" })
            .then((res) => res.json())
            .catch((e) => {
              // likely pgm.sh getting blocked
              console.log(url);
              console.log(e);
            })
        )
      );

    const lastUpdated = new Date().toISOString();
    const pieroTrainsList = !pieroTrainsListRaw || pieroTrainsListRaw.error ? [] : pieroTrainsListRaw.response.object;
    const pieroUnschedTrainsList =
      !pieroUnscheduledTrainsListRaw || pieroUnscheduledTrainsListRaw.error
        ? []
        : pieroUnscheduledTrainsListRaw.response.object;

    let transitStatus = { trains: {}, stations: {}, lines: {}, alerts: [], lastUpdated };

    Object.values(staticStopsData).forEach((stop) => {
      //adding stations to transitStatus object
      transitStatus.stations[stop.stopID] = {
        stationID: stop.stopID,
        stationName: stop.stopName,
        lat: stop.stopLat,
        lon: stop.stopLon,
        destinations: { Inbound: { trains: [] }, Outbound: { trains: [] } }
      };
    });

    //parsing unscheduled trains
    let rawUnschedTrains = [];
    let currentUnschedTrain = {};

    pieroUnschedTrainsList.forEach((item) => {
      if (item == "END_TRAIN") {
        rawUnschedTrains.push(currentUnschedTrain);
        currentUnschedTrain = JSON.parse("{}");
        return;
      }

      const itemSplit = item.split(":");

      currentUnschedTrain[itemSplit[0]] = itemSplit.slice(1).join(":");
    });

    //adding unscheduled trains
    rawUnschedTrains.forEach((train) => {
      const depTime = new Date(`${train.train_date}T${train.dep_time}`).valueOf();
      const arrTime = new Date(`${train.train_date}T${train.arr_time}`).valueOf();
      const now = Date.now();
      const enroute = depTime - 1000 * 60 * 15 <= now && arrTime + 1000 * 60 * 5 >= now;
      
      if (arrTime + (1000 * 60 * 5) <= now) return; // train has already arrived, don't add it

      const lineCode = train.train_id.split("-")[0];
      const lineData = metraTrainData.lines[lineCode] ?? {};

      const trainNumber = train.train_id.split("-")[1].replace("DH", "");
      const isInbound = parseInt(trainNumber) % 2 == 0;
      const trainDirection = isInbound ? "Inbound" : "Outbound";

      let posData = { lat: 0, lon: 0, heading: 0, realTime: false };

      if (enroute && metraTrainData.trains[`DM-${train.cabcar}`]) {
        posData = metraTrainData.trains[`DM-${train.cabcar}`];
        posData.realTime = true;
      }

      const finalTrain = {
        lat: posData.lat,
        lon: posData.lon,
        heading: posData.heading,
        realTime: posData.realTime,
        deadMileage: false,
        line: lineData.lineNameLong,
        lineCode,
        lineColor: lineData.routeColor,
        lineTextColor: lineData.routeTextColor,
        dest: metraTrainData.stations[train.arr_loc]?.stationName,
        predictions: [
          {
            stationID: train.dep_loc,
            stationName: metraTrainData.stations[train.dep_loc]?.stationName,
            actualETA: depTime,
            noETA: false,
            realTime: posData.realTime
          },
          {
            stationID: train.arr_loc,
            stationName: metraTrainData.stations[train.arr_loc]?.stationName,
            actualETA: arrTime,
            noETA: false,
            realTime: posData.realTime
          }
        ],
        type: "train",
        extra: {}
      };

      finalTrain.predictions.forEach((prediction) => {
        transitStatus.stations[prediction.stationID].destinations[trainDirection].trains.push({
          runNumber: train.train_id,
          actualETA: prediction.actualETA,
          noETA: prediction.noETA,
          realTime: prediction.realTime,
          line: finalTrain.line,
          lineCode: finalTrain.lineCode,
          lineColor: finalTrain.lineColor,
          lineTextColor: finalTrain.lineTextColor,
          destination: finalTrain.dest,
          extra: {}
        });

        transitStatus.trains[train.train_id] = finalTrain;
      });
    });

    //adding trains to transitStatus object
    Object.keys(metraTrainData.trains).forEach((runNumber) => {
      const finalTrain = metraTrainData.trains[runNumber];

      if (
        !pieroTrainsList.includes(finalTrain.extra?.runNumDate) &&
        !pieroTrainsList.includes(finalTrain.extra?.cabCar)
      ) {
        return;
      }

      const trainNumber = runNumber.split("-")[1];
      const isInbound = parseInt(trainNumber) % 2 == 0;
      const trainDirection = isInbound ? "Inbound" : "Outbound";

      finalTrain.predictions.forEach((prediction) => {
        transitStatus.stations[prediction.stationID].destinations[trainDirection].trains.push({
          runNumber: runNumber,
          actualETA: prediction.actualETA,
          noETA: prediction.noETA,
          realTime: prediction.realTime,
          line: finalTrain.line,
          lineCode: finalTrain.lineCode,
          lineColor: finalTrain.lineColor,
          lineTextColor: finalTrain.lineTextColor,
          destination: finalTrain.dest,
          extra: {}
        });
      });

      finalTrain.deadMileage = false;

      transitStatus.trains[runNumber] = finalTrain;
    });

    //adding any stations without trains to transitStatus object
    Object.keys(staticRoutesData).forEach((routeID) => {
      const route = staticRoutesData[routeID];

      transitStatus.lines[routeID] = {
        lineCode: routeID,
        lineNameShort: route.routeShortName,
        lineNameLong: route.routeLongName,
        routeColor: route.routeColor,
        routeTextColor: route.routeTextColor,
        stations: route.routeStations,
        hasActiveTrains: false
      };

      route.routeStations.forEach((stationID) => {
        if (!transitStatus.stations[stationID]) {
          transitStatus.stations[stationID] = {
            stationID: stationID,
            stationName: staticStopsData[stationID].stopName,
            lat: staticStopsData[stationID].stopLat,
            lon: staticStopsData[stationID].stopLon,
            destinations: { Inbound: { trains: [] }, Outbound: { trains: [] } }
          };
        }
      });
    });

    transitStatus.lines["DEADMILEAGE"] = {
      lineCode: "DEADMILEAGE",
      lineNameShort: "Dead Mileage",
      lineNameLong: "Dead Mileage",
      routeColor: "111111",
      routeTextColor: "ffffff",
      stations: [],
      hasActiveTrains: false
    };

    Object.keys(transitStatus.trains).forEach((train) => {
      const trainData = transitStatus.trains[train];

      if (transitStatus.lines[trainData.lineCode]) transitStatus.lines[trainData.lineCode].hasActiveTrains = true;
    });

    return { v1: transitStatus };
  } catch (e) {
    console.log(e);
    return false;
  }
};

exports.update = update;
