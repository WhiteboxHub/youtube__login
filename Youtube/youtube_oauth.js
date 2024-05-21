const fs = require('fs');
const express = require('express');
const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;
require('dotenv').config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

const SCOPES = ['https://www.googleapis.com/auth/youtube.force-ssl']; // Full access to the user's YouTube account
const TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE) + '/.credentials/';
const TOKEN_PATH = TOKEN_DIR + 'youtube-nodejs-quickstart.json';

const oauth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
  res.send('Hello, visit <a href="/auth/google">Authenticate with Google</a> to proceed.');
});

app.get('/auth/google', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  res.redirect(authUrl);
});

app.get('/auth/google/callback', (req, res) => {
  const code = req.query.code;
  oauth2Client.getToken(code, (err, token) => {
    if (err) {
      console.error('Error retrieving access token', err);
      res.send('Error retrieving access token');
      return;
    }
    oauth2Client.credentials = token;
    storeToken(token);
    fetchPrivateVideos(oauth2Client, res);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
    if (err) throw err;
    console.log('Token stored to ' + TOKEN_PATH);
  });
}

function fetchPrivateVideos(auth, res) {
  const youtube = google.youtube({ version: 'v3', auth });

  // Step 1: Fetch the list of videos uploaded by the user
  youtube.search.list({
    part: 'snippet',
    forMine: true,
    type: 'video',
    maxResults: 50
  }, (err, response) => {
    if (err) {
      console.error('Error fetching videos:', err);
      res.send('Error fetching videos');
      return;
    }

    const videoIds = response.data.items.map(item => item.id.videoId);

    // Step 2: Fetch details of each video to check privacy status
    youtube.videos.list({
      part: 'snippet,status',
      id: videoIds.join(',')
    }, (err, response) => {
      if (err) {
        console.error('Error fetching video details:', err);
        res.send('Error fetching video details');
        return;
      }

      const privateVideos = response.data.items.filter(video => video.status.privacyStatus === 'private');

      if (privateVideos.length) {
        console.log('Private Videos:');
        let videoList = '';
        privateVideos.forEach(video => {
          console.log(`- ${video.snippet.title} (ID: ${video.id})`);
          videoList += `- ${video.snippet.title} (ID: ${video.id})<br>`;
        });
        res.send(`Private Videos:<br>${videoList}`);
      } else {
        console.log('No private videos found.');
        res.send('No private videos found.');
      }
    });
  });
}
