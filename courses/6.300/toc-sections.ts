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
    { title: "Fourier Analysis", from: 1, to: 7 },
    { title: "Systems and Convolution", from: 8, to: 11 },
    { title: "The Discrete Fourier Transform", from: 12, to: 16},
  ];
  