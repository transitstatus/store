const fetch = require('node-fetch');

const fetchBatchOfVins = async (vins) => {
  const data = await fetch("https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVINValuesBatch/", {
    "credentials": "include",
    "headers": {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:145.0) Gecko/20100101 Firefox/145.0",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Content-Type": "application/x-www-form-urlencoded",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-User": "?1",
      "Priority": "u=0, i",
      "Pragma": "no-cache",
      "Cache-Control": "no-cache"
    },
    "referrer": "https://vpic.nhtsa.dot.gov/api/",
    "body": `DATA=${vins.join('%3B')}&format=JSON`,
    "method": "POST",
    "mode": "cors"
  }).then((res) => res.json());
  return data;
}

const fetchVins = async (vins) => {
  // getting any former vins we've already fetched
  const formerVinsData = await fetch('http://localhost:3000/chicago_snowplows/vinData').then((res) => res.json());

  let finalVinsData = { ...formerVinsData };

  const vinsThatNeedFetching = vins.filter((vin) => !formerVinsData[vin]);

  const chunkSize = 50;
  for (let i = 0; i < vinsThatNeedFetching.length; i += chunkSize) {
    const chunk = vinsThatNeedFetching.slice(i, i + chunkSize);
    const fetchedChunk = await fetchBatchOfVins(chunk);
    await new Promise(r => setTimeout(r, 100));

    fetchedChunk.Results.forEach((r) => {
      const final = {
        displacementL: r.DisplacementL.length > 0 ? parseFloat(parseFloat(r.DisplacementL).toFixed(1)) : "",
        driveType: r.DriveType,
        engineConfiguration: r.EngineConfiguration,
        engineCylinders: r.EngineCylinders.length > 0 ? parseInt(r.EngineCylinders) : "",
        engineHP: r.EngineHP,
        engineHP_to: r.EngineHP_to,
        engineManufacturer: r.EngineManufacturer,
        engineModel: r.EngineModel.replace(r.EngineManufacturer, '').trim(),
        fuelTypePrimary: r.FuelTypePrimary,
        make: r.Make,
        manufacturer: r.Manufacturer,
        model: r.Model,
        modelYear: r.ModelYear.length > 0 ? parseInt(r.ModelYear) : "",
        plantCity: r.PlantCity,
        plantState: r.PlantState,
        plantCountry: r.PlantCountry,
      };

      Object.keys(final).forEach((key) => { if (final[key].length == 0) final[key] = null }); // making empty keys null

      finalVinsData[r.VIN] = final;
    })
  };

  return finalVinsData;
};

const updateFeed = async () => {
  try {
    const now = new Date();

    const data = await Promise.all(
      [
        'Trucks_greater_than_S11757',
        'Trucks_less_than_S11530',
        'Trucks_greater_than_S11529_and_less_than_S11758',
      ]
        .map((collectionID) =>
          fetch(`https://services7.arcgis.com/A03QrhyHnDaUmK0W/arcgis/rest/services/${collectionID}/FeatureServer/0/query?f=geojson&geometry=-87.886346234%2C41.644591842000096%2C-87.524533075%2C42.022934702&where=1%3D1&orderByFields=device_id ASC&quantizationParameters={"extent"%3A{"xmin"%3A-87.886346234%2C"ymin"%3A41.644591842000096%2C"xmax"%3A-87.524533075%2C"ymax"%3A42.022934702}%2C"mode"%3A"view"%2C"originPosition"%3A"upperLeft"}&resultType=tile&spatialRel=esriSpatialRelIntersects&geometryType=esriGeometryEnvelope&defaultSR=4326&maxRecordCountFactor=4&resultOffset=0&outFields=device_id,vehicleName,vin,vehicleLicensePlate,deviceType,dateTime,speed,bearing`)
            .then((res) => res.json())
        )
    );

    const flattenedData = data.flatMap((res) => res.features);
    const vinsList = flattenedData.map((vehicle) => vehicle.properties.vin);

    const vinData = await fetchVins(vinsList);

    let allMakes = [];
    let allModels = [];
    let allYears = [];
    let allCylinders = [];
    let allEngineManufacturers = [];
    let allEngineModels = [];

    const vehicleDataWithVinData = flattenedData.map((vehicle) => {
      if (vinData[vehicle.properties.vin]) {
        const thisVinData = vinData[vehicle.properties.vin];
        vehicle.properties.vinData = thisVinData;

        // now for stats
        allMakes.push(thisVinData.make);
        allModels.push(thisVinData.model);
        allYears.push(thisVinData.modelYear);
        allCylinders.push(thisVinData.engineCylinders);
        allEngineManufacturers.push(thisVinData.engineManufacturer);
        allEngineModels.push(thisVinData.engineModel);
      }
      return vehicle;
    });

    console.log(`Finished updating Chicago Snowplows`)
    return {
      meta: {
        count: flattenedData.length,
        filterValues: {
          make: [...new Set(allMakes)],
          model: [...new Set(allModels)],
          modelYear: [...new Set(allYears)],
          engineCylinders: [...new Set(allCylinders)],
          engineManufacturer: [...new Set(allEngineManufacturers)],
          engineModel: [...new Set(allEngineModels)],
        },
        vins: vinsList,
      },
      shape: {
        type: "FeatureCollection",
        features: vehicleDataWithVinData,
      },
      vinData: vinData,
    }
  } catch (e) {
    console.log(e);
    return false;
  }
};

exports.update = updateFeed;