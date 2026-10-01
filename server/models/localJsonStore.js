const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

const dataFile = path.join(__dirname, '..', '.local-data.json');
const collections = ['User', 'Client', 'Invoice'];

function readStore() {
  if (!fs.existsSync(dataFile)) return Object.fromEntries(collections.map((name) => [name, []]));
  try {
    const contents = fs.readFileSync(dataFile, 'utf8').replace(/^\uFEFF/, '');
    const data = JSON.parse(contents);
    return Object.fromEntries(collections.map((name) => [name, Array.isArray(data[name]) ? data[name] : []]));
  } catch (error) {
    throw new Error(`Local data file is not valid JSON (${error.message})`);
  }
}

function writeStore(data) {
  const temporaryFile = `${dataFile}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(temporaryFile, dataFile);
}

function valueString(value) {
  return value && typeof value.toString === 'function' ? value.toString() : value;
}

function valueMatches(value, expected) {
  if (expected instanceof RegExp) return expected.test(String(value ?? ''));
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    if ('$in' in expected) return expected.$in.some((item) => valueString(item) === valueString(value));
    return false;
  }
  return valueString(value) === valueString(expected);
}

function matches(record, filter = {}) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '$or') return expected.some((part) => matches(record, part));
    return valueMatches(record[key], expected);
  });
}

function attachMethods(name, record) {
  if (!record) return record;
  const document = { ...record };
  Object.defineProperty(document, 'save', {
    enumerable: false,
    value: async function save() {
      validate(name, this);
      const store = readStore();
      const index = store[name].findIndex((item) => item._id === this._id);
      if (index < 0) throw new Error(`${name} no longer exists`);
      if (name === 'User' && store.User.some((item) => item._id !== this._id && item.email === this.email.toLowerCase())) {
        const error = new Error('Duplicate email');
        error.code = 11000;
        throw error;
      }
      this.updatedAt = new Date().toISOString();
      store[name][index] = toRecord(this);
      writeStore(store);
      return this;
    },
  });
  Object.defineProperty(document, 'populate', {
    enumerable: false,
    value: async function populate(field, selection) {
      if (name === 'Invoice' && field === 'client') {
        const client = readStore().Client.find((item) => item._id === String(this.client));
        if (client) {
          const allowed = selection ? selection.split(/\s+/).filter(Boolean) : [];
          this.client = allowed.length
            ? Object.fromEntries(['_id', ...allowed].filter((key) => client[key] !== undefined).map((key) => [key, client[key]]))
            : { ...client };
        }
      }
      return this;
    },
  });
  if (name === 'User') {
    Object.defineProperty(document, 'comparePassword', {
      enumerable: false,
      value: (candidate) => bcrypt.compare(candidate, document.password),
    });
  }
  return document;
}

function toRecord(document) {
  return JSON.parse(JSON.stringify(document));
}

function validationError(message) {
  const error = new Error(message);
  error.name = 'ValidationError';
  return error;
}

function validate(name, record) {
  if (name === 'User') {
    if (!record.name?.trim()) throw validationError('Name is required');
    if (!/^\S+@\S+\.\S+$/.test(record.email || '')) throw validationError('A valid email is required');
    if (typeof record.password !== 'string' || record.password.length < 6) throw validationError('Password must be at least 6 characters');
  } else if (name === 'Client') {
    if (!record.name?.trim()) throw validationError('Name is required');
    if (!record.email?.trim()) throw validationError('Email is required');
    if (!record.user) throw validationError('User is required');
  } else if (name === 'Invoice') {
    if (!record.invoiceNumber?.trim()) throw validationError('Invoice number is required');
    if (!record.client || !record.user) throw validationError('Client and user are required');
    if (!Array.isArray(record.items)) throw validationError('Invoice items are required');
    if (!Number.isFinite(record.subtotal) || !Number.isFinite(record.total)) throw validationError('Invoice totals must be valid numbers');
    if (!record.dueDate || Number.isNaN(new Date(record.dueDate).getTime())) throw validationError('Due date is required');
    if (!['draft', 'sent', 'paid', 'overdue'].includes(record.status || 'draft')) throw validationError('Invalid invoice status');
  }
}

class Query {
  constructor(model, filter, single = false) {
    this.model = model;
    this.filter = filter;
    this.single = single;
    this.projection = null;
    this.populateField = null;
    this.populateSelection = null;
    this.order = null;
    this.offset = 0;
    this.limitCount = Infinity;
  }

  select(projection) { this.projection = projection; return this; }
  populate(field, selection) { this.populateField = field; this.populateSelection = selection; return this; }
  sort(order) { this.order = order; return this; }
  skip(count) { this.offset = count; return this; }
  limit(count) { this.limitCount = count; return this; }

  async exec() {
    const store = readStore();
    let records = store[this.model.name].filter((record) => matches(record, this.filter));
    if (this.order) {
      const [[key, direction]] = Object.entries(this.order);
      records = records.sort((a, b) => (a[key] < b[key] ? -direction : a[key] > b[key] ? direction : 0));
    }
    if (!this.single) records = records.slice(this.offset, this.offset + this.limitCount);
    if (this.single) records = records.slice(0, 1);
    const project = (record) => {
      if (!this.projection) return record;
      const fields = this.projection.trim().split(/\s+/).filter(Boolean);
      if (fields[0]?.startsWith('-')) {
        const output = { ...record };
        for (const field of fields) if (field.startsWith('-')) delete output[field.slice(1)];
        return output;
      }
      return Object.fromEntries(['_id', ...fields].filter((key) => record[key] !== undefined).map((key) => [key, record[key]]));
    };
    const result = records.map((record) => attachMethods(this.model.name, project(record)));
    if (this.populateField) {
      for (const record of result) await record.populate(this.populateField, this.populateSelection);
    }
    return this.single ? result[0] || null : result;
  }

  then(resolve, reject) { return this.exec().then(resolve, reject); }
  catch(reject) { return this.exec().catch(reject); }
}

function createModel(name) {
  const model = {
    name,
    create: async (input) => {
      const record = { ...input };
      record._id = crypto.randomBytes(12).toString('hex');
      record.createdAt = new Date().toISOString();
      record.updatedAt = record.createdAt;
      if (name === 'User') {
        record.email = record.email.trim().toLowerCase();
        const duplicate = readStore().User.some((user) => user.email === record.email);
        if (duplicate) {
          const error = new Error('Duplicate email');
          error.code = 11000;
          throw error;
        }
        validate(name, record);
        record.password = await bcrypt.hash(record.password, 10);
      } else {
        validate(name, record);
      }
      const store = readStore();
      if (name === 'Invoice' && store.Invoice.some((invoice) => invoice.user === String(record.user) && invoice.invoiceNumber === record.invoiceNumber)) {
        const error = new Error('Duplicate invoice number');
        error.code = 11000;
        throw error;
      }
      store[name].push(toRecord(record));
      writeStore(store);
      return attachMethods(name, record);
    },
    find: (filter = {}) => new Query(model, filter),
    findOne: (filter = {}) => new Query(model, filter, true),
    findById: (id) => new Query(model, { _id: id }, true),
    countDocuments: async (filter = {}) => readStore()[name].filter((record) => matches(record, filter)).length,
    findOneAndDelete: async (filter = {}) => {
      const store = readStore();
      const index = store[name].findIndex((record) => matches(record, filter));
      if (index < 0) return null;
      const [record] = store[name].splice(index, 1);
      writeStore(store);
      return attachMethods(name, record);
    },
    findOneAndUpdate: async (filter, update) => {
      const store = readStore();
      const record = store[name].find((item) => matches(item, filter));
      if (!record) return null;
      Object.assign(record, update.$set || update);
      record.updatedAt = new Date().toISOString();
      validate(name, record);
      writeStore(store);
      return attachMethods(name, record);
    },
  };

  if (name === 'Invoice') {
    model.aggregate = async (pipeline) => {
      const userId = String(pipeline[0]?.$match?.user ?? '');
      const invoices = readStore().Invoice.filter((invoice) => invoice.user === userId);
      if (!invoices.length) return [];
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const stats = invoices.reduce((summary, invoice) => {
        const paid = invoice.status === 'paid';
        const outstanding = invoice.status === 'sent' || invoice.status === 'overdue';
        const issueDate = new Date(invoice.issueDate);
        summary.totalInvoices += 1;
        if (paid) {
          summary.totalRevenue += invoice.total;
          if (issueDate >= monthStart && issueDate < nextMonthStart) summary.thisMonthRevenue += invoice.total;
          summary.paidCount += 1;
        }
        if (outstanding) {
          summary.totalOutstanding += invoice.total;
          summary.unpaidCount += 1;
        }
        if (invoice.status === 'overdue') summary.overdueCount += 1;
        return summary;
      }, { totalInvoices: 0, totalRevenue: 0, totalOutstanding: 0, paidCount: 0, unpaidCount: 0, overdueCount: 0, thisMonthRevenue: 0 });
      return [stats];
    };
  }

  return model;
}

module.exports = { createModel };
