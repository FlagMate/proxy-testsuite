export function validateApiResponse(response, validationFn) {
  try {
    const result = validationFn(response);
    return { valid: true, result };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// Example validation functions
export const validateArrayResponse = (response) => {
  if (!Array.isArray(response)) {
    throw new Error('Response is not an array');
  }
  response.forEach((item) => {
    if (!item.hasOwnProperty('id') || !item.hasOwnProperty('title')) {
      throw new Error('Missing required keys');
    }
  });
  return response;
};
