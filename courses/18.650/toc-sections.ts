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
    { title: "Estimators", from: 7, to: 14 },
    { title: "Hypothesis Testing", from: 15, to: 20 },
    { title: "Bayesian Inference", from: 21, to: 21 }
  ];
  