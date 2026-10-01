const mongoose = require('mongoose');
const Client = require('../models/Client');
const Invoice = require('../models/Invoice');

const allowedStatuses = ['draft', 'sent', 'paid', 'overdue'];
const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

function calculateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'At least one invoice item is required' };
  }

  const normalized = [];
  for (const item of items) {
    if (
      !item || typeof item.description !== 'string' || !item.description.trim() ||
      !Number.isFinite(item.quantity) || item.quantity <= 0 ||
      !Number.isFinite(item.rate) || item.rate < 0
    ) {
      return { error: 'Each item needs a description, quantity greater than 0, and rate of 0 or more' };
    }
    normalized.push({
      description: item.description.trim(),
      quantity: item.quantity,
      rate: item.rate,
      amount: roundMoney(item.quantity * item.rate),
    });
  }

  const subtotal = roundMoney(normalized.reduce((sum, item) => sum + item.amount, 0));
  return { items: normalized, subtotal };
}

function validTaxRate(rate) {
  return Number.isFinite(rate) && rate >= 0;
}

function isValidId(id) {
  return mongoose.isValidObjectId(id);
}

async function findOwnedClient(clientId, userId) {
  if (!isValidId(clientId)) return null;
  return Client.findOne({ _id: clientId, user: userId }).select('_id');
}

function invoiceInputError(error) {
  return error.name === 'ValidationError' || error.name === 'CastError';
}

async function createInvoice(req, res) {
  const { client: clientId, items, taxRate = 0 } = req.body;
  if (!clientId) return res.status(400).json({ message: 'Client is required' });
  if (!validTaxRate(taxRate)) return res.status(400).json({ message: 'taxRate must be 0 or greater' });

  const calculated = calculateItems(items);
  if (calculated.error) return res.status(400).json({ message: calculated.error });

  try {
    const client = await findOwnedClient(clientId, req.user.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    const taxAmount = roundMoney(calculated.subtotal * (taxRate / 100));
    const invoice = await Invoice.create({
      ...req.body,
      invoiceNumber: req.body.invoiceNumber?.trim() || `INV-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      client: client._id,
      user: req.user.id,
      items: calculated.items,
      subtotal: calculated.subtotal,
      taxRate,
      taxAmount,
      total: roundMoney(calculated.subtotal + taxAmount),
    });
    await invoice.populate('client', 'name email');
    return res.status(201).json({ data: invoice });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'Invoice number already exists for this user' });
    return res.status(invoiceInputError(error) ? 400 : 500).json({
      message: invoiceInputError(error) ? error.message : 'Unable to create invoice',
    });
  }
}

async function getInvoices(req, res) {
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  const limit = req.query.limit === undefined ? 10 : Number(req.query.limit);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1) {
    return res.status(400).json({ message: 'page and limit must be positive integers' });
  }
  if (req.query.status && !allowedStatuses.includes(req.query.status)) {
    return res.status(400).json({ message: 'Invalid invoice status' });
  }
  if (req.query.client && !isValidId(req.query.client)) {
    return res.status(400).json({ message: 'Invalid client id' });
  }

  const filter = { user: req.user.id };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.client) filter.client = req.query.client;

  try {
    const [data, total] = await Promise.all([
      Invoice.find(filter)
        .populate('client', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Invoice.countDocuments(filter),
    ]);
    return res.status(200).json({ data, total, page, pages: Math.ceil(total / limit) });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to retrieve invoices' });
  }
}

async function getInvoiceById(req, res) {
  if (!isValidId(req.params.id)) return res.status(404).json({ message: 'Invoice not found' });
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user.id })
      .populate('client', 'name email');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    return res.status(200).json({ data: invoice });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to retrieve invoice' });
  }
}

async function updateInvoice(req, res) {
  if (!isValidId(req.params.id)) return res.status(404).json({ message: 'Invoice not found' });

  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user.id });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    const body = req.body;
    if (body.client !== undefined) {
      const client = await findOwnedClient(body.client, req.user.id);
      if (!client) return res.status(404).json({ message: 'Client not found' });
      invoice.client = client._id;
    }
    if (body.invoiceNumber !== undefined) invoice.invoiceNumber = body.invoiceNumber;
    if (body.status !== undefined) invoice.status = body.status;
    if (body.issueDate !== undefined) invoice.issueDate = body.issueDate;
    if (body.dueDate !== undefined) invoice.dueDate = body.dueDate;
    if (body.notes !== undefined) invoice.notes = body.notes;

    const nextTaxRate = body.taxRate === undefined ? invoice.taxRate : body.taxRate;
    if (!validTaxRate(nextTaxRate)) return res.status(400).json({ message: 'taxRate must be 0 or greater' });
    if (body.items !== undefined) {
      const calculated = calculateItems(body.items);
      if (calculated.error) return res.status(400).json({ message: calculated.error });
      invoice.items = calculated.items;
      invoice.subtotal = calculated.subtotal;
    }
    if (body.items !== undefined || body.taxRate !== undefined) {
      invoice.taxRate = nextTaxRate;
      invoice.taxAmount = roundMoney(invoice.subtotal * (nextTaxRate / 100));
      invoice.total = roundMoney(invoice.subtotal + invoice.taxAmount);
    }

    await invoice.save();
    await invoice.populate('client', 'name email');
    return res.status(200).json({ data: invoice });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'Invoice number already exists for this user' });
    return res.status(invoiceInputError(error) ? 400 : 500).json({
      message: invoiceInputError(error) ? error.message : 'Unable to update invoice',
    });
  }
}

async function deleteInvoice(req, res) {
  if (!isValidId(req.params.id)) return res.status(404).json({ message: 'Invoice not found' });
  try {
    const invoice = await Invoice.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    return res.status(200).json({ message: 'Invoice deleted successfully' });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to delete invoice' });
  }
}

async function updateInvoiceStatus(req, res) {
  const { status } = req.body;
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid invoice status' });
  }
  if (!isValidId(req.params.id)) return res.status(404).json({ message: 'Invoice not found' });

  try {
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $set: { status } },
      { new: true, runValidators: true }
    );
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    await invoice.populate('client', 'name email');
    return res.status(200).json({ data: invoice });
  } catch (error) {
    return res.status(invoiceInputError(error) ? 400 : 500).json({
      message: invoiceInputError(error) ? error.message : 'Unable to update invoice status',
    });
  }
}

function paginationFromQuery(query) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 10 : Number(query.limit);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1) {
    return { error: 'page and limit must be positive integers' };
  }
  return { page, limit };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function searchInvoices(req, res) {
  const paging = paginationFromQuery(req.query);
  if (paging.error) return res.status(400).json({ message: paging.error });
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!query) return res.status(400).json({ message: 'Search query q is required' });
  if (req.query.status && !allowedStatuses.includes(req.query.status)) {
    return res.status(400).json({ message: 'Invalid invoice status' });
  }

  try {
    const regex = new RegExp(escapeRegex(query), 'i');
    const matchingClients = await Client.find({ user: req.user.id, name: regex }).select('_id');
    const filter = {
      user: req.user.id,
      $or: [
        { invoiceNumber: regex },
        { client: { $in: matchingClients.map((client) => client._id) } },
      ],
    };
    if (req.query.status) filter.status = req.query.status;
    const [data, total] = await Promise.all([
      Invoice.find(filter)
        .populate('client', 'name email')
        .sort({ createdAt: -1 })
        .skip((paging.page - 1) * paging.limit)
        .limit(paging.limit),
      Invoice.countDocuments(filter),
    ]);
    return res.status(200).json({ data, total, page: paging.page, pages: Math.ceil(total / paging.limit) });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to search invoices' });
  }
}

async function getInvoiceStats(req, res) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  try {
    const [stats] = await Invoice.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(req.user.id) } },
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalRevenue: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$total', 0] } },
          totalOutstanding: {
            $sum: { $cond: [{ $in: ['$status', ['sent', 'overdue']] }, '$total', 0] },
          },
          paidCount: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
          unpaidCount: { $sum: { $cond: [{ $in: ['$status', ['sent', 'overdue']] }, 1, 0] } },
          overdueCount: { $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] } },
          thisMonthRevenue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'paid'] },
                    { $gte: ['$issueDate', monthStart] },
                    { $lt: ['$issueDate', nextMonthStart] },
                  ],
                },
                '$total',
                0,
              ],
            },
          },
        },
      },
      { $project: { _id: 0 } },
    ]);

    return res.status(200).json(stats || {
      totalInvoices: 0,
      totalRevenue: 0,
      totalOutstanding: 0,
      paidCount: 0,
      unpaidCount: 0,
      overdueCount: 0,
      thisMonthRevenue: 0,
    });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to retrieve invoice statistics' });
  }
}

async function getClientInvoices(req, res) {
  const paging = paginationFromQuery(req.query);
  if (paging.error) return res.status(400).json({ message: paging.error });
  if (!isValidId(req.params.id)) return res.status(404).json({ message: 'Client not found' });

  try {
    const client = await Client.findOne({ _id: req.params.id, user: req.user.id }).select('_id');
    if (!client) return res.status(404).json({ message: 'Client not found' });
    const filter = { client: client._id, user: req.user.id };
    const [data, total] = await Promise.all([
      Invoice.find(filter)
        .populate('client', 'name email')
        .sort({ createdAt: -1 })
        .skip((paging.page - 1) * paging.limit)
        .limit(paging.limit),
      Invoice.countDocuments(filter),
    ]);
    return res.status(200).json({ data, total, page: paging.page, pages: Math.ceil(total / paging.limit) });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to retrieve client invoices' });
  }
}

module.exports = {
  createInvoice,
  getInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  updateInvoiceStatus,
  searchInvoices,
  getInvoiceStats,
  getClientInvoices,
};
