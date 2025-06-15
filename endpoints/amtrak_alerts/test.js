const fs = require('fs');

fetch("https://www.amtrak.com/eymoNXDNm7bbwqa38ydg/3aO5GVz2f06z3X/XmE7QS8hAQ/WQE8U14D/NEE", {
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
})
  .then((res) => res.text())
  .then((firstFetchData) => {
    fetch("https://www.amtrak.com/dotcom/travel-service/statuses/6?service-date=2025-06-14", {
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
      .then((finalData) => {
        console.log(finalData)

        const targetStop = finalData.data[0].stops
          .filter((stop) => stop.station.code == "EMY")[0];

          console.log("Arrival Track:", targetStop.arrival.track)
          console.log("Departure Track:", targetStop.departure.track)
          console.log("Departure Gate:", targetStop.departure.gate)

        fs.writeFileSync('./data.json', JSON.stringify(targetStop, null, 2), { encoding: 'utf8' });
      })
  })