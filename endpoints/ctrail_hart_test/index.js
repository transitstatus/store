const { positions } = require("./positions.js");
const { tripUpdates } = require("./tripupdates.js");

const updateFeed = async () => {
  try {
    /*
    const videosList = await fetch(`https://cttprdtmgtfs.ctttrpcloud.com/TMGTFSRealTimeWebService/TripUpdate/TripUpdates.json`).then((res) => res.json());

    return {}
    */

    let positionsDict = {};

    positions.entity.forEach((position) => {
     console.log(position.vehicle.trip.route_id)
    });

    //console.log(tripUpdates)

    return {};
  } catch (e) {
    console.log(e);
    return {};
  }
};

exports.update = updateFeed;
