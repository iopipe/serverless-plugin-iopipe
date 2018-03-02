exports['EXPORT_NAME'] = function FUNCTION_NAME(event, context, callback) {
  try {
    return iopipe((evt, ctx, cb) => {
      const mod = require('./RELATIVE_PATH');
      return mod.METHOD(evt, ctx, cb);
    })(event, context, callback);
  } catch (err) {
    throw err;
  }
};
