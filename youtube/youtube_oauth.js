const fs = require('fs');
const express = require('express');
const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;
require('dotenv').config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

const SCOPES = ['https://mail.google.com/']; // Scope for accessing Gmail
const TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE) + '/.credentials/';
const TOKEN_PATH = TOKEN_DIR + 'gmail-nodejs-quickstart.json';

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
    getGmailLabels(oauth2Client); // Fetch Gmail labels
    res.send('Authentication successful! You can close this window.');
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

    // Fetch user profile information
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    gmail.users.getProfile({
      userId: 'me'
    }, (err, res) => {
      if (err) {
        console.error('Error fetching profile information:', err);
        return;
      }
      const profile = res.data;
      console.log('Profile:', profile);

      // Combine credentials and profile information
      const credentialsWithProfile = {
        credentials: oauth2Client.credentials,
        profile: profile
      };

      // Write credentials and profile to a separate file
      const credentialsPath = './credentials/gmail-credentials.json'; // Change the path as needed
      fs.writeFile(credentialsPath, JSON.stringify(credentialsWithProfile), (err) => {
        if (err) throw err;
        console.log('Gmail credentials and profile stored to ' + credentialsPath);
      });
    });
  });
}

function getGmailLabels(auth) {
  const gmail = google.gmail({ version: 'v1', auth });
  gmail.users.labels.list({
    userId: 'me' // 'me' refers to the authenticated user
  }, (err, res) => {
    if (err) {
      console.error('The API returned an error:', err);
      return;
    }
    const labels = res.data.labels;
    if (labels.length) {
      console.log('Labels:');
      labels.forEach((label) => {
        console.log(`- ${label.name}`);
      });
    } else {
      console.log('No labels found.');
    }
  });
}
