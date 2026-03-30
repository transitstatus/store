const fetch = require("node-fetch");
const { XMLParser } = require("fast-xml-parser");
const fs = require("fs");

const parseUPDate = (rawDate) => {
  return new Date(rawDate); //might have to change this later, but JS likes their format of // Mon Sep 02 18:27:38 CDT 2024
};

const parseStopTimes = (stopProperties) => {
  const arrivalTime = new Date(stopProperties.Arrival_Time_UTC);
  const arrivalTimeDate = moment(arrivalTime)
    .tz(timeZoneNames[stopProperties.TimeZone])
    .format()
    .split("T")[0];
  const arrivalTimeNumber = arrivalTime.valueOf();

  const eventStartTime = new Date(
    `${arrivalTimeDate}T${stopProperties.Event_Start}:00${timeZoneOffsets[stopProperties.TimeZone]}`,
  ).valueOf();
  const eventEndTime = new Date(
    `${arrivalTimeDate}T${stopProperties.Event_End}:00${timeZoneOffsets[stopProperties.TimeZone]}`,
  ).valueOf();
  const leaveTime = new Date(
    `${arrivalTimeDate}T${stopProperties.Leave_Time}:00${timeZoneOffsets[stopProperties.TimeZone]}`,
  ).valueOf();

  const res = {
    arrivalTime: !isNaN(arrivalTimeNumber) ? arrivalTimeNumber : null,
    eventStartTime: !isNaN(eventStartTime) ? eventStartTime : null,
    eventEndTime: !isNaN(eventEndTime) ? eventEndTime : null,
    leaveTime: !isNaN(leaveTime) ? leaveTime : null,
    hasAnyValidValues: false,
  };

  if (
    res.arrivalTime ||
    res.eventStartTime ||
    res.eventEndTime ||
    res.leaveTime
  )
    res.hasAnyValidValues = true;

  return res;
};

const update = async () => {
  const now = new Date();
  const parser = new XMLParser();

  // importing stops data from file
  let stopsFromCSV = [];
  let stopKeys = [];
  fs.readFileSync(`${__dirname}/map_stops.csv`, { encoding: "utf8" })
    .split("\n")
    .map((line, i) => {
      const splitLine = line.split(",");

      if (i == 0) stopKeys = splitLine;
      else {
        let finalStop = {};
        stopKeys.forEach((key, i) => {
          finalStop[key] = splitLine[i];
        });
        stopsFromCSV.push(finalStop);
      }
    });

  const [trackingStatus, trackingData] = await Promise.all(
    [
      "https://www.up.com/cs/groups/public/@uprr/@corprel/documents/up_pdf_nativedocs/xml_up_steam_track_gps_status.xml",
      "https://www.up.com/dynamic/coldfusion/unp/up-steam/steam.xml",
    ].map((url) =>
      fetch(url)
        .then((res) => res.text())
        .then((rawData) => parser.parse(rawData)),
    ),
  );

  let transitStatusObject = {
    trains: {
      4014: {
        lat: trackingData.info.equipment.gpsLat,
        lon: trackingData.info.equipment.gpsLon,
        heading: trackingData.info.equipment.heading,
        realTime: true,
        deadMileage: false,
        line: "Big Boy",
        lineCode: "bigboy",
        lineColor: "feca00",
        lineTextColor: "000000",
        dest: "America 250",
        predictions: [],
        type: "train",
      },
    },
    stations: {},
    lines: {
      bigboy: {
        lineCode: "bigboy",
        lineNameShort: "Big Boy",
        lineNameLong: "UP Big Boy",
        routeColor: "feca00",
        routeTextColor: "000000",
        stations: stopsFromCSV.map((stop) => stop.code),
        hasActiveTrains: true,
      },
    },
    lastUpdated: parseUPDate(trackingData.info.equipment.updated),
  };

  stopsFromCSV.forEach((stop) => {
    const arrivalTime =
      stop.arr_raw.length > 0
        ? new Date(`${stop.date_arr_raw} ${stop.arr_raw}`).valueOf()
        : null;
    const departureTime = new Date(
      `${stop.date_dep_raw} ${stop.dep_raw}`,
    ).valueOf();

    transitStatusObject.stations[stop.code] = {
      stationID: stop.code,
      stationName: stop.name,
      destinations: {
        "America 250": {
          trains: [
            {
              runNumber: "4014",
              actualETA:
                arrivalTime && arrivalTime > now ? arrivalTime : departureTime,
              arr: arrivalTime ?? departureTime,
              dep: departureTime,
              arrDelay: 0,
              depDelay: 0,
              noETA: false,
              realTime: true,
              line: "Big Boy",
              lineCode: "bigboy",
              lineColor: "feca00",
              lineTextColor: "000000",
              destination: "America 250",
            },
          ],
        },
      },
      lat: stop.lat,
      lon: stop.lon,
      tz: stop.tz,
    };

    transitStatusObject.trains[4014].predictions.push({
      stationID: stop.code,
      stationName: stop.name,
      actualETA: arrivalTime && arrivalTime > now ? arrivalTime : departureTime,
      arr: arrivalTime ?? departureTime,
      dep: departureTime,
      arrDelay: 0,
      depDelay: 0,
      noETA: false,
      realTime: true,
      tz: stop.tz,
    });
  });

  return transitStatusObject;
};

exports.update = update;
