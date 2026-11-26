const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const getTwilioVerifyService = require("../utils/twilioVerify");
const {
  legacyPhoneCandidates,
  normalizeTunisianPhone,
} = require("../utils/tunisianPhone");

const findExistingPhone = (phone) =>
  User.collection.findOne({ phone: { $in: legacyPhoneCandidates(phone) } });

exports.sendPhoneVerificationCode = async (req, res) => {
  const phone = normalizeTunisianPhone(req.body.phone);
  if (!phone) {
    return res.status(400).json({
      errors: [{ msg: "Entrez un numéro mobile tunisien valide (ex. 20 123 456)." }],
    });
  }

  try {
    if (await findExistingPhone(phone)) {
      return res.status(409).json({
        errors: [{ msg: "Ce numéro ne peut pas être utilisé pour ce compte." }],
      });
    }

    await getTwilioVerifyService().verifications.create({
      to: phone,
      channel: "sms",
    });
    return res.status(200).json({ msg: "Code de vérification envoyé par SMS." });
  } catch (error) {
    if (error.code === "TWILIO_NOT_CONFIGURED") {
      return res.status(503).json({
        errors: [{ msg: "Le service de vérification SMS n’est pas encore configuré." }],
      });
    }
    console.error("Erreur Twilio Verify (envoi) :", error.code || "unknown");
    return res.status(502).json({
      errors: [{ msg: "Impossible d’envoyer le SMS. Vérifiez le numéro et réessayez." }],
    });
  }
};

exports.verifyPhoneVerificationCode = async (req, res) => {
  const phone = normalizeTunisianPhone(req.body.phone);
  const code = String(req.body.code || "").trim();
  if (!phone) {
    return res.status(400).json({
      errors: [{ msg: "Entrez un numéro mobile tunisien valide." }],
    });
  }
  if (!/^\d{4,10}$/.test(code)) {
    return res.status(400).json({
      errors: [{ msg: "Entrez le code reçu par SMS." }],
    });
  }

  try {
    if (await findExistingPhone(phone)) {
      return res.status(409).json({
        errors: [{ msg: "Ce numéro ne peut pas être utilisé pour ce compte." }],
      });
    }

    const verification = await getTwilioVerifyService().verificationChecks.create({
      to: phone,
      code,
    });
    if (verification.status !== "approved") {
      return res.status(400).json({
        errors: [{ msg: "Code incorrect ou expiré. Vérifiez le code reçu." }],
      });
    }

    const phoneVerificationToken = jwt.sign(
      { purpose: "phone-registration", phone },
      process.env.SECRET_KEY,
      { expiresIn: "10m" }
    );
    return res.status(200).json({
      msg: "Numéro vérifié.",
      phone,
      phoneVerificationToken,
    });
  } catch (error) {
    if (error.code === "TWILIO_NOT_CONFIGURED") {
      return res.status(503).json({
        errors: [{ msg: "Le service de vérification SMS n’est pas encore configuré." }],
      });
    }
    if ([400, 404].includes(error.status)) {
      return res.status(400).json({
        errors: [{ msg: "Code incorrect ou expiré. Vérifiez le code reçu." }],
      });
    }
    if (error.status === 429) {
      return res.status(429).json({
        errors: [{ msg: "Trop de tentatives. Réessayez plus tard." }],
      });
    }
    console.error("Erreur Twilio Verify (vérification) :", error.code || "unknown");
    return res.status(502).json({
      errors: [{ msg: "La vérification du code a échoué. Réessayez." }],
    });
  }
};

exports.register = async (req, res) => {
  try {
    const { name, lastName, email, password } = req.body;
    const phone = normalizeTunisianPhone(req.body.phone);
    if (!phone) {
      return res.status(400).json({
        errors: [{ msg: "Entrez un numéro mobile tunisien valide." }],
      });
    }

    if (await findExistingPhone(phone)) {
      return res.status(409).json({
        errors: [{ msg: "Ce numéro ne peut pas être utilisé pour ce compte." }],
      });
    }

    const foundUser = await User.findOne({ email });
    if (foundUser) {
      return res
        .status(409)
        .json({ errors: [{ msg: "cet email existe déjà!" }] });
    }
    const saltRounds = 10;
    const hashPassword = await bcrypt.hash(password, saltRounds);
    const newUser = new User({
      name,
      lastName,
      email,
      password: hashPassword,
      phone,
    });
    await newUser.save();
    const token = jwt.sign({ id: newUser._id }, process.env.SECRET_KEY, {
      expiresIn: "1d",
    });

    res.status(200).json({
      success: [{ msg: "L'enregistrement a été effectué avec succès !!" }],
      user: {
        _id: newUser._id,
        name: newUser.name,
        lastName: newUser.lastName,
        email: newUser.email,
        phone: newUser.phone,
        isAdmin: newUser.isAdmin,
      },
      token,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        errors: [{ msg: "Cet e-mail ou ce numéro est déjà associé à un compte." }],
      });
    }
    console.error("Erreur lors de l’inscription :", error.message);
    res
      .status(500)
      .json({ errors: [{ msg: "L'enregistrement a échoué. Veuillez réessayer." }] });
  }
};

//login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const foundUser = await User.findOne({ email });
    if (!foundUser) {
      return res
        .status(400)
        .json({ errors: [{ msg: "Email ou mot de passe incorrect 1" }] });
    }
    const checkPassword = await bcrypt.compare(password, foundUser.password);
    if (!checkPassword) {
      return res
        .status(400)
        .json({ errors: [{ msg: "Email ou mot de passe incorrect 2" }] });
    }
    const token = jwt.sign({ id: foundUser._id }, process.env.SECRET_KEY, {
      expiresIn: "1d",
    });
    const { _id, name, lastName, email: userEmail, phone, isAdmin } = foundUser;

    res.status(200).json({
      success: [{ msg: "Connexion réussie." }],  
      user: { _id, name, lastName, email: userEmail, phone, isAdmin },
      token,
    });
  } catch (error) {
     res
      .status(400)
      .json({ errors: [{ msg: "Une erreur est survenue lors de la connexion!" }], error });
  }
};
