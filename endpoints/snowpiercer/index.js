const fetch = require('node-fetch');

const length = require('@turf/length').default;
const along = require('@turf/along').default;
const nearestPointOnLine = require('@turf/nearest-point-on-line').default;
const rhumbBearing = require('@turf/rhumb-bearing').default;

const snowPiercerShape = require('./snowPiercer.json');
const snowPiercerShapeLength = length(snowPiercerShape);

const calculateSnowPiercerPosition = (time) => {
  const timesAround = Math.abs(Number(((time.valueOf() - new Date('2024-04-01T00:00:00-05:00').valueOf()) / (1000 * 60 * 60 * 6) % 1).toFixed(4)));
  const distanceOnShape = snowPiercerShapeLength * timesAround;

  const point = along(snowPiercerShape, distanceOnShape);

  return point;
}

const calculateSnowPiercerAngle = (point) => {
  const nearestPoint = nearestPointOnLine(snowPiercerShape, point); // this is going to be the same 
  const bearing = rhumbBearing(
    {
      "type": "Feature",
      "properties": {},
      "geometry": {
        "coordinates": snowPiercerShape.geometry.coordinates[nearestPoint.properties.index],
        "type": "Point"
      },
      "id": 0
    },
    {
      "type": "Feature",
      "properties": {},
      "geometry": {
        "coordinates": snowPiercerShape.geometry.coordinates[nearestPoint.properties.index + 1],
        "type": "Point"
      },
      "id": 0
    }
  )

  return bearing + 180;
}

const update = async () => {
  try {
    const lastUpdated = new Date().toISOString();

    const snowPiercerPosition = calculateSnowPiercerPosition(new Date(lastUpdated));
    const snowPiercerHeading = calculateSnowPiercerAngle(snowPiercerPosition)

    let transitStatusResponse = {
      trains: {},
      stations: {},
      lines: {},
      lastUpdated,
    };

    transitStatusResponse.stations['EARTH'] = {
      stationID: 'EARTH',
      stationName: "Earth",
      destinations: {
        'EARTH': {
          trains: []
        }
      },
      lat: 0,
      lon: 0,
    }

    transitStatusResponse.lines['PRCR'] = {
      lineCode: 'PRCR',
      lineNameShort: 'Piercer',
      lineNameLong: "Snowpiercer",
      routeColor: "a5c9d7",
      routeTextColor: "000000",
      stations: ["EARTH"],
      hasActiveTrains: true
    }

    transitStatusResponse.trains['PRCR'] = {
      lat: snowPiercerPosition.geometry.coordinates[1],
      lon: snowPiercerPosition.geometry.coordinates[0],
      heading: snowPiercerHeading,
      line: 'Snowpiercer',
      lineCode: 'PRCR',
      lineColor: "a5c9d7",
      lineTextColor: "000000",
      dest: "EARTH",
      predictions: [
        {
          stationID: 'EARTH',
          stationName: "Earth",
          actualETA: new Date("2024-04-01T00:00:00-05:00").getTime(),
          noETA: false,
        }
      ],
      type: 'train',
    }

    Object.keys(transitStatusResponse.trains).forEach((trainID) => {
      const train = transitStatusResponse.trains[trainID];

      train.predictions.forEach((prediction) => {
        transitStatusResponse.stations[prediction.stationID].destinations[train.dest].trains.push({
          runNumber: trainID,
          actualETA: prediction.actualETA,
          noETA: prediction.noETA,
          line: train.line,
          lineCode: train.lineCode,
          lineColor: train.lineColor,
          lineTextColor: train.lineTextColor,
        })
      })

      transitStatusResponse.lines[train.lineCode].hasActiveTrains = true;
    })

    return {
      v1: transitStatusResponse,
    };
  } catch (e) {
    console.log(e);
    return false;
    return {
      v1: {
        trains: {},
        stations: {},
        lines: {},
        lastUpdated: new Date().toISOString(),
      },
    };
  }
};

exports.update = update;