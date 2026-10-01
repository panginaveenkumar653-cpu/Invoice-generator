const Client = require('../models/Client');

function clientFields(body) {
  const fields = {};
  for (const key of ['name', 'email', 'phone', 'address']) {
    if (Object.prototype.hasOwnProperty.call(body, key)) fields[key] = body[key];
  }
  return fields;
}

function isBadInput(error) {
  return error.name === 'ValidationError' || error.name === 'CastError';
}

async function createClient(req, res) {
  try {
    const client = await Client.create({ ...clientFields(req.body), user: req.user.id });
    return res.status(201).json({ data: client });
  } catch (error) {
    return res.status(isBadInput(error) ? 400 : 500).json({
      message: isBadInput(error) ? error.message : 'Unable to create client',
    });
  }
}

async function getClients(req, res) {
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  const limit = req.query.limit === undefined ? 10 : Number(req.query.limit);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1) {
    return res.status(400).json({ message: 'page and limit must be positive integers' });
  }

  try {
    const filter = { user: req.user.id };
    const [data, total] = await Promise.all([
      Client.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Client.countDocuments(filter),
    ]);
    return res.status(200).json({ data, total, page, pages: Math.ceil(total / limit) });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to retrieve clients' });
  }
}

async function getClientById(req, res) {
  try {
    const client = await Client.findOne({ _id: req.params.id, user: req.user.id });
    if (!client) return res.status(404).json({ message: 'Client not found' });
    return res.status(200).json({ data: client });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Client not found' });
    return res.status(500).json({ message: 'Unable to retrieve client' });
  }
}

async function updateClient(req, res) {
  try {
    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $set: clientFields(req.body) },
      { new: true, runValidators: true }
    );
    if (!client) return res.status(404).json({ message: 'Client not found' });
    return res.status(200).json({ data: client });
  } catch (error) {
    return res.status(isBadInput(error) ? 400 : 500).json({
      message: isBadInput(error) ? error.message : 'Unable to update client',
    });
  }
}

async function deleteClient(req, res) {
  try {
    const client = await Client.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!client) return res.status(404).json({ message: 'Client not found' });
    return res.status(200).json({ message: 'Client deleted successfully' });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Client not found' });
    return res.status(500).json({ message: 'Unable to delete client' });
  }
}

module.exports = { createClient, getClients, getClientById, updateClient, deleteClient };
