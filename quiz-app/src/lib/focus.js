// A mouse or touch click leaves a button focused, and the card shortcuts (Space, arrows) then skip the card.
// Release focus for pointer clicks only: keyboard activation reports detail 0, and those users keep their place.
export function releasePointerFocus(e) {
  if (e.detail > 0) e.currentTarget.blur();
}
