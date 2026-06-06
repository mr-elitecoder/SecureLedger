export const sendResponse = (
  res,
  statusCode,
  success,
  message,
  data = null,
) => {
  const response = { success, message };
  if (data) response.data = data;
  res.status(statusCode).json(response);
};

export const sendSuccess = (res, message, data = null, statusCode = 200) => {
  sendResponse(res, statusCode, true, message, data);
};

export const sendError = (res, message, statusCode = 400, data = null) => {
  sendResponse(res, statusCode, false, message, data);
};

export default {
  sendResponse,
  sendSuccess,
  sendError,
};
