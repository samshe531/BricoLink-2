const mongoose = require("mongoose");
const cloudinary = require("../utils/cloudinary");
const Professional = require("../models/Professional");
const Publication = require("../models/Publication");
const PublicationNotification = require("../models/PublicationNotification");

const MAX_PHOTO_PUBLICATIONS = 10;
const MAX_TEXT_PUBLICATIONS = 150;
const MAX_IMAGES_PER_PUBLICATION = 5;
const MAX_CONTENT_LENGTH = 1000;

const publicationQuery = (filter) =>
  Publication.findOne(filter)
    .populate("author", "name lastName")
    .populate("likes", "name lastName")
    .populate("comments.author", "name lastName")
    .populate("photoComments.comments.author", "name lastName");

const getPublicationImages = (publication) => {
  if (publication.images?.length) return publication.images;
  return publication.image ? [publication.image] : [];
};

const getContent = (value) => (typeof value === "string" ? value.trim() : "");

const validatePublicationIds = (req, res) => {
  if (
    !mongoose.isValidObjectId(req.params.professionalId) ||
    !mongoose.isValidObjectId(req.params.publicationId)
  ) {
    res.status(400).json({ msg: "Publication ou profil professionnel invalide." });
    return false;
  }
  return true;
};

const getPublicationForProfile = async (req, res) => {
  const publication = await Publication.findOne({
    _id: req.params.publicationId,
    professional: req.params.professionalId,
  });
  if (!publication) {
    res.status(404).json({ msg: "Publication introuvable." });
    return null;
  }
  return publication;
};

const getCommentTarget = (req, res, publication, isPhotoComment) => {
  if (!mongoose.isValidObjectId(req.params.commentId)) {
    res.status(400).json({ msg: "Commentaire invalide." });
    return null;
  }

  let comments = publication.comments;
  if (isPhotoComment) {
    const imageIndex = Number(req.params.imageIndex);
    const images = getPublicationImages(publication);
    if (
      !Number.isInteger(imageIndex) ||
      imageIndex < 0 ||
      imageIndex >= images.length
    ) {
      res.status(404).json({ msg: "Photo introuvable dans cette publication." });
      return null;
    }
    comments = publication.photoComments.find(
      (photo) => photo.imageIndex === imageIndex
    )?.comments;
  }

  const comment = comments?.id(req.params.commentId);
  if (!comment) {
    res.status(404).json({ msg: "Commentaire introuvable." });
    return null;
  }
  return comment;
};

const getUploadedImages = async (files = []) =>
  Promise.all(
    files.map(async (file) => {
      const uploadResult = await cloudinary.uploader.upload(file.path, {
        folder: "bricolink/publications",
        resource_type: "image",
      });
      return uploadResult.secure_url;
    })
  );

const publicationTypeFilter = (hasImages) => {
  if (hasImages) {
    return {
      $or: [
        { images: { $exists: true, $ne: [] } },
        { image: { $exists: true, $ne: "" } },
      ],
    };
  }
  return {
    $and: [
      { $or: [{ images: { $exists: false } }, { images: { $size: 0 } }] },
      { $or: [{ image: { $exists: false } }, { image: "" }] },
    ],
  };
};

const ensurePublicationCapacity = async (
  professionalId,
  hasImages,
  excludedPublicationId
) => {
  const filter = {
    professional: professionalId,
    ...publicationTypeFilter(hasImages),
  };
  if (excludedPublicationId) filter._id = { $ne: excludedPublicationId };

  const count = await Publication.countDocuments(filter);
  const limit = hasImages ? MAX_PHOTO_PUBLICATIONS : MAX_TEXT_PUBLICATIONS;
  if (count >= limit) {
    return hasImages
      ? "Ce profil a déjà atteint la limite de 10 publications avec photo."
      : "Ce profil a déjà atteint la limite de 150 publications texte uniquement.";
  }
  return "";
};

const populatePublication = async (publication) => {
  await publication.populate([
    { path: "author", select: "name lastName" },
    { path: "comments.author", select: "name lastName" },
    { path: "photoComments.comments.author", select: "name lastName" },
  ]);
  return publication;
};

exports.getProfessionalPublications = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.professionalId)) {
      return res.status(400).json({ msg: "Profil professionnel invalide." });
    }

    const professional = await Professional.findById(req.params.professionalId);
    if (!professional) {
      return res.status(404).json({ msg: "Profil professionnel introuvable." });
    }

    const publications = await Publication.find({
      professional: professional._id,
    })
      .populate("author", "name lastName")
      .populate("likes", "name lastName")
      .populate("comments.author", "name lastName")
      .populate("photoComments.comments.author", "name lastName")
      .sort({ createdAt: -1 })
      .limit(MAX_PHOTO_PUBLICATIONS + MAX_TEXT_PUBLICATIONS);

    res.status(200).json({ publications });
  } catch (error) {
    console.error("Erreur lors du chargement des publications :", error);
    res.status(500).json({ msg: "Impossible de charger les publications." });
  }
};

exports.createProfessionalPublication = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.professionalId)) {
      return res.status(400).json({ msg: "Profil professionnel invalide." });
    }

    const content = getContent(req.body.content);
    const hasImages = Boolean(req.files?.length);
    if (req.files?.length > MAX_IMAGES_PER_PUBLICATION) {
      return res.status(400).json({ msg: "Une publication ne peut pas contenir plus de 5 photos." });
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      return res.status(400).json({ msg: "Le texte ne doit pas dépasser 1000 caractères." });
    }
    if (!content && !hasImages) {
      return res.status(400).json({ msg: "Ajoutez un texte ou au moins une photo." });
    }

    const professional = await Professional.findById(req.params.professionalId);
    if (!professional) {
      return res.status(404).json({ msg: "Profil professionnel introuvable." });
    }

    const isProfileOwner = professional.user.equals(req.user._id);
    if (!req.user.isAdmin && !isProfileOwner) {
      return res.status(403).json({
        msg: "Seul le professionnel concerné ou un administrateur peut publier ici.",
      });
    }

    const capacityError = await ensurePublicationCapacity(
      professional._id,
      hasImages
    );
    if (capacityError) return res.status(400).json({ msg: capacityError });

    const images = await getUploadedImages(req.files);
    const publication = await Publication.create({
      professional: professional._id,
      author: req.user._id,
      content,
      images,
    });

    await populatePublication(publication);
    res.status(201).json({ publication });
  } catch (error) {
    console.error("Erreur lors de la création d'une publication :", error);
    res.status(500).json({ msg: "Impossible de créer la publication." });
  }
};

exports.updateProfessionalPublication = async (req, res) => {
  try {
    if (!validatePublicationIds(req, res)) return;
    const publication = await getPublicationForProfile(req, res);
    if (!publication) return;

    if (!publication.author.equals(req.user._id)) {
      return res.status(403).json({
        msg: "Vous ne pouvez modifier que vos propres publications.",
      });
    }

    const content = getContent(req.body.content);
    const images = req.files?.length
      ? await getUploadedImages(req.files)
      : req.body.removeImages === "true"
        ? []
        : getPublicationImages(publication);
    if (req.files?.length > MAX_IMAGES_PER_PUBLICATION) {
      return res.status(400).json({ msg: "Une publication ne peut pas contenir plus de 5 photos." });
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      return res.status(400).json({ msg: "Le texte ne doit pas dépasser 1000 caractères." });
    }
    if (!content && !images.length) {
      return res.status(400).json({ msg: "Ajoutez un texte ou au moins une photo." });
    }

    const capacityError = await ensurePublicationCapacity(
      publication.professional,
      images.length > 0,
      publication._id
    );
    if (capacityError) return res.status(400).json({ msg: capacityError });

    publication.content = content;
    if (req.files?.length || req.body.removeImages === "true") {
      publication.images = images;
      publication.image = "";
      publication.photoComments = [];
    }
    await publication.save();
    await populatePublication(publication);
    res.status(200).json({ publication });
  } catch (error) {
    console.error("Erreur lors de la modification d'une publication :", error);
    res.status(500).json({ msg: "Impossible de modifier la publication." });
  }
};

exports.deleteProfessionalPublication = async (req, res) => {
  try {
    if (!validatePublicationIds(req, res)) return;
    const publication = await getPublicationForProfile(req, res);
    if (!publication) return;

    if (!req.user.isAdmin && !publication.author.equals(req.user._id)) {
      return res.status(403).json({
        msg: "Vous ne pouvez supprimer que vos propres publications.",
      });
    }

    await publication.deleteOne();
    await PublicationNotification.deleteMany({ publication: publication._id });
    res.status(200).json({ publicationId: publication._id });
  } catch (error) {
    console.error("Erreur lors de la suppression d'une publication :", error);
    res.status(500).json({ msg: "Impossible de supprimer la publication." });
  }
};

exports.toggleProfessionalPublicationLike = async (req, res) => {
  try {
    if (!validatePublicationIds(req, res)) return;
    const publication = await getPublicationForProfile(req, res);
    if (!publication) return;

    const hasLiked = publication.likes.some((userId) => userId.equals(req.user._id));
    const professional = await Professional.findById(publication.professional).select(
      "user"
    );
    if (!professional) {
      return res.status(404).json({ msg: "Profil professionnel introuvable." });
    }
    const ownerId = professional.user;
    await Publication.updateOne(
      { _id: publication._id },
      hasLiked
        ? { $pull: { likes: req.user._id } }
        : { $addToSet: { likes: req.user._id } }
    );

    if (ownerId.equals(req.user._id)) {
      await PublicationNotification.deleteOne({
        recipient: ownerId,
        actor: req.user._id,
        publication: publication._id,
        type: "like",
      });
    } else if (hasLiked) {
      await PublicationNotification.deleteOne({
        recipient: ownerId,
        actor: req.user._id,
        publication: publication._id,
        type: "like",
      });
    } else {
      await PublicationNotification.updateOne(
        {
          recipient: ownerId,
          actor: req.user._id,
          publication: publication._id,
          type: "like",
        },
        {
          $set: { read: false },
          $setOnInsert: {
            recipient: ownerId,
            actor: req.user._id,
            publication: publication._id,
            professional: publication.professional,
            type: "like",
          },
        },
        { upsert: true }
      );
    }

    const updatedPublication = await publicationQuery({
      _id: publication._id,
    });
    res.status(200).json({ publication: updatedPublication });
  } catch (error) {
    console.error("Erreur lors de la réaction à une publication :", error);
    res.status(500).json({ msg: "Impossible de réagir à la publication." });
  }
};

exports.getProfessionalPublicationLikes = async (req, res) => {
  try {
    if (!validatePublicationIds(req, res)) return;
    const publication = await Publication.findOne({
      _id: req.params.publicationId,
      professional: req.params.professionalId,
    }).populate("likes", "name lastName");
    if (!publication) {
      return res.status(404).json({ msg: "Publication introuvable." });
    }
    res.status(200).json({ likes: publication.likes });
  } catch (error) {
    console.error("Erreur lors du chargement des réactions :", error);
    res.status(500).json({ msg: "Impossible de charger les réactions." });
  }
};

exports.getPublicationNotifications = async (req, res) => {
  try {
    const notifications = await PublicationNotification.find({
      recipient: req.user._id,
    })
      .populate("actor", "name lastName")
      .populate("publication", "content")
      .populate("professional", "_id")
      .sort({ createdAt: -1 })
      .limit(30);
    const unreadCount = await PublicationNotification.countDocuments({
      recipient: req.user._id,
      read: false,
    });
    res.status(200).json({ notifications, unreadCount });
  } catch (error) {
    console.error("Erreur lors du chargement des notifications :", error);
    res.status(500).json({ msg: "Impossible de charger les notifications." });
  }
};

exports.markPublicationNotificationsRead = async (req, res) => {
  try {
    const filter = { recipient: req.user._id, read: false };
    if (req.params.notificationId) {
      if (!mongoose.isValidObjectId(req.params.notificationId)) {
        return res.status(400).json({ msg: "Notification invalide." });
      }
      filter._id = req.params.notificationId;
    }
    await PublicationNotification.updateMany(filter, { $set: { read: true } });
    res.status(200).json({ msg: "Notifications marquées comme lues." });
  } catch (error) {
    console.error("Erreur lors de la mise à jour des notifications :", error);
    res.status(500).json({ msg: "Impossible de mettre à jour les notifications." });
  }
};

exports.addProfessionalPublicationComment = async (req, res) => {
  try {
    if (!validatePublicationIds(req, res)) return;
    const publication = await getPublicationForProfile(req, res);
    if (!publication) return;

    const content = getContent(req.body.content);
    if (!content || content.length > 1000) {
      return res.status(400).json({
        msg: "Le commentaire est obligatoire et ne doit pas dépasser 1000 caractères.",
      });
    }

    publication.comments.push({ author: req.user._id, content });
    await publication.save();
    await populatePublication(publication);
    res.status(201).json({ publication });
  } catch (error) {
    console.error("Erreur lors de l'ajout d'un commentaire :", error);
    res.status(500).json({ msg: "Impossible d'ajouter le commentaire." });
  }
};

exports.addProfessionalPublicationPhotoComment = async (req, res) => {
  try {
    if (!validatePublicationIds(req, res)) return;
    const publication = await getPublicationForProfile(req, res);
    if (!publication) return;

    const imageIndex = Number(req.params.imageIndex);
    const images = getPublicationImages(publication);
    if (
      !Number.isInteger(imageIndex) ||
      imageIndex < 0 ||
      imageIndex >= images.length
    ) {
      return res.status(404).json({ msg: "Photo introuvable dans cette publication." });
    }

    const content = getContent(req.body.content);
    if (!content || content.length > 1000) {
      return res.status(400).json({
        msg: "Le commentaire est obligatoire et ne doit pas dépasser 1000 caractères.",
      });
    }

    const imageUrl = images[imageIndex];
    let photoComments = publication.photoComments.find(
      (photo) => photo.imageIndex === imageIndex
    );
    if (!photoComments) {
      publication.photoComments.push({ imageIndex, imageUrl, comments: [] });
      photoComments = publication.photoComments[publication.photoComments.length - 1];
    }
    photoComments.comments.push({ author: req.user._id, content });

    await publication.save();
    await populatePublication(publication);
    res.status(201).json({ publication });
  } catch (error) {
    console.error("Erreur lors de l'ajout d'un commentaire sur une photo :", error);
    res.status(500).json({ msg: "Impossible d'ajouter le commentaire à la photo." });
  }
};

const updatePublicationComment = async (req, res, isPhotoComment) => {
  try {
    if (!validatePublicationIds(req, res)) return;
    const publication = await getPublicationForProfile(req, res);
    if (!publication) return;

    const comment = getCommentTarget(req, res, publication, isPhotoComment);
    if (!comment) return;
    if (!comment.author.equals(req.user._id)) {
      return res.status(403).json({
        msg: "Seul l'auteur du commentaire peut le modifier.",
      });
    }

    const content = getContent(req.body.content);
    if (!content || content.length > 1000) {
      return res.status(400).json({
        msg: "Le commentaire est obligatoire et ne doit pas dépasser 1000 caractères.",
      });
    }

    comment.content = content;
    await publication.save();
    await populatePublication(publication);
    res.status(200).json({ publication });
  } catch (error) {
    console.error("Erreur lors de la modification d'un commentaire :", error);
    res.status(500).json({ msg: "Impossible de modifier le commentaire." });
  }
};

const deletePublicationComment = async (req, res, isPhotoComment) => {
  try {
    if (!validatePublicationIds(req, res)) return;
    const publication = await getPublicationForProfile(req, res);
    if (!publication) return;

    const comment = getCommentTarget(req, res, publication, isPhotoComment);
    if (!comment) return;

    const professional = await Professional.findById(
      publication.professional
    ).select("user");
    if (!professional) {
      return res.status(404).json({ msg: "Profil professionnel introuvable." });
    }
    const isCommentAuthor = comment.author.equals(req.user._id);
    const isProfileOwner = professional.user.equals(req.user._id);
    if (!req.user.isAdmin && !isProfileOwner && !isCommentAuthor) {
      return res.status(403).json({
        msg: "Vous n'êtes pas autorisé à supprimer ce commentaire.",
      });
    }

    if (isPhotoComment) {
      publication.photoComments
        .find((photo) => photo.imageIndex === Number(req.params.imageIndex))
        .comments.pull(req.params.commentId);
    } else {
      publication.comments.pull(req.params.commentId);
    }
    await publication.save();
    await populatePublication(publication);
    res.status(200).json({ publication });
  } catch (error) {
    console.error("Erreur lors de la suppression d'un commentaire :", error);
    res.status(500).json({ msg: "Impossible de supprimer le commentaire." });
  }
};

exports.updateProfessionalPublicationComment = (req, res) =>
  updatePublicationComment(req, res, false);

exports.deleteProfessionalPublicationComment = (req, res) =>
  deletePublicationComment(req, res, false);

exports.updateProfessionalPublicationPhotoComment = (req, res) =>
  updatePublicationComment(req, res, true);

exports.deleteProfessionalPublicationPhotoComment = (req, res) =>
  deletePublicationComment(req, res, true);
