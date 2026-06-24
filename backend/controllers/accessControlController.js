const oracledb = require('oracledb');
const db = require('../config/db');

const CLOB_OPTS = { fetchInfo: { ACCESS_LIST: { type: oracledb.STRING } } };

async function readAccessList(userId) {
  const result = await db.execute(
    `SELECT ACCESS_LIST FROM REPORT_ACCESS_CONTROL WHERE USER_ID = :userId`,
    { userId: String(userId) },
    CLOB_OPTS
  );
  if (!result.rows.length) return null;
  const raw = result.rows[0].ACCESS_LIST;
  if (!raw) return {};
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

async function writeAccessList(userId, list) {
  await db.execute(
    `UPDATE REPORT_ACCESS_CONTROL SET ACCESS_LIST = :accessList WHERE USER_ID = :userId`,
    { userId: String(userId), accessList: JSON.stringify(list) }
  );
}

exports.getAllUsers = async (req, res) => {
  const result = await db.execute(
    `SELECT u.USER_ID, u.NAME, u.EMAIL, u.IS_ACTIVE,
            CASE WHEN r.USER_ID IS NOT NULL THEN 1 ELSE 0 END AS HAS_ACCESS
     FROM USERS u
     LEFT JOIN REPORT_ACCESS_CONTROL r ON TO_CHAR(u.USER_ID) = r.USER_ID
     WHERE u.ROLE = 'CLIENT'
     ORDER BY u.NAME`
  );
  res.json({ success: true, data: result.rows });
};

exports.getUserAccess = async (req, res) => {
  const list = await readAccessList(req.params.userId);
  res.json({ success: true, data: list });
};

exports.addAccessType = async (req, res) => {
  const { userId } = req.params;
  const { type } = req.body;
  if (!type?.trim())
    return res.status(400).json({ success: false, message: 'type is required' });

  const key = type.trim().toUpperCase();
  const list = await readAccessList(userId);

  if (!list) {
    await db.execute(
      `INSERT INTO REPORT_ACCESS_CONTROL (USER_ID, ACCESS_LIST) VALUES (:userId, :accessList)`,
      { userId: String(userId), accessList: JSON.stringify({ [key]: [] }) }
    );
  } else {
    if (key in list)
      return res.status(409).json({ success: false, message: 'Access type already exists' });
    list[key] = [];
    await writeAccessList(userId, list);
  }
  res.json({ success: true, message: 'Access type added' });
};

exports.deleteAccessType = async (req, res) => {
  const { userId, type } = req.params;
  const list = await readAccessList(userId);
  if (!list)
    return res.status(404).json({ success: false, message: 'No access control found' });

  delete list[type];

  if (Object.keys(list).length === 0) {
    await db.execute(
      `DELETE FROM REPORT_ACCESS_CONTROL WHERE USER_ID = :userId`,
      { userId: String(userId) }
    );
  } else {
    await writeAccessList(userId, list);
  }
  res.json({ success: true, message: 'Access type removed' });
};

exports.addAccessValue = async (req, res) => {
  const { userId } = req.params;
  const { type, value } = req.body;
  if (!type || !value?.trim())
    return res.status(400).json({ success: false, message: 'type and value are required' });

  const list = await readAccessList(userId);
  if (!list)
    return res.status(404).json({ success: false, message: 'No access control found' });
  if (!(type in list))
    return res.status(404).json({ success: false, message: 'Access type not found' });

  const val = value.trim().toUpperCase();
  if (list[type].includes(val))
    return res.status(409).json({ success: false, message: 'Value already exists' });

  list[type].push(val);
  await writeAccessList(userId, list);
  res.json({ success: true, message: 'Value added' });
};

exports.deleteAccessValue = async (req, res) => {
  const { userId } = req.params;
  const { type, value } = req.body;
  if (!type || value === undefined)
    return res.status(400).json({ success: false, message: 'type and value are required' });

  const list = await readAccessList(userId);
  if (!list)
    return res.status(404).json({ success: false, message: 'No access control found' });
  if (!(type in list))
    return res.status(404).json({ success: false, message: 'Access type not found' });

  list[type] = list[type].filter(v => v !== value);
  await writeAccessList(userId, list);
  res.json({ success: true, message: 'Value removed' });
};
