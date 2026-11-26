const express = require ('express');

const { getAllPro, getOnePro, updateProfilePro, getProEnAttente, filterProfessionals, getProValideOuEnAttente, getProByuserId, searchProfessionals } = require('../controllers/pro.controller');
const {
  getProfessionalPublications,
  createProfessionalPublication,
  updateProfessionalPublication,
  deleteProfessionalPublication,
  toggleProfessionalPublicationLike,
  getProfessionalPublicationLikes,
  getPublicationNotifications,
  markPublicationNotificationsRead,
  addProfessionalPublicationComment,
  addProfessionalPublicationPhotoComment,
  updateProfessionalPublicationComment,
  deleteProfessionalPublicationComment,
  updateProfessionalPublicationPhotoComment,
  deleteProfessionalPublicationPhotoComment,
} = require('../controllers/publication.controller');
const isAuth = require('../middlewares/isAuth');
const isAdmin = require('../middlewares/isAdmin');
const upload = require('../utils/multer');
const router = express.Router();

const uploadPublicationImages = (req, res, next) => {
  upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'image', maxCount: 1 },
  ])(req, res, (error) => {
    if (error) {
      const message =
        error.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Une publication ne peut pas contenir plus de 5 photos.'
          : error.message;
      return res.status(400).json({ msg: message });
    }
    req.files = [...(req.files?.images || []), ...(req.files?.image || [])];
    if (req.files.length > 5) {
      return res.status(400).json({ msg: 'Une publication ne peut pas contenir plus de 5 photos.' });
    }
    next();
  });
};


// router.get('/testP', (req, res) => {
//   res.status(200).json("Route /api/pro/test fonctionne !");
// });

// route pour filtrer les pros selon spécialités
router.get("/filterPro", filterProfessionals);

// route pour voir les professionnels validés
router.get('/listePro', getProValideOuEnAttente);

router.get('/search', searchProfessionals);

router.get('/notifications', isAuth, getPublicationNotifications);
router.patch('/notifications/read', isAuth, markPublicationNotificationsRead);
router.patch('/notifications/:notificationId/read', isAuth, markPublicationNotificationsRead);

// Les publications sont rattachées au profil professionnel consulté.
router.get('/:professionalId/publications', getProfessionalPublications);
router.post('/:professionalId/publications', isAuth, uploadPublicationImages, createProfessionalPublication);
router.put('/:professionalId/publications/:publicationId', isAuth, uploadPublicationImages, updateProfessionalPublication);
router.delete('/:professionalId/publications/:publicationId', isAuth, deleteProfessionalPublication);
router.post('/:professionalId/publications/:publicationId/likes', isAuth, toggleProfessionalPublicationLike);
router.get('/:professionalId/publications/:publicationId/likes', getProfessionalPublicationLikes);
router.post('/:professionalId/publications/:publicationId/comments', isAuth, addProfessionalPublicationComment);
router.put('/:professionalId/publications/:publicationId/comments/:commentId', isAuth, updateProfessionalPublicationComment);
router.delete('/:professionalId/publications/:publicationId/comments/:commentId', isAuth, deleteProfessionalPublicationComment);
router.post('/:professionalId/publications/:publicationId/images/:imageIndex/comments', isAuth, addProfessionalPublicationPhotoComment);
router.put('/:professionalId/publications/:publicationId/images/:imageIndex/comments/:commentId', isAuth, updateProfessionalPublicationPhotoComment);
router.delete('/:professionalId/publications/:publicationId/images/:imageIndex/comments/:commentId', isAuth, deleteProfessionalPublicationPhotoComment);

// route pour voir tout les professionels (visiteurs)
router.get('/allProfessionals', getAllPro) ;

//route pour filtrer les demandes de devenir Pro("en attente")
router.get('/toBePro', isAdmin, getProEnAttente );

// currentPro = le pro connecté
router.get("/by-user/:userId", getProByuserId);

//route pour afficher un seul professionnel (visiteurs)
router.get('/:id', getOnePro);



//route pour mettre à jour un profile
router.put('/:id',isAuth , updateProfilePro );




module.exports = router;