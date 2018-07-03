let handler, handlerError;
try {
  handler = require('../RELATIVE_PATH');
} catch (err) {
  handlerError = err;
}

exports['EXPORT_NAME'] = function FUNCTION_NAME(event, context, callback) {
  try {
    return iopipe((evt, ctx, cb) => {
      if (handlerError) {
        return cb(handlerError);
      }
      return handler.METHOD(evt, ctx, cb);
    })(event, context, callback);
  } catch (err) {
    throw err;
  }
};
