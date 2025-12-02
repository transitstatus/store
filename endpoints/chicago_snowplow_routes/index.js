const fetch = require('node-fetch');
const turf = require('@turf/turf');

const updateFeed = async () => {
  try {
    const now = Date.now();

    let finalFeatures = [];
    let streets = [];
    let streetIndexes = {};
    let priorities = [];
    let priorityIndexes = {};

    let currentOffset = 0;
    while (currentOffset >= 0) {
      const data = await fetch(`https://services7.arcgis.com/A03QrhyHnDaUmK0W/arcgis/rest/services/SnowRoutes_public_2fe25e826b3b49f496584ff4f32b2f59/FeatureServer/0/query?f=geojson&geometry=-87.886346234%2C41.644591842000096%2C-87.524533075%2C42.022934702&where=1%3D1&orderByFields=objectid%20ASC&outFields=lastserviced%2Cobjectid%2Croutepriority%2Croadname&quantizationParameters={%22extent%22%3A{%22xmin%22%3A-87.886346234%2C%22ymin%22%3A41.644591842000096%2C%22xmax%22%3A-87.524533075%2C%22ymax%22%3A42.022934702}%2C%22mode%22%3A%22view%22%2C%22originPosition%22%3A%22upperLeft%22%2C%22tolerance%22%3A0.0001}&resultType=tile&spatialRel=esriSpatialRelIntersects&geometryType=esriGeometryEnvelope&defaultSR=4326&maxRecordCountFactor=4&resultOffset=${currentOffset}&maxAllowableOffset=0.00001`)
        .then((res) => res.json())
        .catch((e) => {
          throw e;
        });

      // should we continue
      if (data.properties?.exceededTransferLimit) currentOffset += 16000
      else currentOffset = -1;

      finalFeatures.push(...data.features.map((feature) => {
        delete feature.properties?.objectid; // we already have this in the ids

        feature.properties.timeSinceLastUpdate = feature.properties.lastServiced ? now - feature.properties.lastServiced : now;  

        if (feature.properties?.routepriority == 'ORD') feature.properties.routepriority = 'OHARE'; // dont ask me, just go with the flow

        // half assed data saving
        // checking if there even is anything to optimize
        if (feature.properties.roadname) {
          // checking if we already have this street saved
          if (!streetIndexes[feature.properties.roadname]) {
            streets.push(feature.properties.roadname);
            streetIndexes[feature.properties.roadname] = streets.length - 1;
          }

          //replacing our name in the feature
          feature.properties.roadname = streetIndexes[feature.properties.roadname];
        }

        // doing the exact same but for priorities
        if (feature.properties.routepriority) {
          // checking if we already have this street saved
          if (!priorityIndexes[feature.properties.routepriority]) {
            priorities.push(feature.properties.routepriority);
            priorityIndexes[feature.properties.routepriority] = priorities.length - 1;
          }

          //replacing our name in the feature
          feature.properties.routepriority = priorityIndexes[feature.properties.routepriority];
        }

        // truncating to 5 coordinates, which is good enough and saves a few bytes so why not
        turf.truncate(feature, {
          precision: 5,
          mutate: true,
        })

        return feature;
      }));
    }

    console.log(`Finished updating Chicago Snowplow Routes`)
    return {
      "shape": {
        "type": "FeatureCollection",
        "features": finalFeatures
      },
      "meta": {
        lastUpdated: now,
        priorities,
        streets,
      }
    }
  } catch (e) {
    console.log(e);
    return false;
  }
};

exports.update = updateFeed;
