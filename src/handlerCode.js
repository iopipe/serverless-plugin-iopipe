exports['EXPORT_NAME'] = function FUNCTION_NAME(event, context, callback) {
  try {
    return iopipe((evt, ctx, cb) => {
      return require('../RELATIVE_PATH').METHOD(evt, ctx, cb);
    })(event, context, callback);
  } catch (err) {
    throw err;
  }
};
