const fetch = require('node-fetch');

require('dotenv').config();

const hoursMinutesUntilArrival = (arrivalTime) => {
  const now = new Date();
  const arrival = new Date(arrivalTime);

  const minutes = Math.floor((arrival - now) / 1000 / 60);
  const hours = Math.floor(minutes / 60);

  if (minutes < 1 && hours < 1) return "Due";
  if (hours === 0) return `${minutes % 60}m`;
  if (minutes % 60 === 0) return `${hours}h`;

  return `${hours}h ${minutes % 60}m`;
};

const postMessage = (endpoint, type, runNumber, sessData, now) => {
  fetch(endpoint)
    .then((res) => res.text())
    .then((rawData) => {
      if (rawData === 'Not found') return;

      const data = JSON.parse(rawData);

      const postText = `The CTA Holiday ${type} is Active!
Run #1225 is on the ${data.line} line toward ${data.dest}
Next Stops:
${data.predictions.slice(0, 3).map((prediction) => `• ${prediction.stationName} - ${hoursMinutesUntilArrival(prediction.actualETA)}`).join('\n')}`

      fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
        method: 'POST',
        body: JSON.stringify({
          "repo": sessData["did"],
          "collection": "app.bsky.feed.post",
          "record": {
            "$type": "app.bsky.feed.post",
            "text": postText,
            "createdAt": now.toISOString(),
          }
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + sessData['accessJwt']
        }
      })
    })
}

const update = async () => {
  const now = new Date();

  //exiting without variables
  if (!process.env.bsky_holiday_bot_handle || !process.env.bsky_holiday_bot_password) return false;

  try {
    const sessReq = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
      method: 'POST',
      body: JSON.stringify({
        identifier: process.env.bsky_holiday_bot_handle,
        password: process.env.bsky_holiday_bot_password,
      }),
      headers: { 'Content-Type': 'application/json' }
    })

    const sessData = await sessReq.json();

    postMessage('https://store.transitstat.us/cta_trains/transitStatus/trains/1225', 'Train', '1225', sessData, now);
    postMessage('https://store.transitstat.us/holidaybus/4374', 'Bus', '4374', sessData, now);

    return true;
  } catch (e) {
    console.log("Error updating holiday bot:", e)
    return false;
  }

};

exports.update = update;
