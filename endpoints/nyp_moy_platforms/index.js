const updateFeed = async () => {
  try {
    let responseObject = {};

    //fetching data
    const res = await fetch("https://moynihantrainhall.nyc/wp-admin/admin-ajax.php", {
      "credentials": "include",
      "headers": {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:146.0) Gecko/20100101 Firefox/146.0",
        "Accept": "application/json, text/javascript, *\/*; q=0.01",
        "Accept-Language": "en-US,en;q=0.5",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "Priority": "u=0",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache"
      },
      "referrer": "https://moynihantrainhall.nyc/transportation/",
      "body": "action=ajax_amtrak_refresh",
      "method": "POST",
      "mode": "cors"
    });
    const data = await res.json();

    const justDepartures = data.departures.split('<tbody>')[1].split('</tbody>')[0].split('<tr class="amtrak-header-row">');
    justDepartures.shift();

    justDepartures.forEach((departureString) => {
      const trainNumber = departureString.split('<span class="train-number">')[1].split('</span>')[0];
      const platformNumber = departureString.split('<td class="track-cell">')[1].split('</td>')[0];

      responseObject[trainNumber] = platformNumber;
    })

    console.log(`Finished updating Moynihan Tracks`)
    return {
      stations: {
        NYP: responseObject
      }
    };
  } catch (e) {
    console.log(e);
    return {
      stations: {
        NYP: {}
      }
    };
  }
};

exports.update = updateFeed;
