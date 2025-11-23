return; //disused

const fs = require('fs');
const prompt = require('prompt-sync')({ sigint: true });
const turf = require('@turf/turf');
const { buffer } = require('stream/consumers');

const inputFile = JSON.parse(fs.readFileSync('./endpoints/cpkc_holiday/stationCodes.json', { encoding: 'utf8' }));
const stopsData = JSON.parse(fs.readFileSync('./endpoints/cpkc_holiday/stops.json', { encoding: 'utf8' }));
const amtrakerStations = JSON.parse(fs.readFileSync('./endpoints/cpkc_holiday/amtrakerStations.json', { encoding: 'utf8' }));

const placesDict = {};
Object.keys(inputFile).forEach((objectID) => {
  const value = inputFile[objectID];

  //if (value.length == 4 || value.length == 3) return; // dont need to modify

  if (!placesDict[value]) placesDict[value] = [];
  placesDict[value].push(objectID);
});

const stopMeta = {};
stopsData.features.forEach((stop) => {
  stopMeta[stop.properties.OBJECTID] = stop;
})

/*
// detecting duplicates
Object.keys(placesDict).forEach((code) => {
  if (code.length > 4) return; // not doing these
  if (placesDict[code].length == 1) return; // no dupes

  const processed = placesDict[code].map((objectID) => {
    return {
      objectID,
      stopName: stopMeta[objectID].properties.StopName,
      code,
    }
  });

  console.log(processed)
});
*/

// detecting conflicts with amtraker
/*
Object.keys(placesDict).forEach((code) => {
  if (code.length > 4) return; // not doing these
  
  if (amtrakerStations[code]) {
    console.log(code, amtrakerStations[code].name, stopMeta[placesDict[code][0]].properties.StopName)
  }

  //console.log(processed)
});
*/

const amtrakerStationsFeatureCollection = {
  "type": "FeatureCollection",
  "features": Object.values(amtrakerStations).map((station) => {
    return {
      "type": "Feature",
      "properties": station,
      "geometry": {
        "coordinates": [
          station.lon,
          station.lat
        ],
        "type": "Point"
      }
    }
  }),
};

let breakOut = false;

Object.keys(placesDict).forEach((placeKey) => {
  let unique = false;

  if (breakOut) return;

  console.log(placeKey, placesDict[placeKey])

  const thisStationPoint = stopMeta[placesDict[placeKey][0]];
  const nearbyAmtrakerStations = turf.pointsWithinPolygon(
    amtrakerStationsFeatureCollection,
    turf.buffer(thisStationPoint, 2, { units: "miles" })
  );

  if (nearbyAmtrakerStations.features.length > 0) {
    console.log('Nearby amtraker stations:')
    nearbyAmtrakerStations.features.forEach((station) => {
      console.log(station.properties.code, station.properties.name)
      console.log(JSON.stringify(turf.featureCollection([
        station,
        thisStationPoint,
      ])))
    })
    console.log('-----')
  }

  while (!unique) {
    const code = prompt(`${stopMeta[placesDict[placeKey][0]].properties.StopName}:`);

    if (code == 'EXIT') {
      breakOut = true;
      break;
    }

    if (placesDict[code]) {
      console.log(`Code already used by ${placesDict[code]}`);
    } else {
      placesDict[placeKey].forEach((key) => {
        inputFile[key] = code;
      })
      placesDict[code] = placesDict[placeKey];
      unique = true;
      console.log('----')
    }
  }

  console.log('writing')
  fs.writeFileSync('./endpoints/cpkc_holiday/stationCodesModified.json', JSON.stringify(inputFile, null, 2), { encoding: 'utf8' });
})