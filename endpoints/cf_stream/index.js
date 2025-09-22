require('dotenv').config();

const updateFeed = async () => {
  try {
    const videosList = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.cf_account_id}/stream`, {
      headers: {
        'X-Auth-Email': process.env.cf_stream_email,
        'Authorization': `Bearer ${process.env.cf_stream_token}`,
      }
    }).then((res) => res.json());

    let finalVideos = {};
    videosList.result.forEach((video) => {
      finalVideos[video.uid] = video;
    });

    return {
      videos: finalVideos,
    }
  } catch (e) {
    console.log(e);
    return {
      videos: {},
    };
  }
};

exports.update = updateFeed;
