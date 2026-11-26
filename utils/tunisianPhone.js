const normalizeTunisianPhone = (value) => {
  if (typeof value !== "string" && typeof value !== "number") return null;

  let digits = String(value).trim().replace(/[\s().-]/g, "");
  if (digits.startsWith("00216")) {
    digits = `+${digits.slice(2)}`;
  } else if (digits.startsWith("216")) {
    digits = `+${digits}`;
  } else if (/^[2459]\d{7}$/.test(digits)) {
    digits = `+216${digits}`;
  }

  return /^\+216[2459]\d{7}$/.test(digits) ? digits : null;
};

const legacyPhoneCandidates = (e164Phone) => {
  const nationalNumber = e164Phone.slice(4);
  const countryAndNationalNumber = e164Phone.slice(1);
  return [
    e164Phone,
    nationalNumber,
    countryAndNationalNumber,
    Number(nationalNumber),
    Number(countryAndNationalNumber),
  ];
};

module.exports = { normalizeTunisianPhone, legacyPhoneCandidates };
