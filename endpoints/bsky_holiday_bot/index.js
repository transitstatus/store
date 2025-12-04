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

const usTimeFormat = new Intl.DateTimeFormat('en-US', {
  timeStyle: 'short',
  timeZone: 'America/Chicago',
});
const usTimeStamp = (arrivalTime) => {
  const arrival = new Date(arrivalTime);
  return usTimeFormat.format(arrival);
}

const postMessage = (endpoint, type, runNumber, sessData, now) => {
  try {
    fetch(endpoint)
      .then((res) => res.text())
      .then((rawData) => {
        if (rawData === 'Not found' || rawData.startsWith('no available server')) return;

        const data = JSON.parse(rawData);

        const postText = `The CTA Holiday ${type} is on the ${data.line}${type == 'Train' ? ' line' : ''} toward ${data.dest}
Next Stops:
${data.predictions
            .filter((prediction) => type == 'Train' || prediction.actualETA > now.valueOf() + 60000)
            .slice(0, 5).map((prediction) => `• ${prediction.stationName}: ${hoursMinutesUntilArrival(prediction.actualETA)} - ${usTimeStamp(prediction.actualETA)}`)
            .join('\n')}
Track It Here`;
        const postByteNum = new Blob([postText]).size;
        const urlByteNum = new Blob(['Track It Here']).size;

        fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
          method: 'POST',
          body: JSON.stringify({
            "repo": sessData["did"],
            "collection": "app.bsky.feed.post",
            "record": {
              "$type": "app.bsky.feed.post",
              "text": postText,
              facets: [
                {
                  index: {
                    byteStart: postByteNum - urlByteNum,
                    byteEnd: postByteNum
                  },
                  features: [{
                    $type: 'app.bsky.richtext.facet#link',
                    uri: `https://transitstat.us/cta${type.toLowerCase()[0]}/track/${runNumber}`
                  }]
                }
              ],
              "createdAt": now.toISOString(),
            }
          }),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + sessData['accessJwt']
          }
        })
          .then((res) => res.text())
          .then((output) => {
            console.log('Bluesky update result:', output)
          })
      })
  } catch (e) { };
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

    postMessage('http://localhost:3000/cta_trains/transitStatus/trains/1225?t=' + Date.now(), 'Train', '1225', sessData, now);
    postMessage('http://localhost:3000/holidaybus/trains/4374?t=' + Date.now(), 'Bus', '4374', sessData, now);

    return true;
  } catch (e) {
    console.log("Error updating holiday bot:", e)
    return false;
  }

};

exports.update = update;
