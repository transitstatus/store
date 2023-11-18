const fetch = require('node-fetch');

require('dotenv').config();

let busNum = 8252;

const isDST = (date) => {
  const dstStart = new Date(date.getFullYear(), 2, 8, 2, 0, 0); // Spring forward
  const dstEnd = new Date(date.getFullYear(), 10, 1, 1, 0, 0); // Fall back

  if (date >= dstStart && date < dstEnd) {
    return true;
  } else {
    return false;
  }
}

const getOffset = (date) => {
  if (isDST(date)) return '-05:00';

  return '-06:00';
}

const parseTime = (raw) => {
  const year = raw.substring(0, 4);
  const month = raw.substring(4, 6);
  const day = raw.substring(6, 8);

  const time = raw.substring(9, 17);
  const offset = getOffset(new Date());

  return new Date(`${year}-${month}-${day}T${time}${offset}`).valueOf();
};


const update = async () => {
  try {
    const now = new Date();

    const vehicleReq = await fetch(`https://ctabustracker.com/bustime/api/v3/getvehicles?key=${process.env.cta_bus_auth}&format=json&vid=${busNum}`);
    const predictionsReq = await fetch(`https://ctabustracker.com/bustime/api/v3/getpredictions?key=${process.env.cta_bus_auth}&format=json&vid=${busNum}&tmres=s`);
    const routesReq = await fetch('https://gtfs.piemadd.com/data/cta/routes.json');
    const stopsReq = await fetch('https://gtfs.piemadd.com/data/cta/stops.json');

    const vehicleData = await vehicleReq.json();
    const predictionsData = await predictionsReq.json();
    const routesData = await routesReq.json();
    const stopsData = await stopsReq.json();

    const vehicleDataActual = vehicleData['bustime-response']['vehicle'][0];
    const predictionsDataActual = predictionsData['bustime-response']['prd'];

    let transitStatusObject = {
      lastUpdated: now.toISOString(),
      trains: {},
      stations: {},
      lines: {}
    };

    //882b2b

    transitStatusObject.lines[vehicleDataActual.rt] = {
      lineCode: vehicleDataActual.rt,
      lineNameShort: '',
      lineNameLong: vehicleDataActual.rt,
      routeColor: '2eb712',
      routeTextColor: 'ffffff',
      hasActiveTrains: true,
      stations: routesData[vehicleDataActual.rt].routeStations,
    }

    routesData[vehicleDataActual.rt].routeStations.forEach((stationID) => {
      transitStatusObject.stations[stationID] = {
        stationID,
        stationName: stopsData[stationID].stopName,
        lat: Number(stopsData[stationID].stopLat),
        lon: Number(stopsData[stationID].stopLon),
        destinations: {}
      }
    })

    predictionsDataActual.forEach((prediction) => {
      //this sometimes happens ig?
      if (!transitStatusObject.stations[prediction.stpid]) {
        transitStatusObject.stations[prediction.stpid] = {
          stationID: prediction.stpid,
          statioonName: prediction.stpnm,
          lat: Number(stopsData[prediction.stpid] ? stopsData[prediction.stpid].stopLat : 0),
          lon: Number(stopsData[prediction.stpid] ? stopsData[prediction.stpid].stopLon : 0),
          destinations: {},
        }
      }

      transitStatusObject.stations[prediction.stpid].destinations[prediction.des] = {
        trains: [
          {
            runNumber: prediction.vid,
            actualETA: parseTime(prediction.prdtm),
            noETA: false,
            line: prediction.rt,
            lineCode: prediction.rt,
            lineColor: '2eb712',
            lineTextColor: 'ffffff',
          }
        ]
      }
    })

    transitStatusObject.trains[busNum] = {
      lat: Number(vehicleDataActual.lat),
      lon: Number(vehicleDataActual.lon),
      heading: Number(vehicleDataActual.hdg),
      line: vehicleDataActual.rt,
      lineCode: vehicleDataActual.rt,
      lineColor: '2eb712',
      lineTextColor: 'ffffff',
      dest: vehicleDataActual.des,
      predictions: predictionsDataActual.map((prediction) => {
        return {
          stationID: prediction.stpid,
          stationName: prediction.stpnm,
          actualETA: parseTime(prediction.prdtm),
          noETA: false
        }
      }),
    }

    return transitStatusObject;
  } catch (e) {
    console.log("Error updating holiday bus:", e)
    return false;
  }

};

exports.update = update;