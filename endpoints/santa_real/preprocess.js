const fs = require('fs');
const turf = require('@turf/turf');

const thisYear = new Date().getFullYear();
const convertToThisYear = (number) => new Date(new Date(number).toISOString().replace('2019', thisYear));

const inputData = JSON.parse(fs.readFileSync('./endpoints/santa_real/raw_data.json', { encoding: 'utf8' }));

const processedPlaceFeatures = inputData.destinations.map((destination) => {
  const convertedArrival = convertToThisYear(destination.arrival);
  const convertedDeparture = convertToThisYear(destination.departure);

  return turf.point(
    [destination.location.lng - 360, destination.location.lat],
    {
      ...destination,
      arrival: convertedArrival,
      departure: convertedDeparture,
    }
  )
});

const placeLine = turf.bezierSpline(
  turf.lineString(processedPlaceFeatures.map((feature) => feature.geometry.coordinates)),
  {
      sharpness: 0.85,
      resolution: 500000
  }

);

//fs.writeFileSync('./out.json', JSON.stringify(processedPlaceFeatures), {encoding: 'utf8'});