import { join } from "node:path";

export interface Course {
  id: string;
  title: string;
  subtitle: string;
}

export const COURSES: Course[] = [
  {
    id: "18.701",
    title: "18.701",
    subtitle: "Algebra I",
  },
  {
    id: "6.1220",
    title: "6.1220",
    subtitle: "Design and Analysis of Algorithms",
  },
  {
    id: "6.300",
    title: "6.300",
    subtitle: "Signal Processing",
  },
  {
    id: "18.650",
    title: "18.650",
    subtitle: "Fundamentals of Statistics"
  },
  {
    id: "6.790",
    title: "6.790",
    subtitle: "Grad ML"
  }
];

export function courseDir(root: string, courseId: string): string {
  return join(root, "courses", courseId);
}

export function courseNotesDir(root: string, courseId: string): string {
  return join(courseDir(root, courseId), "notes");
}

export function coursePreamblePath(root: string, courseId: string): string {
  return join(courseDir(root, courseId), "preamble.tex");
}

export function courseImagesDir(root: string, courseId: string): string {
  return join(courseDir(root, courseId), "images");
}

export function courseAudioDir(root: string, courseId: string): string {
  return join(courseDir(root, courseId), "audio");
}

/** Published location of a course, under the generated `dist/` tree. */
export function courseSiteDir(root: string, courseId: string): string {
  return join(root, "dist", courseId);
}

export function findCourse(courseId: string): Course {
  const course = COURSES.find((entry) => entry.id === courseId);
  if (!course) throw new Error(`Unknown course: ${courseId}`);
  return course;
}
