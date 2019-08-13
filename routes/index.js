const express = require('express');
const moment = require('moment');
const uuidv4 = require('uuid/v4');

const dynamo = require('./../dynamo');

const REQUEST_TIMEOUT = 3600000;
const RETRY_TIMEOUT = 15000;

let users = {};
let connections = {};

let router = express.Router();

router.get('/subscribe', async (req, res, next) => {
  let { userId } = req.query;
  let id = uuidv4();

  // add the connection to the pool
  if (users[userId] === undefined) {
    users[userId] = [];
  }
  users[userId].push(id);
  connections[id] = { userId, connection: res };

  // set response headers
  res.set({
    Connection: 'keep-alive',
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
  });

  // set request timeout
  req.setTimeout(REQUEST_TIMEOUT);

  // set connection retry timeout
  res.write('retry:' + RETRY_TIMEOUT + '\n');

  // first event
  let timestamp = moment().subtract(30, 'days').startOf('day').unix();
  let notifications = await dynamo.query(userId, timestamp, 10);

  res.write('event:recent\n');
  if (notifications.length > 0) {
    let data = notifications.map((notification) => {
      return {
        ...notification.data,
        uuid: notification.uuid,
        timestamp: notification.timestamp,
      };
    });
    res.write('data:' + JSON.stringify(data) + '\n\n');
  } else {
    res.write('data:[]\n\n');
  }

  // remove connection when it is closed
  req.on('close', () => {
    if (connections[id] === undefined) return;
    let { userId, connection } = connections[id];

    connection.status(400).send();

    if (users[userId] !== undefined) {
      let index = users[userId].indexOf(id);
      if (index >= 0) {
        users[userId].splice(index, 1);
      }
      if (users[userId].length === 0) {
        delete users[userId];
      }
    }
    delete connections[id];
  });
});

router.post('/users/:id/messages', async (req, res, next) => {
  let userId = req.params.id;
  let data = req.body;

  let uuid = uuidv4();
  let timestamp = new Date().getTime();

  await dynamo.insert(uuid, timestamp, userId, data);

  if (users[userId] === undefined) {
    return res.status(200).send();
  }

  let subscribers = users[userId].map(id => connections[id].connection);

  let message = { ...data, uuid, timestamp };
  for (let i = 0; i < subscribers.length; i += 1) {
    subscribers[i].write('event:notification\n');
    subscribers[i].write('data:' + JSON.stringify(message) + '\n');
    subscribers[i].write('\n');
  }

  res.status(200).send();
});

router.post('/read', async (req, res, next) => {
  let { uuid, timestamp } = req.query;
  await dynamo.read(uuid, timestamp);
  res.status(200).send();
});

module.exports = router;