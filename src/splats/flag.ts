/** The normal viewer stays as it is unless this query is set. */
export function splatPrototypeEnabled(): boolean {
  return new URLSearchParams(location.search).get("splats") === "1";
}

/** Draw the hidden splat collision mesh. `?splats=1&collider=1` starts with it on. */
export function splatColliderDebug(): boolean {
  return new URLSearchParams(location.search).get("collider") === "1";
}
