const mongoose = require("mongoose");
const User = require("../models/User");
const Conversation = require("../models/Conversation");
const DirectMessage = require("../models/DirectMessage");
const MessageReaction = require("../models/MessageReaction");

const MAX_TEXT_LENGTH = 1000;
const EDIT_LIMIT_MS = 15 * 60 * 1000;

const findConversationForUser = (conversationId, userId) => {
  if (!mongoose.isValidObjectId(conversationId)) return null;
  return Conversation.findOne({
    _id: conversationId,
    participants: userId,
  }).populate("participants", "name lastName phone photo");
};

exports.getUsersForMessaging = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select("name lastName phone")
      .sort({ name: 1, lastName: 1 })
      .limit(200);
    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ msg: "Impossible de charger les utilisateurs." });
  }
};

exports.getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .populate("participants", "name lastName phone")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "name lastName" },
      })
      .sort({ lastActivityAt: -1, updatedAt: -1 })
      .limit(100);

    res.status(200).json({ conversations });
  } catch (error) {
    res.status(500).json({ msg: "Impossible de charger les conversations." });
  }
};

exports.getOrCreateConversation = async (req, res) => {
  try {
    const { participantId } = req.params;
    if (
      !mongoose.isValidObjectId(participantId) ||
      String(participantId) === String(req.user._id)
    ) {
      return res.status(400).json({ msg: "Utilisateur de message invalide." });
    }

    const participant = await User.findById(participantId).select("_id");
    if (!participant) {
      return res.status(404).json({ msg: "Utilisateur introuvable." });
    }

    const participantIds = [req.user._id, participant._id].sort((a, b) =>
      String(a).localeCompare(String(b))
    );
    const participantKey = participantIds.map(String).join("|");
    let conversation = await Conversation.findOne({
      participantKey,
    }).populate("participants", "name lastName phone");

    if (!conversation) {
      try {
        conversation = await Conversation.create({
          participants: participantIds,
          participantKey,
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
        conversation = await Conversation.findOne({ participantKey });
        if (!conversation) throw error;
      }
      conversation = await Conversation.findById(conversation._id).populate(
        "participants",
        "name lastName phone"
      );
    }

    res.status(200).json({ conversation });
  } catch (error) {
    console.error("Erreur lors de l’ouverture de la conversation :", error);
    res.status(500).json({ msg: "Impossible d’ouvrir la conversation." });
  }
};

exports.getConversationMessages = async (req, res) => {
  try {
    const conversation = await findConversationForUser(
      req.params.conversationId,
      req.user._id
    );
    if (!conversation) {
      return res.status(404).json({ msg: "Conversation introuvable." });
    }

    const newestMessages = await DirectMessage.find({
      conversation: conversation._id,
    })
      .populate("sender", "name lastName")
      .sort({ createdAt: -1, _id: -1 })
      .limit(500);
    const messages = newestMessages.reverse();

    const messageIds = messages.map((message) => message._id);
    const reactions = await MessageReaction.find({ message: { $in: messageIds } })
      .select("message user")
      .populate("user", "name lastName");

    const reactionsByMessage = new Map();
    reactions.forEach((reaction) => {
      const key = String(reaction.message);
      const entries = reactionsByMessage.get(key) || [];
      if (reaction.user) entries.push(reaction.user);
      reactionsByMessage.set(key, entries);
    });

    const payload = messages.map((message) => {
      const plain = message.toObject();
      plain.likes = reactionsByMessage.get(String(message._id)) || [];
      plain.likeCount = plain.likes.length;
      plain.isLiked = plain.likes.some(
        (like) => String(like._id) === String(req.user._id)
      );
      return plain;
    });

    res.status(200).json({ conversation, messages: payload });
  } catch (error) {
    res.status(500).json({ msg: "Impossible de charger les messages." });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const conversation = await findConversationForUser(
      req.params.conversationId,
      req.user._id
    );
    if (!conversation) {
      return res.status(404).json({ msg: "Conversation introuvable." });
    }

    const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
    if (!text) {
      return res.status(400).json({ msg: "Le message ne peut pas être vide." });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({
        msg: `Le message ne peut pas dépasser ${MAX_TEXT_LENGTH} caractères.`,
      });
    }

    const message = await DirectMessage.create({
      conversation: conversation._id,
      sender: req.user._id,
      text,
      readBy: [req.user._id],
    });
    await Conversation.findByIdAndUpdate(conversation._id, {
      lastMessage: message._id,
      lastActivityAt: new Date(),
    });

    const populated = await DirectMessage.findById(message._id).populate(
      "sender",
      "name lastName"
    );
    res.status(201).json({
      message: {
        ...populated.toObject(),
        likes: [],
        likeCount: 0,
        isLiked: false,
      },
    });
  } catch (error) {
    res.status(500).json({ msg: "Impossible d’envoyer le message." });
  }
};

exports.updateMessage = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.messageId)) {
      return res.status(400).json({ msg: "Identifiant de message invalide." });
    }
    const message = await DirectMessage.findById(req.params.messageId);
    if (!message) {
      return res.status(404).json({ msg: "Message introuvable." });
    }
    if (String(message.sender) !== String(req.user._id)) {
      return res.status(403).json({ msg: "Vous ne pouvez modifier que vos messages." });
    }
    if (Date.now() - new Date(message.createdAt).getTime() > EDIT_LIMIT_MS) {
      return res.status(403).json({
        msg: "La modification n’est plus possible après 15 minutes.",
      });
    }

    const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
    if (!text) {
      return res.status(400).json({ msg: "Le message ne peut pas être vide." });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({
        msg: `Le message ne peut pas dépasser ${MAX_TEXT_LENGTH} caractères.`,
      });
    }

    message.text = text;
    message.editedAt = new Date();
    await message.save();
    const populated = await DirectMessage.findById(message._id).populate(
      "sender",
      "name lastName"
    );
    res.status(200).json({ message: populated });
  } catch (error) {
    res.status(500).json({ msg: "Impossible de modifier le message." });
  }
};

exports.toggleMessageLike = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.messageId)) {
      return res.status(400).json({ msg: "Identifiant de message invalide." });
    }
    const message = await DirectMessage.findById(req.params.messageId);
    if (!message) {
      return res.status(404).json({ msg: "Message introuvable." });
    }
    const conversation = await findConversationForUser(
      message.conversation,
      req.user._id
    );
    if (!conversation) {
      return res.status(403).json({ msg: "Vous ne participez pas à cette conversation." });
    }

    const existing = await MessageReaction.findOne({
      message: message._id,
      user: req.user._id,
    });
    if (existing) {
      await existing.deleteOne();
    } else {
      await MessageReaction.create({
        message: message._id,
        user: req.user._id,
      });
    }
    const likeCount = await MessageReaction.countDocuments({ message: message._id });
    res.status(200).json({
      likeCount,
      isLiked: !existing,
    });
  } catch (error) {
    res.status(500).json({ msg: "Impossible de mettre à jour la réaction." });
  }
};

exports.markConversationRead = async (req, res) => {
  try {
    const conversation = await findConversationForUser(
      req.params.conversationId,
      req.user._id
    );
    if (!conversation) {
      return res.status(404).json({ msg: "Conversation introuvable." });
    }
    await DirectMessage.updateMany(
      { conversation: conversation._id },
      { $addToSet: { readBy: req.user._id } }
    );
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ msg: "Impossible de marquer les messages comme lus." });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const conversationIds = await Conversation.find({
      participants: req.user._id,
    }).distinct("_id");
    const unreadCount = await DirectMessage.countDocuments({
      sender: { $ne: req.user._id },
      readBy: { $ne: req.user._id },
      conversation: { $in: conversationIds },
    });
    res.status(200).json({ unreadCount });
  } catch (error) {
    res.status(500).json({ msg: "Impossible de charger les messages non lus." });
  }
};
