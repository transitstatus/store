const fs = require('fs');

const shapeNames = ['red', 'blue', 'green'];
const properShapeNames = ['Red', 'Blue', 'Green'];
const shapeColors = ['#cb4626', '#4776bb', '#227054'];
const shapesRaw = shapeNames.map((shapeName) => JSON.parse(fs.readFileSync(`./endpoints/mff/rawData/${shapeName}.json`, { encoding: 'utf8' })).waypoints);
const finalShape = {
  type: "FeatureCollection",
  features: shapesRaw.map((shape, i) => {
    const shapeID = shapeNames[i];

    return {
      type: "Feature",
      properties: {
        routeID: shapeID,
        routeShortName: properShapeNames[i],
        routeLongName: properShapeNames[i],
        routeColor: shapeColors[i],
      },
      geometry: {
        coordinates: shape.map((coord) => [coord.lon, coord.lat]),
        type: "LineString"
      }
    };
  })
};

fs.writeFileSync('./endpoints/mff/rawData/routes.geojson', JSON.stringify(finalShape), { encoding: 'utf8' });