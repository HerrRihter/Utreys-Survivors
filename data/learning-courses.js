import { learningCourse } from './learning-questions.js';
import { incidentCourse } from './learning-incidents.js';

// The learning map's courses by id, in the order the course picker lists them. Each course
// brings its questions, topics, maze names (`rooms`), hall boss (`boss`) and victory tag.
export const learningCourses = {
  [learningCourse.id]: learningCourse,
  [incidentCourse.id]: incidentCourse,
};
