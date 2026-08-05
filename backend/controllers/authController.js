// backend/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');

exports.login = async (req, res) => {
  const { user_name, password } = req.body;
  if (!user_name || !password)
    return res.status(400).json({ success: false, message: 'Username and password required' });

  // USER_NAME is stored upper-cased (see adminController.createClient) — match that here too.
  const userName = user_name.trim().toUpperCase();
  const result = await db.execute(
    `SELECT USER_ID, NAME, EMAIL, PASSWORD_HASH, ROLE, IS_ACTIVE FROM USERS WHERE USER_NAME = :userName`,
    { userName }
  );
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.PASSWORD_HASH)))
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  if (!user.IS_ACTIVE)
    return res.status(403).json({ success: false, message: 'Account is disabled' });

  const token = jwt.sign(
    { userId: user.USER_ID, email: user.EMAIL, role: user.ROLE, name: user.NAME },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
  res.json({
    success: true, token,
    user: { id: user.USER_ID, name: user.NAME, email: user.EMAIL, role: user.ROLE },
  });
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ success: false, message: 'Both fields are required' });
  if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/.test(newPassword))
    return res.status(400).json({ success: false, message: 'Password: min 8 chars, 1 uppercase, 1 number, 1 special char' });

  const result = await db.execute(`SELECT PASSWORD_HASH FROM USERS WHERE USER_ID = :id`, { id: req.user.userId });
  if (!(await bcrypt.compare(currentPassword, result.rows[0].PASSWORD_HASH)))
    return res.status(400).json({ success: false, message: 'Current password is incorrect' });

  const hash = await bcrypt.hash(newPassword, 12);
  await db.execute(
    `UPDATE USERS SET PASSWORD_HASH = :hash, UPDATED_AT = SYSTIMESTAMP WHERE USER_ID = :id`,
    { hash, id: req.user.userId }
  );
  res.json({ success: true, message: 'Password updated successfully' });
};
