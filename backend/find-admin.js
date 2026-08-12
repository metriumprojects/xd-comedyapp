require('dotenv').config();
const mongoose = require('mongoose');

async function findAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    console.log('Connected to DB');

    // We need to define the User model if it's not defined, or we can just use the native collection
    const usersCollection = mongoose.connection.collection('users');
    const admins = await usersCollection.find({ role: 'admin' }).toArray();

    if (admins.length > 0) {
      console.log('Found Admin Users:');
      admins.forEach(admin => {
        console.log(`- Email: ${admin.email}, DisplayName: ${admin.displayName}`);
      });
    } else {
      console.log('No admin users found in the database.');
      // Optionally create one if none exist
      console.log('Creating a default admin user...');
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await usersCollection.insertOne({
        email: 'admin@comedyapp.com',
        password: hashedPassword,
        role: 'admin',
        displayName: 'Super Admin',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('Default admin created: email=admin@comedyapp.com, password=admin123');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

findAdmin();
