
const Professional = require("../models/Professional");
// const Profesional = require("../models/Professional");
const User = require("../models/User");
const cloudinary = require('../utils/cloudinary');
const upload = require("../utils/multer");

exports.becomeProfessional = async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload(req.file.path);
    const {
      governorat,
      delegation,
      cite,
      photo,
      speciality,
      description,
      zoneDeplacement,
      statutValidation
    } = req.body;

// console.log(req.body)

    // Vérifie si le profil existe déjà
    // console.log(req.user._id)
    // console.log("body:", req.body);
// console.log("file:", req.file);
    const existing = await Professional.findOne({ user: req.user._id });
// console.log(existing)
    if (existing) {
      return res
        .status(400)
        .json({errors: [{ msg: "Vous avez déjà soumis une demande." }]});
    }
    // const result = await cloudinary.uploader.upload(req.file.path);
    const profile = new Professional({
      user: req.user._id,
      governorat,
      delegation,
      cite,
      photo:result.secure_url,
      cloudinary_id:result.public_id,
      speciality,
      description,
      zoneDeplacement,
      statutValidation

    });
    await profile.save();

    res.status(200).json({success: [{ msg: "Demande soumise avec succès.", profile }]});
  } catch (error) {
    
    // res.status(400).json( { msg: "Erreur serveur lors de la soumission.", error });
    console.error("Erreur complète :", error);
  res.status(400).json({
    errors: [
      {
        msg: "Erreur serveur lors de la soumission.",
        error: error.message || error,
      },
    ],
  });
  }
};


// filter by speciality

exports.filterProfessionals = async (req, res) => {
  try {
    const { speciality } = req.query;

    const query = {
    };

    if (speciality) {
      query.speciality = speciality;
    }

    const filteredList = await Professional.find(query).populate("user");
    const listeFiltre=filteredList.filter((elmt) => (elmt.statutValidation !== "refusé"))
    console.log("filteredList:", listeFiltre)

    res.status(200).json(listeFiltre);
  } catch (error) {
    res.status(400).json({ errors: [{ msg: "Erreur serveur lors du filtrage",error }] });
  }
};

// voir tout les professionnels

exports.getAllPro = async (req, res)  => {
  try {
    const listPro = await Professional.find().populate('user');
    res.status(200).json({msg:"la liste des professionnels.", listPro})
  } catch (error) {
    res.status(400)
    .json({msg:"erreur serveur lors du chargement des professionnels", error})
  }
}


// GET /api/professionals/validé et en attente
exports.getProValideOuEnAttente = async (req, res) => {
  try {
    const validList = await Professional.find({
      statutValidation: { $in: ["validé", "en attente"] }
    }).populate("user");

    res.status(200).json({ validList });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

exports.searchProfessionals = async (req, res) => {
  try {
    const { name, city } = req.query;
    const searchTerm = String(name || city || "").trim();

    if (searchTerm.length < 2 || searchTerm.length > 100) {
      return res.status(400).json({
        msg: "La recherche doit contenir entre 2 et 100 caractères.",
      });
    }

    const escapedTerms = searchTerm
      .split(/\s+/)
      .map((term) => new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    let userIds;

    if (name) {
      const matchingUsers = await User.find({
        $and: escapedTerms.map((term) => ({
          $or: [{ name: term }, { lastName: term }],
        })),
      }).select("_id");
      userIds = matchingUsers.map((user) => user._id);

      if (userIds.length === 0) {
        return res.status(200).json({ professionals: [] });
      }
    }

    const query = {
      statutValidation: { $in: ["validé", "en attente"] },
      ...(userIds && { user: { $in: userIds } }),
    };

    if (city) {
      const cityPattern = new RegExp(
        searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );
      query.$or = [
        { cite: cityPattern },
        { delegation: cityPattern },
        { governorat: cityPattern },
      ];
    }

    const professionals = await Professional.find(query)
      .populate("user", "name lastName phone")
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({ professionals });
  } catch (error) {
    res.status(500).json({
      msg: "Erreur serveur lors de la recherche des professionnels.",
    });
  }
};

// GET /api/professionals/en attente
exports.getProEnAttente = async (req, res) => {
  try {
    const listeEnAttente = await Professional.find({
      statutValidation: 'en attente',
    }).populate('user');

    res.status(200).json({listeEnAttente});
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error });
  }
}

//
exports.getProByuserId = async (req, res) => {
  try {
    const pro = await Professional.findOne({ user: req.params.userId }).populate("user");
    if (!pro) {
      return res.status(404).json({ msg: "Profil pro non trouvé" });
    }
    res.status(200).json({ pro });
  } catch (error) {
    res.status(500).json({ msg: "Erreur serveur", error });
  }
};


// voir un seul pro

// exports.getOnePro = async (req, res) => {
//   try {
//     const {id} = req.params;
//     const proToGet = await Professional.findById(id).populate('user')
//     if(!proToGet) {
//       return res.status(400).json({msg:"professionnel non trouvé"})
//     }
// res.status(200).json({ proToGet });  } 
// catch (error) {
//     res.status(400)
//     .json({ errors: [{ msg: "erreur serveur lors du chargement des professionnels" }], error })
//   }
// }
exports.getOnePro = async (req, res) => {
  try {
    const pro = await Professional.findById(req.params.id).populate("user");
    if (!pro) {
      return res.status(404).json({ msg: "Professionnel non trouvé" });
    }
    res.status(200).json({ pro });
  } catch (error) {
    res.status(500).json({ msg: "Erreur serveur", error });
  }
};

// mise à jour de mon profile Pro
exports.updateProfilePro = async (req, res) => {
  try {
    const { id } = req.params;
    const profileToEdit = await Professional.findById(id);
    if (!profileToEdit) {
      return res.status(404).json({ msg: "Profil non trouvé" });
    }
    if (
      !req.user.isAdmin &&
      String(profileToEdit.user) !== String(req.user._id)
    ) {
      return res.status(403).json({ msg: "Vous ne pouvez pas modifier ce profil." });
    }

    const userToEdit = await User.findById(profileToEdit.user);
    if (!userToEdit) {
      return res.status(404).json({ msg: "Compte utilisateur introuvable." });
    }

    if (
      Object.prototype.hasOwnProperty.call(req.body, "phone") &&
      String(req.body.phone) !== String(userToEdit.phone)
    ) {
      return res.status(400).json({
        msg: "La modification du téléphone nécessite une nouvelle vérification par SMS.",
      });
    }

    const { name, lastName, email, governorat, delegation, cite, speciality,
      zoneDeplacement, description } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ msg: "Le prénom est obligatoire." });
    }
    if (typeof lastName !== "string" || !lastName.trim()) {
      return res.status(400).json({ msg: "Le nom est obligatoire." });
    }
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ msg: "Entrez une adresse e-mail valide." });
    }
    if (
      typeof governorat !== "string" ||
      typeof delegation !== "string" ||
      typeof cite !== "string" ||
      !governorat.trim() ||
      !delegation.trim() ||
      !cite.trim()
    ) {
      return res.status(400).json({ msg: "Complétez la localisation professionnelle." });
    }
    if (
      !(typeof speciality === "string" && speciality.trim()) &&
      !(Array.isArray(speciality) && speciality.some((value) => typeof value === "string" && value.trim()))
    ) {
      return res.status(400).json({ msg: "Choisissez une spécialité." });
    }
    if (typeof description !== "string" || !description.trim()) {
      return res.status(400).json({ msg: "La description est obligatoire." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const escapedEmail = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const existingEmail = await User.findOne({
      email: { $regex: `^${escapedEmail}$`, $options: "i" },
      _id: { $ne: userToEdit._id },
    }).select("_id");
    if (existingEmail) {
      return res.status(409).json({ msg: "Cette adresse e-mail est déjà utilisée." });
    }

    userToEdit.name = name.trim();
    userToEdit.lastName = lastName.trim();
    userToEdit.email = normalizedEmail;
    profileToEdit.governorat = governorat.trim();
    profileToEdit.delegation = delegation.trim();
    profileToEdit.cite = cite.trim();
    profileToEdit.speciality = Array.isArray(speciality)
      ? speciality.filter((value) => typeof value === "string").map((value) => value.trim()).filter(Boolean)
      : [speciality.trim()];
    profileToEdit.zoneDeplacement = typeof zoneDeplacement === "string"
      ? zoneDeplacement.trim()
      : "";
    profileToEdit.description = description.trim();

    await Promise.all([userToEdit.validate(), profileToEdit.validate()]);
    await Promise.all([userToEdit.save(), profileToEdit.save()]);

    return res.status(200).json({
      msg: "Profil mis à jour avec succès.",
      profileToEdit,
      userToEdit: {
        _id: userToEdit._id,
        name: userToEdit.name,
        lastName: userToEdit.lastName,
        email: userToEdit.email,
        phone: userToEdit.phone,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ msg: "Cette adresse e-mail est déjà utilisée." });
    }
    console.error("Erreur lors de la mise à jour du profil professionnel :", error);
    return res.status(500).json({
      msg: "Impossible d’enregistrer les modifications du profil.",
    });
  }
};
