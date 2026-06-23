const bcrypt = require('bcryptjs');
console.log(bcrypt.hashSync('Admin@1234', 12));