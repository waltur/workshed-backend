const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const fileUpload = require('express-fileupload');

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(cors());
//app.use(express.json());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(fileUpload());
// Rutas
const indexRoutes = require('./routes/index');
app.use('/api', indexRoutes);
app.use('/uploads/news', express.static(path.join(__dirname, '../public/uploads/news')));
app.use('/uploads/photos', express.static(path.join(__dirname, '../public/uploads/photos')));

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

const jobRoleRoutes = require('./routes/jobRole/jobRoles');
app.use('/api/job-roles', jobRoleRoutes);

const adminRoutes = require('./routes/admin/admin');
app.use('/api/admin', adminRoutes);

const groupRoutes = require('./routes/groupManagement/groups');
app.use('/api/groups', groupRoutes);

const eventRoutes = require('./routes/groupManagement/events');
app.use('/api/group-events', eventRoutes);

const timesheetRoutes = require('./routes/groupManagement/timesheets');
app.use('/api/group-timesheets', timesheetRoutes);

const participationRoutes = require('./routes/groupManagement/participation');
app.use('/api/group-participation', participationRoutes);

const eventTaskRoutes = require('./routes/groupManagement/tasks');
app.use('/api/group-tasks', eventTaskRoutes);

const newsRoutes = require('./routes/news/news');
app.use('/api/news', newsRoutes);

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));