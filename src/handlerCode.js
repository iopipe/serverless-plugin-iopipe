exports['EXPORT_NAME'] = function FUNCTION_NAME(event, context, callback) {
  try {
    return iopipe(require('./RELATIVE_PATH').METHOD)(event, context, callback);
  } catch (err) {
    throw err;
  }
};
