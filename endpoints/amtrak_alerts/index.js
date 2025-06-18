const fs = require('fs');
const nodeFetch = require('node-fetch'); // need a separate instance of fetch because reasons

const sleep = ms => new Promise(r => setTimeout(r, ms));

const blobsToRemove = [
  "Please standby for further information.",
  "We apologize for the inconvenience and thank you for your patience.",
  "For customers waiting to board this train, please be aware that departure estimates are subject to change.",
  "If conditions allow, a train delayed past its scheduled departure time may leave earlier than the updated estimate.",
  "To avoid missing your train, please stay near the boarding area and monitor for announcements or updates.",
  "We appreciate your continued patience and apologize for the delay.",
  "We sincerely apologize for the delay and appreciate your continued patience.",
  "We thank you for your patience and will provide updates as more information becomes available.",
  "If a train is delayed past its scheduled departure time, it may still leave earlier than the updated estimate, if conditions allow.",
  "For customers still waiting to board this train, departure estimates are subject to change.",
  "We sincerely apologize for any inconvenience.",
  "We sincerely appreciate your continued patience and apologize for the lengthy delay.",
  "We apologize for the delay.",
  "We apologize for any inconvenience this may cause.",
  "We sincerely appreciate your patience and apologize for the delay.",
  "We sincerely appreciate your continued patience and apologize for any inconvenience this has caused.",
  "We appreciate your patience during this process and are committed to providing additional details as soon as they become available."
];

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

    let message = stopStatusInfo.detailedMessage.split('\n')[0];

    const comparableMessage = message.replace(/\d+\:\d+ [AP]M [ECMP]T/, '').replace(/\d+ hours( and \d+ minutes)/, '');
    if (!alertTextsComparable.includes(comparableMessage)) {
      for (let i = 0; i < blobsToRemove.length; i++) {
        message = message.replace(blobsToRemove[i], '');
      };
      message = message.trim();
      
      if (message.length > 0) {
        alertTextsRaw.push(message);
        alertTextsComparable.push(comparableMessage);
      }
    };
  };

  return alertTextsRaw;
};

const updateFeed = async (updateConfig) => {
  const now = Date.now();
  try {
    let responseObject = {
      trains: {},
      meta: {
        timeUpdated: now,
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

      const timeBeforeFetch = Date.now();

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
      })
        .then((res) => res.json())
        .catch((e) => {
          console.log('error fetching alerts for amtrak train', trainNum, trainDate)
          return { error: { message: e.toString() } }
        });

      if (!trainDataRes || !trainDataRes.data) { // no data, train is probably either pre-departure or completed
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

      sleep(Date.now() - timeBeforeFetch + 250 + 25); // making sure the time between now and when we started the fetch has been at least 250ms, but doing 275 for safety
    }

    console.log(`Finished updating Amtrak Alerts`)
    return responseObject;
  } catch (e) {
    console.log('Error with Amtrak Alerts')
    const errorMessage = e.message;
    const errorString = e.toString();

    if (updateConfig.firstUpdate) {
      const initialState = await fetch('https://store.transitstat.us/amtrak_alerts').then((res) => res.json());
      return initialState;
    };

    return {
      trains: {},
      meta: {
        timeUpdated: now,
        numWithAlerts: 0,
        numWithoutAlerts: 0,
        trainsWithAlerts: [],
        trainsWithoutAlerts: [],
        errorsEncountered: [{
          trainID: 'all',
          code: 'ERROR_CATCH',
          message: errorString,
          detailedMessage: errorMessage,
          businessMessage: '',
        }],
      },
    };
  }
};

exports.update = updateFeed;
