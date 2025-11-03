const fetch = require('node-fetch');
const { JSDOM } = require("jsdom");
const { XMLParser } = require("fast-xml-parser");
const fs = require('fs');
const schedule = require('./schedule.json');

const parseUPDate = (rawDate) => {
  return new Date(rawDate); //might have to change this later, but JS likes their format of // Mon Sep 02 18:27:38 CDT 2024
}

const update = async () => {
  const parser = new XMLParser();

  const posReq = await fetch('https://www.up.com/dynamic/coldfusion/unp/up-steam/steam.xml');
  const posRaw = await posReq.text();
  const posData = parser.parse(posRaw);

  let transitStatusObject = {
    trains: {
      "4014": {
        lat: posData.info.equipment.gpsLat,
        lon: posData.info.equipment.gpsLon,
        heading: posData.info.equipment.heading,
        realTime: true,
        deadMileage: false,
        line: "Big Boy",
        lineCode: "BigBoy",
        lineColor: "feca00",
        lineTextColor: "000000",
        dest: "Heartland of America",
        predictions: [],
        type: "train"
      }
    },
    stations: {},
    lines: {
      BigBoy: {
        lineCode: "BigBoy",
        lineNameShort: "Big Boy",
        lineNameLong: "UP Big Boy",
        routeColor: "feca00",
        routeTextColor: "000000",
        stations: schedule.map((station) => station.code),
        hasActiveTrains: true
      }
    },
    lastUpdated: parseUPDate(posData.info.equipment.updated)
  }

  schedule.forEach((station) => {
    const now = Date.now();
    const schArr = new Date(station.schArr).valueOf();
    const schDep = new Date(station.schDep).valueOf();

    let etaToUse = schArr;

    if (schArr < now && schDep >= now) etaToUse = schDep; // has arrived, not departed
    if (schArr >= now) etaToUse = schArr; // has not arrived yet
    if (schArr < now && schDep < now) etaToUse = 0; // has departed

    transitStatusObject.stations[station.code] = {
      "stationID": station.code,
      "stationName": station.name,
      "destinations": {
        "Heartland of America": {
          "trains": etaToUse !== 0 ? [
            {
              "runNumber": "4014",
              "actualETA": etaToUse,
              "noETA": false,
              realTime: true,
              "line": "Big Boy",
              "lineCode": "BigBoy",
              "lineColor": "feca00",
              "lineTextColor": "000000"
            }
          ] : []
        }
      },
      "lat": station.coords[0],
      "lon": station.coords[1]
    }

    if (etaToUse !== 0) {
      transitStatusObject.trains[4014].predictions.push({
        "stationID": station.code,
        "stationName": station.name,
        "actualETA": etaToUse,
        "noETA": false,
        realTime: true,
      })
    }
  })

  return transitStatusObject
}

exports.update = update;