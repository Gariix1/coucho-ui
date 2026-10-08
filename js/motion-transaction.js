import {modeSurfaceTransition} from './motion.js';
import {modeLayoutTransition} from './layout-motion.js';

// Reusable, coordinated transition: capture -> mutate DOM -> settle together.
// destinations are resolved only AFTER mutate has rendered the new layout.
// All animations are canceled and interaction lock released even on failure.
export async function runMotionTransaction({
  root=null,
  surfaces=[],
  layout=null,
  mutate,
  onBusy=()=>{}
}){
  if(typeof mutate!=='function')throw new TypeError('A DOM mutation is required');

  const snapshots=[];
  let layoutTransition=null;
  onBusy(true);

  try{
    surfaces.forEach((surface,index)=>{
      // Later surfaces (the incoming editor when switching modes) stay above
      // outgoing ones throughout the connected transition.
      snapshots.push(modeSurfaceTransition.prepare(surface.source,{layer:index}));
    });

    if(layout){
      layoutTransition=modeLayoutTransition.prepare(root,{
        anchorKey:layout.anchorKey,
        scrollElement:layout.scrollElement
      });
    }

    mutate();

    // Anchor/scroll adjustment happens synchronously before either surface
    // measures its destination, so the Morph and surrounding FLIP agree.
    const layoutPromise=layoutTransition
      ?layoutTransition.play({
          root,
          anchorKey:layout.anchorKey,
          excludeKeys:layout.excludeKeys||[],
          duration:layout.duration,
          easing:layout.easing,
          animateSize:!!layout.animateSize
        })
      :Promise.resolve();

    const surfacePromises=snapshots.map((snapshot,index)=>{
      const surface=surfaces[index];
      return snapshot.play(
        typeof surface.destination==='function'
          ?surface.destination()
          :surface.destination,
        surface.direction||'open'
      );
    });

    await Promise.all([layoutPromise,...surfacePromises]);
  }finally{
    snapshots.forEach(snapshot=>snapshot.cancel());
    layoutTransition?.cancel();
    onBusy(false);
  }
}
