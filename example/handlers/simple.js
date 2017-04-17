const uuid = require('uuid');

module.exports.handler = (event, context, callback) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Your uuid is: ' + uuid.v4(),
      input: event
    })
  };
  callback(null, response);
};
