// Coordinates deferred DOM work with connected-surface transactions.
// Delayed updates must never replace elements currently owned by Morph/FLIP.
export function createMotionScheduler(){
  let busy=false;
  const pending=new Map();

  function setBusy(value){
    busy=!!value;
    if(busy)return;

    // Drain a snapshot to preserve FIFO order and permit scheduling in callbacks.
    const tasks=[...pending.values()];
    pending.clear();
    for(const task of tasks)task();
  }

  function whenIdle(key,task){
    if(typeof task!=='function')throw new TypeError('A task function is required');
    if(!busy){
      task();
      return;
    }
    pending.set(key,task);
  }

  function cancel(key){
    pending.delete(key);
  }

  return {
    setBusy,whenIdle,cancel,
    isBusy:()=>busy
  };
}
