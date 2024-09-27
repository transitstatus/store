const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');
const stations = require('./stations.json');

require('dotenv').config();

const updateFeed = async () => {
  try {
    if (!process.env.bay_511) return false;

    const now = new Date();

    let responseObject = {
      stations: {}
    };

    stations.forEach(async (station) => {
      const form = new FormData();
      form.append('token', process.env.NJT_REGULAR_RAIL_KEY);
      form.append('station', station.STATION_2CHAR);

      //fetching data
      const res = await fetch('https://raildata.njtransit.com/api/TrainData/getTrainSchedule19Rec', {
        method: "POST",
        headers: {
          accept: '*/*',
          ...form.getHeaders(),
        },
        body: form,
      });
      const data = await res.json();

      responseObject.stations[station.code] = {};

      data.ITEMS.forEach((train) => {
        if (train.LINECODE === 'AM') {
          responseObject.stations[station.code][train.TRAIN_ID.replace('A', '')] = train.TRACK;
        }
      })
    })

    console.log(`Finished updating NJT Tracks`)
    return responseObject;
  } catch (e) {
    console.log(e);
    return {
      stations: {}
    };
  }
};

exports.update = updateFeed;
