/** Pure deterministic airflow storyboard for the THREE tube renderer.
 * All moving arrows are sampled from the real full-length tube centreline.
 * There is no wall-clock timer: seeking the same frame replays identical flow. */
export function flowOpacity(cut:number):number {
  return 1-.69*Math.max(0,Math.min(1,cut));
}
export function visibleArrowCount(cut:number):number {
  return cut>.025?4:0;
}
/** All three pipes share a speed-linked, mildly pulsing movement.
 * Each pipe is offset in phase to prevent rigidly marching arrow grids. */
export function flowProgress(time:number,index:number,count:number,
  relativeSpeed:number,pipeId:number):number {
  const speed=.31*Math.max(.55,Math.min(1.9,relativeSpeed));
  const pulse=.018*Math.sin(time*2*Math.PI*1.35+pipeId*.7);
  const phase=(time*speed+pulse+index/count+pipeId*.13)%1;
  return (phase+1)%1;
}
