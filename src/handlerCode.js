exports['EXPORT_NAME'] = function FUNCTION_NAME(event, context, callback) {
  try {
    return iopipe((evt, ctx) => require('./RELATIVE_PATH').METHOD(evt, ctx))(event, context, callback);
  } catch (err) {
    throw err;
  }
};
