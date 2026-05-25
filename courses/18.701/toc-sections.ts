/**
 * Table-of-contents parts for this course. Each part covers a contiguous run of
 * lectures (by lecture number). Edit titles and ranges here.
 */
export interface TocPart {
  title: string;
  from: number;
  to: number;
}

export const TOC_PARTS: TocPart[] = [
  { title: "Introductory Group Theory", from: 1, to: 4 },
  { title: "Fields and Vector Spaces", from: 5, to: 8 },
  { title: "Geometric Group Theory", from: 9, to: 12 },
  { title: "Group Actions", from: 13, to: 15 },
  { title: "Bilinear Forms", from: 16, to: 19 },
  { title: "Matrix Groups", from: 20, to: 22 },
];
