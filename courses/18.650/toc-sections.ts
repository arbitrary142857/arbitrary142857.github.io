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
    { title: "Random Variables", from: 1, to: 6 },
    { title: "Estimators", from: 7, to: 12 },
  ];
  