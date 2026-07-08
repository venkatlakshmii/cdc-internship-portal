import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { User } from '../models/User.ts';
import { authenticate, AuthRequest } from '../middleware/auth.ts';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'hitam_cdc_secret_key_2024';

// In-memory fallback storage for registered students when DB is offline
const memoryUsers: any[] = [];

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (role !== 'student') {
      return res.status(400).json({ message: 'Only student accounts can be registered.' });
    }

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const emailStr = email.toLowerCase().trim();
    const hitamEmailRegex = /^[a-z0-9]{10}@hitam\.org$/;
    if (!hitamEmailRegex.test(emailStr)) {
      return res.status(400).json({ message: 'Email must follow the official student format ending in @hitam.org (roll number must be exactly 10 characters, which can be all numbers, all letters, or alphanumeric).' });
    }

    if (emailStr === 'cdc@hitam.org' || emailStr === 'principal@hitam.org') {
      return res.status(400).json({ message: 'Invalid email address for student registration' });
    }

    const passwordHashSha256 = crypto.createHash('sha256').update(password).digest('hex');

    // In-memory Fallback checks
    if (mongoose.connection.readyState !== 1) {
      const existingUser = memoryUsers.find(u => u.email === emailStr) || (emailStr === '24e51a6665@hitam.org' ? { email: '24e51a6665@hitam.org' } : null);
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Check unique password in memory (using fast sha256)
      const isPasswordExists = memoryUsers.some(u => u.role === 'student' && u.passwordHashSha256 === passwordHashSha256);
      if (isPasswordExists || password === 'password123') {
        return res.status(400).json({ message: 'Invalid Password – Password Already Exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const newUser = {
        _id: `mem-${Date.now()}`,
        name,
        email: emailStr,
        password: hashedPassword,
        passwordHashSha256,
        role: 'student',
        profileRegistered: false
      };
      memoryUsers.push(newUser);
      console.log(`[REGISTRATION FALLBACK] Registered user: ${emailStr}`);
      return res.status(201).json({ message: 'Student registered successfully' });
    }

    // DB checks
    const existingUser = await User.findOne({ email: emailStr });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    // Optimized check using indexed SHA-256 password hash field
    const duplicatePasswordUser = await User.findOne({ role: 'student', passwordHashSha256 });
    if (duplicatePasswordUser) {
      return res.status(400).json({ message: 'Invalid Password – Password Already Exists' });
    }

    // Fallback/Safety: check any legacy users that do not have passwordHashSha256 yet
    const legacyStudentUsers = await User.find({ role: 'student', passwordHashSha256: { $exists: false } });
    for (const student of legacyStudentUsers) {
      const isMatch = await bcrypt.compare(password, student.password);
      if (isMatch) {
        return res.status(400).json({ message: 'Invalid Password – Password Already Exists' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const rollNumber = emailStr.split('@')[0].toUpperCase();
    const user = new User({ 
      name, 
      email: emailStr, 
      password: hashedPassword, 
      passwordHashSha256,
      role: 'student',
      rollNumber,
      profileRegistered: false
    });
    await user.save();

    console.log(`[REGISTRATION SUCCESS] Registered user in DB: ${emailStr}`);
    res.status(201).json({ message: 'Student registered successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Error registering user' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string') {
      console.log(`[LOGIN REJECTED] Non-string input detected. Email type: ${typeof email}, Password type: ${typeof password}`);
      return res.status(400).json({ message: 'Email and password must be strings.' });
    }
    console.log(`[LOGIN ATTEMPT] Email: "${email}", Password Length: ${password?.length}`);
    
    // Fallback for demo purposes if DB is not connected
    if (mongoose.connection.readyState !== 1) {
      console.log('[LOGIN FALLBACK] Database not connected. Verifying against fallback and memory users.');
      
      // First try to authenticate from memoryUsers
      const emailStr = email?.toLowerCase().trim();
      const memUser = memoryUsers.find(u => u.email === emailStr);
      if (memUser) {
        const isBcrypt = typeof memUser.password === 'string' && memUser.password.startsWith('$2');
        let isMatch = false;
        if (isBcrypt) {
          isMatch = await bcrypt.compare(password, memUser.password);
        } else {
          isMatch = password === memUser.password;
          if (isMatch) {
            memUser.password = await bcrypt.hash(password, 12);
          }
        }
        if (isMatch) {
          const passwordHashSha256 = crypto.createHash('sha256').update(password).digest('hex');
          memUser.passwordHashSha256 = passwordHashSha256;
          console.log(`[LOGIN SUCCESS] Memory user found: ${email}`);
          const accessToken = jwt.sign({ id: memUser._id, role: memUser.role, email: memUser.email }, JWT_SECRET, { expiresIn: '1d' });
          const refreshToken = jwt.sign({ id: memUser._id, role: memUser.role, email: memUser.email }, JWT_SECRET, { expiresIn: '7d' });
          return res.json({ 
            token: accessToken, 
            accessToken, 
            refreshToken, 
            user: { id: memUser._id, name: memUser.name, email: memUser.email, role: memUser.role, profileRegistered: memUser.profileRegistered } 
          });
        }
      }

      const fallbackUsers = [
        { name: 'Student User', email: '24E51A6665@hitam.org', password: 'password123', role: 'student' },
        { name: 'CDC Faculty', email: 'cdc@hitam.org', password: 'password123', role: 'cdc' },
        { name: 'Principal', email: 'principal@hitam.org', password: 'password123', role: 'principal' },
      ];
      
      const fallbackUser = fallbackUsers.find(u => u.email.toLowerCase() === email?.trim().toLowerCase() && u.password === password);
      if (fallbackUser) {
        console.log(`[LOGIN SUCCESS] Fallback user found: ${email}`);
        const accessToken = jwt.sign({ id: 'fallback-id', role: fallbackUser.role, email: fallbackUser.email }, JWT_SECRET, { expiresIn: '1d' });
        const refreshToken = jwt.sign({ id: 'fallback-id', role: fallbackUser.role, email: fallbackUser.email }, JWT_SECRET, { expiresIn: '7d' });
        return res.json({ 
          token: accessToken, 
          accessToken, 
          refreshToken, 
          user: { id: 'fallback-id', name: fallbackUser.name, email: fallbackUser.email, role: fallbackUser.role, profileRegistered: false } 
        });
      } else {
        console.log(`[LOGIN FAILED] Fallback user match not found for email: ${email}`);
        return res.status(400).json({ message: 'Invalid credentials (Fallback Mode)' });
      }
    }

    const emailStr = (email || '').toLowerCase().trim();
    const user = await User.findOne({ email: emailStr });
    if (!user) {
      console.log(`[LOGIN FAILED] User not found in database for email: "${email}"`);
      return res.status(400).json({ message: 'User not found' });
    }

    console.log("Stored Password:", user.password);
    console.log("Entered Password:", password);

    const isBcrypt = typeof user.password === 'string' && user.password.startsWith('$2');
    let isMatch = false;
    let needsMigration = false;

    if (isBcrypt) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      isMatch = password === user.password;
      needsMigration = isMatch;
    }

    if (!isMatch) {
      console.log(`[LOGIN FAILED] Password mismatch for email: "${email}"`);
      return res.status(400).json({ message: 'Invalid password' });
    }

    // Populate SHA-256 for the logged-in user if missing or migrating
    const passwordHashSha256 = crypto.createHash('sha256').update(password).digest('hex');
    let shouldSave = false;

    if (needsMigration) {
      console.log(`[AUTH MIGRATION] Migrating plaintext password to bcrypt hash for user: ${user.email}`);
      try {
        const hashedPassword = await bcrypt.hash(password, 12);
        user.password = hashedPassword;
        user.passwordHashSha256 = passwordHashSha256;
        shouldSave = true;
      } catch (migrationErr) {
        console.error(`[AUTH MIGRATION ERROR] Failed to save hashed password for user: ${user.email}`, migrationErr);
      }
    } else if (!user.passwordHashSha256) {
      user.passwordHashSha256 = passwordHashSha256;
      shouldSave = true;
    }

    if (shouldSave) {
      try {
        await user.save();
        console.log(`[AUTH INDEX POPULATED] Populated passwordHashSha256 for user: ${user.email}`);
      } catch (saveErr) {
        console.error(`[AUTH INDEX ERROR] Failed to save passwordHashSha256 for user: ${user.email}`, saveErr);
      }
    }

    console.log(`[LOGIN SUCCESS] User authenticated: ${email}`);
    const accessToken = jwt.sign({ id: user._id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '1d' });
    const refreshToken = jwt.sign({ id: user._id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      token: accessToken, 
      accessToken, 
      refreshToken, 
      user: { id: user._id, name: user.name, email: user.email, role: user.role, profileRegistered: user.profileRegistered } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error logging in. Please check if the database is running.' });
  }
});

// Get Student Profile
router.get('/profile', authenticate, async (req: AuthRequest, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.log('[PROFILE GET FALLBACK] Database not connected.');
      
      const memUser = memoryUsers.find(u => u._id === req.user?.id);
      if (memUser) {
        return res.json({
          name: memUser.name,
          email: memUser.email,
          rollNumber: memUser.email.split('@')[0].toUpperCase(),
          branch: memUser.branch || '',
          year: memUser.year || '',
          section: memUser.section || '',
          attendancePercentage: memUser.attendancePercentage || 0,
          cgpa: memUser.cgpa || 0,
          contactNumber: memUser.contactNumber || '',
          personalEmail: memUser.personalEmail || '',
          profileRegistered: memUser.profileRegistered || false
        });
      }

      return res.json({
        name: 'Student User',
        email: req.user?.email || '24E51A6665@hitam.org',
        rollNumber: '24E51A6665',
        branch: 'CSE',
        year: '4th',
        section: 'A',
        attendancePercentage: 85,
        cgpa: 8.5,
        contactNumber: '9876543210',
        personalEmail: 'student@gmail.com',
        profileRegistered: false
      });
    }
    const user = await User.findById(req.user?.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Error fetching profile' });
  }
});

// Update/Register Student Profile
router.post('/profile', authenticate, async (req: AuthRequest, res) => {
  try {
    const { name, rollNumber, branch, year, section, attendancePercentage, cgpa, contactNumber, personalEmail } = req.body;
    
    if (mongoose.connection.readyState !== 1) {
      console.log('[PROFILE POST FALLBACK] Database not connected. Returning updated user state.');
      
      const memUser = memoryUsers.find(u => u._id === req.user?.id);
      if (memUser) {
        memUser.name = name;
        memUser.branch = branch;
        memUser.year = year;
        memUser.section = section;
        memUser.attendancePercentage = Math.round(Number(attendancePercentage) * 100) / 100;
        memUser.cgpa = Number(cgpa);
        memUser.contactNumber = contactNumber;
        memUser.personalEmail = personalEmail;
        memUser.profileRegistered = true;
      }

      return res.json({
        message: 'Profile updated successfully (Fallback Mode)',
        user: { name, rollNumber, branch, year, section, attendancePercentage: Number(attendancePercentage), cgpa: Number(cgpa), contactNumber, personalEmail, profileRegistered: true }
      });
    }

    const user = await User.findById(req.user?.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.name = name;
    user.rollNumber = rollNumber;
    user.branch = branch;
    user.year = year;
    user.section = section;
    user.attendancePercentage = Math.round(Number(attendancePercentage) * 100) / 100;
    user.cgpa = Number(cgpa);
    user.contactNumber = contactNumber;
    user.personalEmail = personalEmail;
    user.profileRegistered = true;

    await user.save();
    console.log(`[PROFILE UPDATE] Profile saved for user: ${user.email}`);
    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Error updating profile' });
  }
});

// POST /api/auth/forgot-password/verify - Verify student email exists
router.post('/forgot-password/verify', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }
    const emailStr = email.toLowerCase().trim();
    
    if (mongoose.connection.readyState !== 1) {
      // In-memory fallback verification
      const fallbackUsers = [
        { name: 'Student User', email: '24e51a6665@hitam.org', role: 'student' }
      ];
      const exists = memoryUsers.find(u => u.email === emailStr) || fallbackUsers.find(u => u.email === emailStr);
      if (!exists || exists.role !== 'student') {
        return res.status(404).json({ message: 'Student email not found.' });
      }
      return res.json({ message: 'Email verified successfully.' });
    }

    const user = await User.findOne({ email: emailStr, role: 'student' });
    if (!user) {
      return res.status(404).json({ message: 'Student email not found.' });
    }
    res.json({ message: 'Email verified successfully.' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ message: 'Error verifying email.' });
  }
});

// POST /api/auth/forgot-password/reset - Reset student password
router.post('/forgot-password/reset', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ message: 'Email and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    const emailStr = email.toLowerCase().trim();

    const newPasswordHashSha256 = crypto.createHash('sha256').update(newPassword).digest('hex');

    if (mongoose.connection.readyState !== 1) {
      // Fallback checks
      const existsIndex = memoryUsers.findIndex(u => u.email === emailStr);
      
      // In-memory uniqueness check using sha256
      const isPasswordExists = memoryUsers.some(u => u.role === 'student' && u.email !== emailStr && u.passwordHashSha256 === newPasswordHashSha256);
      if (isPasswordExists || newPassword === 'password123') {
        return res.status(400).json({ message: 'Invalid Password – Password Already Exists' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      if (existsIndex !== -1) {
        memoryUsers[existsIndex].password = hashedPassword;
        memoryUsers[existsIndex].passwordHashSha256 = newPasswordHashSha256;
      } else {
        // Seeded default student in-memory setup
        const newUser = {
          _id: `mem-${Date.now()}`,
          name: 'Student User',
          email: emailStr,
          password: hashedPassword,
          passwordHashSha256: newPasswordHashSha256,
          role: 'student',
          profileRegistered: false
        };
        memoryUsers.push(newUser);
      }

      console.log(`[PASSWORD RESET FALLBACK] Password reset for: ${emailStr}`);
      return res.json({ message: 'Password reset successfully.' });
    }

    // DB uniqueness check using indexed SHA-256 field
    const duplicatePasswordUser = await User.findOne({
      role: 'student',
      email: { $ne: emailStr },
      passwordHashSha256: newPasswordHashSha256
    });
    if (duplicatePasswordUser) {
      return res.status(400).json({ message: 'Invalid Password – Password Already Exists' });
    }

    // Fallback check for legacy accounts that don't have passwordHashSha256
    const legacyStudentUsers = await User.find({
      role: 'student',
      email: { $ne: emailStr },
      passwordHashSha256: { $exists: false }
    });
    for (const student of legacyStudentUsers) {
      const isMatch = await bcrypt.compare(newPassword, student.password);
      if (isMatch) {
        return res.status(400).json({ message: 'Invalid Password – Password Already Exists' });
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const user = await User.findOneAndUpdate(
      { email: emailStr, role: 'student' },
      { password: hashedPassword, passwordHashSha256: newPasswordHashSha256 },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'Student email not found.' });
    }

    console.log(`[PASSWORD RESET SUCCESS] Reset password for user: ${emailStr}`);
    res.json({ message: 'Password reset successfully.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Error resetting password.' });
  }
});

export default router;
