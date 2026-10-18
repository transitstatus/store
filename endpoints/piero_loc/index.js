const PocketBase = require("pocketbase/cjs");

const pb = new PocketBase("https://pb.amtraker.com/");

require("dotenv").config();

const update = async () => {
  if (!process.env.pb_wheres_piero_email || !process.env.pb_wheres_piero_pw) return { functional: true };

  try {
    const authData = await pb
      .collection("users_wheres_piero")
      .authWithPassword(process.env.pb_wheres_piero_email, process.env.pb_wheres_piero_pw);

    let status = { functional: true };
    let devices = {};
    let idToUid = {};

    const startOfTrip = new Date("2026-10-18T06:00:00-05:00");
    const now = new Date();

    const deviesList = await fetch("https://traccar.pgm.sh/api/devices", {
      headers: { Authorization: process.env.traccar_auth }
    }).then((res) => res.json());

    const targetDevices = deviesList.filter((device) => device.uniqueId.startsWith("piero"));
    const targetDeviceIDs = targetDevices.map((device) => device.id);

    // setting up devices
    targetDevices.forEach((device) => {
      devices[device.uniqueId] = {
        uid: device.uniqueId,
        id: device.id,
        name: device.name,
        lastUpdated: device.lastUpdate,
        latestPositionID: device.positionId,
        positions: [],
        mostRecentPositon: null
      };

      idToUid[device.id] = device.uniqueId;
    });

    const positionsData = await fetch(
      `https://traccar.pgm.sh/api/positions?deviceId=${targetDeviceIDs.slice(0, 10).join(",")}&from=${startOfTrip.toISOString()}&to=${now.toISOString()}`,
      { headers: { Authorization: process.env.traccar_auth } }
    ).then((res) => res.json());

    positionsData
      .map((position) => {
        return { ...position, fixTimeNum: new Date(position.fixTime).valueOf() };
      })
      .sort((a, b) => a.fixTimeNum - b.fixTimeNum)
      .forEach((position) => {
        if (!devices[idToUid[position.deviceId]]) return;

        devices[idToUid[position.deviceId]].positions.push({
          positionID: position.id,
          time: position.fixTime,
          lat: position.latitude,
          lon: position.longitude,
          alt: position.altitude,
          heading: position.course,
          acc: position.accuracy
        });

        mostRecentPositon = {
          positionID: position.id,
          time: position.fixTime,
          lat: position.latitude,
          lon: position.lon,
          alt: position.altitude,
          heading: position.course,
          acc: position.accuracy
        };
      });

    // uploading the new file
    const newRecord = await pb
      .collection("wheres_piero")
      .create({
        file: new File(
          [JSON.stringify(devices)],
          `${now.toISOString().split(".")[0].replaceAll("-", "_").replaceAll(":", "_")}.json`
        )
      });

    // getting all records and deleting the old ones
    const allRecords = await pb.collection("wheres_piero").getFullList({ sort: "-created" });
    for (let i = 0; i < allRecords.length; i++) {
      if (i < 3) continue; // keeping the last 3 files in case of some weird edge case where someone's client fetches the most recent file name but lags on fetching the latest file

      await pb.collection("wheres_piero").delete(allRecords[i].id);
    }

    return status;
  } catch (e) {
    console.log(e);
    console.log(process.version);
    return { functional: false };
  }
};

exports.update = update;
