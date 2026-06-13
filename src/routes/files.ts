import express from 'express';
import { DbFile } from '../models/DbFile.ts';

const router = express.Router();

router.get('/download/:id', async (req, res, next) => {
  try {
    const file = await DbFile.findById(req.params.id);
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    res.send(file.data);
  } catch (error) {
    next(error);
  }
});

export default router;
