const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { downloadInvoicePdf } = require('../controllers/invoicePdfController');
const {
  createInvoice,
  getInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  updateInvoiceStatus,
  searchInvoices,
  getInvoiceStats,
} = require('../controllers/invoiceController');

const router = express.Router();

router.use(authMiddleware);
router.post('/', createInvoice);
router.get('/', getInvoices);
router.get('/search', searchInvoices);
router.get('/stats', getInvoiceStats);
router.patch('/:id/status', updateInvoiceStatus);
router.get('/:id/pdf', downloadInvoicePdf);
router.get('/:id', getInvoiceById);
router.put('/:id', updateInvoice);
router.delete('/:id', deleteInvoice);

module.exports = router;
