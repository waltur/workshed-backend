const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Rutas
const indexRoutes = require('./routes/index');
app.use('/api', indexRoutes);

// Iniciar servidor
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
const volunteerRoutes = require('./routes/volunteers/index');
app.use('/api/volunteers', volunteerRoutes);

const contactRoutes = require('./routes/contacts/contacts');
app.use('/api/contacts', contactRoutes);

const authRoutes = require('./routes/auth/auth');
app.use('/api/auth', authRoutes);

const roleRoutes = require('./routes/role/roles');
app.use('/api/roles', roleRoutes);