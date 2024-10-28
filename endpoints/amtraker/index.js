const fs = require('fs');
const GtfsRealtimeBindings = require('gtfs-realtime-bindings');
const cryptojs = require('crypto-js');

//some data that is useful for when amtrak's api sometimes dies
const rawStations = require('./rawData/stations.json');

require('dotenv').config();

const sValue = "9a3686ac";
const iValue = "c6eb2f7f5c4740c1a2f708fefd947d39";
const publicKey = "69af143c-e8cf-47f8-bf09-fc1f61e5cc33";
const masterSegment = 88;

const decrypt = (content, key) => {
  return cryptojs.AES.decrypt(
    cryptojs.lib.CipherParams.create({
      ciphertext: cryptojs.enc.Base64.parse(content),
    }),
    cryptojs.PBKDF2(key, cryptojs.enc.Hex.parse(sValue), {
      keySize: 4,
      iterations: 1e3,
    }),
    { iv: cryptojs.enc.Hex.parse(iValue) }
  ).toString(cryptojs.enc.Utf8);
};

const updateFeed = async () => {
  let shitsFucked = false;
  let shitsFuckedSource = '';

  try {
    let fetchedData = {};
    const urlsToFetch = {
      'amtrakUnencrypted': 'https://maps.amtrak.com/services/MapDataService/stations/AllTTMTrains',
      'amtrakEncrypted': 'https://maps.amtrak.com/services/MapDataService/trains/getTrainsData',
      'amtrakStationsEncrypted': 'https://maps.amtrak.com/services/MapDataService/stations/trainStations',
      'amtrakStationsGTFS': 'https://gtfs.piemadd.com/data/amtrak/stops.json',
      'viaRailData': 'https://tsimobile.viarail.ca/data/allData.json',
      'viaRailGTFS': 'https://gtfs.piemadd.com/data/viarail/stops.json',
      'brightlineTimes': 'http://feed.gobrightline.com/trip_updates.pb',
      'brightlinePositions': 'http://feed.gobrightline.com/position_updates.pb',
      'brightlineGTFS': 'https://gtfs.piemadd.com/data/brightline/stops.json'
    };
    const processRequests = {
      'amtrakUnencrypted': (r) => r.json(),
      'amtrakEncrypted': (async (r) => {
        try {
          const raw = await r.text();
          const mainContent = raw.substring(0, raw.length - masterSegment);
          const encryptedPrivateKey = raw.substr(
            raw.length - masterSegment,
            raw.length
          );
          const privateKey = decrypt(encryptedPrivateKey, publicKey).split("|")[0];
          const decryptedData = decrypt(mainContent, privateKey);

          return JSON.parse(decryptedData).features;
        } catch (e) {
          console.log(e)
          shitsFucked = true;
          shitsFuckedSource = 'amtrak';
          return [];
        }
      }),
      'amtrakStationsEncrypted': async (r) => {
        try {
          const raw = await r.text();
          const mainContent = raw.substring(0, raw.length - masterSegment);
          const encryptedPrivateKey = raw.substr(
            raw.length - masterSegment,
            raw.length
          );
          const privateKey = decrypt(encryptedPrivateKey, publicKey).split("|")[0];
          const decrypted = decrypt(mainContent, privateKey);

          return decrypted.length > 0
            ? JSON.parse(decrypted)?.StationsDataResponse?.features
            : rawStations.features;
        } catch (e) {
          console.log(e)
          shitsFucked = true;
          shitsFuckedSource = 'amtrak';
          return [];
        }
      },
      'amtrakStationsGTFS': (r) => r.json(),
      'viaRailData': (r) => r.json(),
      'viaRailGTFS': (r) => r.json(),
      'brightlineTimes': (r) => r.arrayBuffer().then((buf) => GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buf))),
      'brightlinePositions': (r) => r.arrayBuffer().then((buf) => GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buf))),
      'brightlineGTFS': (r) => r.json()
    };

    // fetching all of our data asyncronously
    const fetchedDataRes = await Promise.all(Object.keys(urlsToFetch).map((key) => fetch(urlsToFetch[key] + `?currentTime=${Date.now()}`)));

    //processing our data bit less asyncronously
    const urlKeys = Object.keys(processRequests);
    for (let i = 0; i < urlKeys.length; i++) {
      const key = urlKeys[i];
      const processed = await processRequests[key](fetchedDataRes[i]);
      fetchedData[key] = processed;
    }

    let finalAmtrak = {
      stations: {},
      trains: {},
    };
    let finalVia = {
      stations: {},
      trains: {},
    };
    let finalBrightline = {
      stations: {},
      trains: {},
    };

    //processing the data
    //amtrak up first
    //console.log(fetchedData)

    return false;
    //return responseObject;
  } catch (e) {
    console.log(e);
    return {
      stations: {}
    };
  }
};

exports.update = updateFeed;
