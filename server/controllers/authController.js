const jwt = require('jsonwebtoken');
const User = require('../models/User');

function createToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const error = new Error('Authentication is not configured');
    error.status = 500;
    throw error;
  }
  return jwt.sign({ id: user._id.toString() }, secret, { expiresIn: '7d' });
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    businessName: user.businessName || '',
  };
}

async function register(req, res) {
  const { name, email, password, businessName } = req.body;

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      businessName: businessName?.trim(),
    });
    const token = createToken(user);
    return res.status(201).json({ user: publicUser(user), token });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }
    return res.status(error.status || 500).json({ message: error.status ? error.message : 'Unable to register user' });
  }
}

async function login(req, res) {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = createToken(user);
    return res.status(200).json({ user: publicUser(user), token });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.status ? error.message : 'Unable to log in' });
  }
}

async function getMe(req, res) {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.status(200).json({ user: publicUser(user) });
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to retrieve user' });
  }
}

async function updateMe(req, res) {
  const { name, email, businessName } = req.body;
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name !== undefined) user.name = name.trim();
    if (email !== undefined) user.email = email.trim().toLowerCase();
    if (businessName !== undefined) user.businessName = businessName.trim();
    await user.save();
    return res.status(200).json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'An account with this email already exists' });
    if (error.name === 'ValidationError') return res.status(400).json({ message: error.message });
    return res.status(500).json({ message: 'Unable to update your profile' });
  }
}

module.exports = { register, login, getMe, updateMe };
