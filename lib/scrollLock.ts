
let locks = 0;

export function lockPageScroll(): () => void {
  locks += 1;
  if (locks === 1) document.body.style.overflow = "hidden";
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (locks === 0) document.body.style.overflow = "";
  };
}
