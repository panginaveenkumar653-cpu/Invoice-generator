const express = require('express');
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/authMiddleware');
const {
  createClient,
  getClients,
  getClientById,
  updateClient,
  deleteClient,
} = require('../controllers/clientController');
const { getClientInvoices } = require('../controllers/invoiceController');

const router = express.Router();

router.use(authMiddleware);

function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Invalid client data', errors: errors.array() });
  }
  return next();
}

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').trim().isEmail().withMessage('A valid email is required'),
  ],
  validateRequest,
  createClient
);

router.get('/', getClients);
router.get('/:id/invoices', getClientInvoices);
router.get('/:id', getClientById);
router.put(
  '/:id',
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('email').optional().trim().isEmail().withMessage('A valid email is required'),
  ],
  validateRequest,
  updateClient
);
router.delete('/:id', deleteClient);

module.exports = router;
