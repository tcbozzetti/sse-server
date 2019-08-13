const AWS = require('aws-sdk');
const { unwrap } = require('dynamodb-data-types').AttributeValue;

const TABLE_NAME = 'notifications';
const USER_TABLE_INDEX = 'userId-timestamp-index';

const Dynamo = new AWS.DynamoDB({
  apiVersion: '2012–08–10',
  region: 'sa-east-1',
  credentials: {
    accessKeyId: '[YOUR_AWS_ACCESS_KEY]',
    secretAccessKey: '[YOUR_AWS_SECRET_KEY]',
  },
});

const insert = function(uuid, timestamp, userId, data) {
  return new Promise((resolve, reject) => {
    const params = {
      TableName: TABLE_NAME,
      Item: {
        uuid: { S: uuid },
        timestamp: { N: timestamp.toString() },
        data: {
          M: {
            title: { S: data.title },
            message: { S: data.message },
          },
        },
        userId: { N: userId },
        read: { BOOL: false },
      },
    };
    Dynamo.putItem(params, (err, data) => {
      if (err) {
        return reject(err);
      }
      return resolve(data);
    });
  });
}

const query = function(userId, timestamp, limit) {
  return new Promise((resolve, reject) => {
    const params = {
      TableName: TABLE_NAME,
      IndexName: USER_TABLE_INDEX,
      ProjectionExpression: '#x, userId, #c, #r, #d',
      ExpressionAttributeNames: { '#x': 'uuid', '#d': 'data', '#c': 'timestamp', '#r': 'read' },
      KeyConditionExpression: 'userId = :u AND #c > :c',
      FilterExpression: '#r = :r',
      Limit: limit,
      ExpressionAttributeValues: {
        ':u': { N: userId.toString() },
        ':c': { N: timestamp.toString() },
        ':r': { BOOL: false },
      },
    };
    Dynamo.query(params, (err, data) => {
      if (err) {
        return reject(err);
      }
      let items = data.Items.map(item => unwrap(item));
      return resolve(items);
    });
  });
}

const read = function(uuid, timestamp) {
  return new Promise((resolve, reject) => {
    const params = {
      TableName: TABLE_NAME,
      Key: {
        uuid: { S: uuid },
        timestamp: { N: timestamp },
      },
      ReturnValues: 'NONE',
      ExpressionAttributeNames: { '#r': 'read' },
      UpdateExpression: 'set #r = :r',
      ConditionExpression: '#r = :f',
      ExpressionAttributeValues: {
        ':r': { BOOL: true },
        ':f': { BOOL: false },
      },
    };
    Dynamo.updateItem(params, (err, data) => {
      if (err) {
        return reject(err);
      }
      return resolve(data);
    });
  });
}

module.exports = { insert, query, read };