// Four visual phases; the hit event begins on the third frame. Rendering reads
// this timing, while simulation owns event dispatch and damage.
export const actionTiming={frameCount:4,impactProgress:0.5,event:'hit',loop:false};
