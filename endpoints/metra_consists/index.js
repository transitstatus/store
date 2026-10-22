const update = (async () => {
  let consists = {};

  try {
    const now = new Date();

    return {
      consists,
      lastUpdated: now.toISOString(),
    }
  } catch (e) {
    console.log(e)
    return false;
  }
})

exports.update = update;
