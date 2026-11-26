const twilio = require("twilio");

const getTwilioVerifyService = () => {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID } =
    process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_VERIFY_SERVICE_SID) {
    const error = new Error("Twilio Verify is not configured.");
    error.code = "TWILIO_NOT_CONFIGURED";
    throw error;
  }

  return twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN).verify.v2.services(
    TWILIO_VERIFY_SERVICE_SID
  );
};

module.exports = getTwilioVerifyService;
