const express = require('express');
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/authMiddleware');
const { register, login, getMe, updateMe } = require('../controllers/authController');

const router = express.Router();

function returnValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return next();
}

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').trim().isEmail().withMessage('A valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  returnValidationErrors,
  register
);

router.post(
  '/login',
  [
    body('email').trim().isEmail().withMessage('A valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  returnValidationErrors,
  login
);

router.get('/me', authMiddleware, getMe);
router.patch(
  '/me',
  authMiddleware,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('email').optional().trim().isEmail().withMessage('A valid email is required'),
    body('businessName').optional().isString().trim(),
  ],
  returnValidationErrors,
  updateMe
);

module.exports = router;
