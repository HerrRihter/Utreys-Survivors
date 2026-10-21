import { learningCourse } from './learning-questions.js';
import { incidentCourse } from './learning-incidents.js';

// The learning maps' courses by id; a map names its course in `objective.course`.
export const learningCourses = {
  [learningCourse.id]: learningCourse,
  [incidentCourse.id]: incidentCourse,
};
