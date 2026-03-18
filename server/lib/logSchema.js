export const createLogContext = ({
  traceId = null,
  userId = null,
  commandId = null,
  expectedRevision = null,
  newRevision = null,
  errorCode = null,
  extra = {},
} = {}) => ({
  traceId,
  userId,
  commandId,
  expectedRevision,
  newRevision,
  errorCode,
  ...extra,
});

export const logWithSchema = (level, message, context = {}) => {
  const payload = createLogContext(context);
  if (level === 'error') {
    console.error(message, payload);
    return;
  }
  if (level === 'warn') {
    console.warn(message, payload);
    return;
  }
  console.log(message, payload);
};
