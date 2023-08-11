const fetch = require('node-fetch');

const key = process.env.MEGABUSKEY ?? 'PUBLICNQ9YIAYC3O2UPC5GKTDR5DQLT0';

const buses = [
  {
    routeNum: 'M21',
    year: '2023',
    month: '08',
    day: '11',
    time: '0200',
    direction: 'O',
  },
  {
    routeNum: 'M37',
    year: '2023',
    month: '08',
    day: '11',
    time: '0805',
    direction: 'O',
  },
  {
    routeNum: 'M93',
    year: '2023',
    month: '08',
    day: '12',
    time: '1430',
    direction: 'O',
  },
  {
    routeNum: 'M7',
    year: '2023',
    month: '08',
    day: '12',
    time: '2230',
    direction: 'O',
  },
  {
    routeNum: 'M72',
    year: '2023',
    month: '08',
    day: '13',
    time: '0845',
    direction: 'O',
  }
]

const update = async () => {
  let finalBuses = [];

  for (let i = 0; i < buses.length; i++) {
    const bus = buses[i];
    const res = await fetch(`https://coachusa.origin.utrack.com/api/public-trip-by-local-departure-time-v1/${bus.year}-${bus.month}-${bus.day}/${bus.routeNum}/${bus.direction}/${bus.time}?api_key=${key}&debug=false&only_service_classes=CUSA,MBUS`);
    const data = await res.json();
    finalBuses.push(data);
  }

  return finalBuses;
}

exports.update = update;