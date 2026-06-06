import mongoose from 'mongoose';

const AcademicCalendarSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ['exam_internal', 'exam_mid', 'exam_semester', 'holiday', 'restriction'], required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true }
}, { timestamps: true });

export const AcademicCalendar = mongoose.model('AcademicCalendar', AcademicCalendarSchema);
