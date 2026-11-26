//require express
const express = require ('express')
const { rateLimit } = require("express-rate-limit");

const User = require('../models/User');
const {
    register,
    login,
    sendPhoneVerificationCode,
    verifyPhoneVerificationCode,
} = require('../controllers/auth.controller');
const isAuth = require('../middlewares/isAuth');
const { registerValidation, validation, loginValidation } = require('../middlewares/validator');

const router = express.Router()

const phoneCodeSendLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: { errors: [{ msg: "Trop de demandes de code. Réessayez dans quelques minutes." }] },
});
const phoneCodeVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
    message: { errors: [{ msg: "Trop de tentatives. Réessayez dans quelques minutes." }] },
});

// Vérification SMS temporairement désactivée ; la validité du numéro est contrôlée à l'inscription.
// router.post('/phone/send-code', phoneCodeSendLimiter, sendPhoneVerificationCode);
// router.post('/phone/verify-code', phoneCodeVerifyLimiter, verifyPhoneVerificationCode);

// test
// router.get('/essai', (req, res) => {
//     res.status(200).json("le test de la route user!")
// })



//register: sign up
router.post('/register', registerValidation(), validation, register)


//login : sign in
router.post('/login', loginValidation(), validation, login)

//current = l'utilisateur connecté
router.get("/current", isAuth, (req,res) => {
    res.json(req.user)
})



    module.exports = router;