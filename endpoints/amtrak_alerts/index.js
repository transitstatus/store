const fs = require('fs');
const nodeFetch = require('node-fetch'); // need a separate instance of fetch because reasons

const sleep = ms => new Promise(r => setTimeout(r, ms));

const extractAlertsFromTrain = (train) => {
  let alertTextsRaw = [];
  let alertTextsComparable = [];
  for (let i = 0; i < train.stops.length; i++) {
    //if (i > 0) continue; // seemingly the same alert is posted, just multiple times?
    const stop = train.stops[i];
    let stopStatusInfo = null;
    if (stop.arrival?.statusInfo) stopStatusInfo = stop.arrival.statusInfo;
    if (stop.departure?.statusInfo) stopStatusInfo = stop.departure.statusInfo;

    if (!stopStatusInfo.detailedMessage) continue;

    const message = stopStatusInfo.detailedMessage.split('\n')[0];
    const comparableMessage = message.replace(/\d+\:\d+ [AP]M [ECMP]T/, '').replace(/\d+ hours( and \d+ minutes)/, '');
    if (!alertTextsComparable.includes(comparableMessage)) {
      alertTextsRaw.push(message);
      alertTextsComparable.push(comparableMessage);
    };
  };

  return alertTextsRaw;
};

const updateFeed = async () => {
  try {
    const now = new Date();

    let responseObject = {
      trains: {},
      meta: {
        numWithAlerts: 0,
        numWithoutAlerts: 0,
        trainsWithAlerts: [],
        trainsWithoutAlerts: [],
        errorsEncountered: [],
      },
    };

    const trainIDs = await fetch('https://api.amtraker.com/v3/ids').then((res) => res.json());

    const setupFetchRes = await nodeFetch("https://www.amtrak.com/eymoNXDNm7bbwqa38ydg/3aO5GVz2f06z3X/XmE7QS8hAQ/WQE8U14D/NEE", {
      "credentials": "include",
      "headers": {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.5",
        "CSRF-Token": "undefined",
        "Content-Type": "text/plain;charset=UTF-8",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "Priority": "u=0",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache"
      },
      "referrer": "https://www.amtrak.com/home.html",
      "body": "{}",
      "method": "POST",
      "mode": "cors"
    });

    for (let i = 0; i < trainIDs.length; i++) {
      const trainID = trainIDs[i];

      if (trainID.startsWith('v') || trainID.startsWith('b')) continue; //not amtrak

      const splitID = trainID.split('-');

      const trainNum = splitID[0];
      const trainDate = `20${splitID[3]}-${splitID[1].padStart(2, '0')}-${splitID[2].padStart(2, '0')}`;
      const shortID = `${trainNum}-${splitID[2]}`;

      const trainDataRes = await fetch(`https://www.amtrak.com/dotcom/travel-service/statuses/${trainNum}?service-date=${trainDate}`, {
        "credentials": "include",
        "headers": {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.5",
          "Content-Type": "application/json",
          "x-amtrak-trace-id": "",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-origin",
          "Pragma": "no-cache",
          "Cache-Control": "no-cache"
        },
        "referrer": "https://www.amtrak.com/home.html",
        "method": "GET",
        "mode": "cors"
      }).then((res) => res.json());

      if (!trainDataRes.data) { // no data, train is probably either pre-departure or completed
        //console.log(trainDataRes)
        responseObject.meta.errorsEncountered.push({
          trainID: shortID,
          ...(trainDataRes.error ?? {}),
        })
        continue;
      }

      const alerts = extractAlertsFromTrain(trainDataRes.data[0]);

      if (alerts.length > 0) {
        responseObject.trains[shortID] = alerts;
        responseObject.meta.numWithAlerts++;
        responseObject.meta.trainsWithAlerts.push(shortID);
      } else {
        responseObject.meta.numWithoutAlerts++;
        responseObject.meta.trainsWithoutAlerts.push(shortID);
      }

      sleep(10); // eh why not
    }

    console.log(`Finished updating Amtrak Alerts`)
    return responseObject;
  } catch (e) {
    console.log(e);
    return {
      trains: {}
    };
  }
};

exports.update = updateFeed;
