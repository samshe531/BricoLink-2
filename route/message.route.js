const express = require("express");
const { rateLimit } = require("express-rate-limit");
const isAuth = require("../middlewares/isAuth");
const {
  getUsersForMessaging,
  getConversations,
  getOrCreateConversation,
  getConversationMessages,
  sendMessage,
  updateMessage,
  toggleMessageLike,
  getUnreadCount,
  markConversationRead,
} = require("../controllers/message.controller");

const router = express.Router();

router.use(isAuth);

const messageSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: "Trop de messages envoyés. Réessayez dans quelques minutes." },
});

router.get("/users", getUsersForMessaging);
router.get("/conversations", getConversations);
router.get("/unread-count", getUnreadCount);
router.post("/conversations/with/:participantId", getOrCreateConversation);
router.get("/conversations/:conversationId/messages", getConversationMessages);
router.post("/conversations/:conversationId/messages", messageSendLimiter, sendMessage);
router.put("/messages/:messageId", updateMessage);
router.post("/messages/:messageId/like", toggleMessageLike);
router.patch("/conversations/:conversationId/read", markConversationRead);

module.exports = router;
