const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

const validatePhoneNumber = (phone) => {
  const phoneRegex = /^[\d\-\+\(\)\s]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, "").length >= 10;
};

const validateUserRegistration = (data) => {
  const errors = {};

  if (!data.email || !validateEmail(data.email)) {
    errors.email = "Invalid email format";
  }

  if (!data.password || !validatePassword(data.password)) {
    errors.password =
      "Password must be at least 8 characters with uppercase, lowercase, number and special character";
  }

  if (!data.firstName || data.firstName.trim().length < 2) {
    errors.firstName = "First name must be at least 2 characters";
  }

  if (!data.lastName || data.lastName.trim().length < 2) {
    errors.lastName = "Last name must be at least 2 characters";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export { validateEmail, validatePassword, validatePhoneNumber, validateUserRegistration };

export default {
  validateEmail,
  validatePassword,
  validatePhoneNumber,
  validateUserRegistration,
};
